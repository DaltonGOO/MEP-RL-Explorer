"""Training service — wraps SB3 PPO with progress streaming."""

from __future__ import annotations

import asyncio
import sys
import threading
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import random
import shutil
import tempfile

from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback, CallbackList, EvalCallback
from stable_baselines3.common.monitor import Monitor

# Add the python/ directory so we can import the existing env code
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent / "python"))

from duct_env3d import DuctRoutingEnv3D
from grid3d import Box3D, GeometryDTO3D
from mep_config import MEPConfig
from rooms3d import get_room_3d


@dataclass
class TrainJob:
    job_id: str
    room: str
    mep_name: str
    timesteps: int
    seed: int = 0
    status: str = "running"
    progress: float = 0.0
    current_timestep: int = 0
    metrics: list = field(default_factory=list)
    model_path: str | None = None
    error: str | None = None
    cancel_flag: bool = False
    # Best mean reward seen by the periodic evaluation, and whether the model
    # that got saved came from there rather than the end of training.
    best_eval_reward: float | None = None
    used_best_checkpoint: bool = False


class _ProgressCallback(BaseCallback):
    """SB3 callback that pushes metrics into the job's metrics list."""

    def __init__(self, job: TrainJob, report_every: int = 500):
        super().__init__()
        self.job = job
        self.report_every = report_every
        self._ep_rewards: list[float] = []
        self._ep_lengths: list[int] = []
        self._ep_successes: list[bool] = []

    def _on_step(self) -> bool:
        if self.job.cancel_flag:
            return False

        self.job.current_timestep = self.num_timesteps
        self.job.progress = self.num_timesteps / self.job.timesteps

        # Collect per-episode stats from the environment info
        for info in self.locals.get("infos", []):
            if "episode" in info:
                self._ep_rewards.append(info["episode"]["r"])
                self._ep_lengths.append(info["episode"]["l"])
                # Mean reward alone hides what actually matters: whether the
                # duct got routed. An agent that never arrives can still post
                # a respectable reward by hugging the target.
                self._ep_successes.append(bool(info.get("reached_target", False)))

        if self.num_timesteps % self.report_every == 0:
            metric: dict[str, Any] = {"timestep": self.num_timesteps}
            if self._ep_rewards:
                metric["ep_rew_mean"] = sum(self._ep_rewards) / len(self._ep_rewards)
                metric["ep_len_mean"] = sum(self._ep_lengths) / len(self._ep_lengths)
                metric["ep_count"] = len(self._ep_rewards)
                metric["success_rate"] = (
                    sum(self._ep_successes) / len(self._ep_successes)
                )
                self._ep_rewards.clear()
                self._ep_lengths.clear()
                self._ep_successes.clear()
            else:
                metric["ep_rew_mean"] = None
                metric["ep_len_mean"] = None
                metric["success_rate"] = None
            self.job.metrics.append(metric)

        return True


# Global job registry
_jobs: dict[str, TrainJob] = {}

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
WEIGHTS_DIR = Path(__file__).resolve().parent.parent / "weights"


def _mep_from_params(params: dict[str, Any]) -> MEPConfig:
    """Create an MEPConfig from request parameters."""
    return MEPConfig(**params)


def _geometry_to_dto(geometry: dict[str, Any]) -> GeometryDTO3D:
    """Convert custom geometry dict to GeometryDTO3D."""
    return GeometryDTO3D(
        room_min=tuple(geometry["room_min"]),
        room_max=tuple(geometry["room_max"]),
        obstacles=[
            Box3D(
                x_min=o["x_min"], y_min=o["y_min"], z_min=o["z_min"],
                x_max=o["x_max"], y_max=o["y_max"], z_max=o["z_max"],
            )
            for o in geometry["obstacles"]
        ],
        start=tuple(geometry["start"]),
        target=tuple(geometry["target"]),
    )


def start_training(
    room: str | None,
    geometry: dict[str, Any] | None,
    mep_params: dict[str, Any],
    timesteps: int = 50000,
    learning_rate: float = 3e-4,
    n_steps: int = 2048,
    batch_size: int = 64,
    seed: int | None = None,
    eval_episodes: int = 10,
) -> str:
    """Launch training in a background thread. Returns job_id."""
    job_id = str(uuid.uuid4())[:8]
    mep = _mep_from_params(mep_params)

    # An unrecorded seed makes a good run impossible to reproduce, so pick one
    # when the caller doesn't and keep it on the job.
    if seed is None:
        seed = random.randrange(2**31 - 1)

    job = TrainJob(
        job_id=job_id,
        room=room or "custom",
        mep_name=mep.name,
        timesteps=timesteps,
        seed=seed,
    )
    _jobs[job_id] = job

    def _train():
        best_dir = None
        try:
            dto = _geometry_to_dto(geometry) if geometry else get_room_3d(room)
            env = Monitor(DuctRoutingEnv3D(dto, mep))
            env.reset(seed=seed)

            model = PPO(
                "MlpPolicy",
                env,
                learning_rate=learning_rate,
                n_steps=n_steps,
                batch_size=batch_size,
                n_epochs=10,
                gamma=0.99,
                ent_coef=0.01,
                seed=seed,
                verbose=0,
            )

            # Training reward is not monotonic here — a longer run routinely
            # ends on a worse policy than one it passed through. Evaluate
            # periodically and keep the best, instead of whatever the final
            # step happens to leave behind.
            best_dir = tempfile.mkdtemp(prefix=f"ppo3d_{job_id}_")
            eval_env = Monitor(DuctRoutingEnv3D(dto, mep))
            eval_env.reset(seed=seed + 1)
            eval_cb = EvalCallback(
                eval_env,
                best_model_save_path=best_dir,
                n_eval_episodes=eval_episodes,
                eval_freq=max(n_steps, timesteps // 20),
                deterministic=True,
                verbose=0,
            )
            progress_cb = _ProgressCallback(job, report_every=500)
            model.learn(
                total_timesteps=timesteps,
                callback=CallbackList([progress_cb, eval_cb]),
            )

            if job.cancel_flag:
                job.status = "cancelled"
                return

            best_path = Path(best_dir) / "best_model.zip"
            if best_path.exists():
                model = PPO.load(str(best_path))
                job.used_best_checkpoint = True
                job.best_eval_reward = float(eval_cb.best_mean_reward)

            # Save model
            MODELS_DIR.mkdir(parents=True, exist_ok=True)
            model_filename = f"ppo3d_{mep.name}_{job.room}_{job_id}.zip"
            model_path = MODELS_DIR / model_filename
            model.save(str(model_path))
            job.model_path = str(model_path)

            # Export weights for WASM
            from services.model_export import export_mlp_weights

            WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
            weights_path = WEIGHTS_DIR / f"{model_filename.replace('.zip', '.json')}"
            export_mlp_weights(str(model_path), str(weights_path))

            job.status = "completed"
            job.progress = 1.0

        except Exception as e:
            job.status = "failed"
            job.error = str(e)
        finally:
            if best_dir:
                shutil.rmtree(best_dir, ignore_errors=True)

    thread = threading.Thread(target=_train, daemon=True)
    thread.start()

    return job_id


def get_job(job_id: str) -> TrainJob | None:
    return _jobs.get(job_id)


def cancel_job(job_id: str) -> bool:
    job = _jobs.get(job_id)
    if job and job.status == "running":
        job.cancel_flag = True
        return True
    return False


def list_jobs() -> list[TrainJob]:
    return list(_jobs.values())
