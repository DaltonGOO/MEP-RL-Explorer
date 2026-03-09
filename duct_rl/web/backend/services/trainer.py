"""Training service — wraps SB3 PPO with progress streaming."""

from __future__ import annotations

import asyncio
import sys
import threading
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback
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
    status: str = "running"
    progress: float = 0.0
    current_timestep: int = 0
    metrics: list = field(default_factory=list)
    model_path: str | None = None
    error: str | None = None
    cancel_flag: bool = False


class _ProgressCallback(BaseCallback):
    """SB3 callback that pushes metrics into the job's metrics list."""

    def __init__(self, job: TrainJob, report_every: int = 500):
        super().__init__()
        self.job = job
        self.report_every = report_every
        self._ep_rewards: list[float] = []
        self._ep_lengths: list[int] = []

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

        if self.num_timesteps % self.report_every == 0:
            metric: dict[str, Any] = {"timestep": self.num_timesteps}
            if self._ep_rewards:
                metric["ep_rew_mean"] = sum(self._ep_rewards) / len(self._ep_rewards)
                metric["ep_len_mean"] = sum(self._ep_lengths) / len(self._ep_lengths)
                metric["ep_count"] = len(self._ep_rewards)
                self._ep_rewards.clear()
                self._ep_lengths.clear()
            else:
                metric["ep_rew_mean"] = None
                metric["ep_len_mean"] = None
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
) -> str:
    """Launch training in a background thread. Returns job_id."""
    job_id = str(uuid.uuid4())[:8]
    mep = _mep_from_params(mep_params)

    job = TrainJob(
        job_id=job_id,
        room=room or "custom",
        mep_name=mep.name,
        timesteps=timesteps,
    )
    _jobs[job_id] = job

    def _train():
        try:
            dto = _geometry_to_dto(geometry) if geometry else get_room_3d(room)
            env = Monitor(DuctRoutingEnv3D(dto, mep))
            model = PPO(
                "MlpPolicy",
                env,
                learning_rate=learning_rate,
                n_steps=n_steps,
                batch_size=batch_size,
                n_epochs=10,
                gamma=0.99,
                ent_coef=0.01,
                verbose=0,
            )
            callback = _ProgressCallback(job, report_every=500)
            model.learn(total_timesteps=timesteps, callback=callback)

            if job.cancel_flag:
                job.status = "cancelled"
                return

            # Save model
            MODELS_DIR.mkdir(parents=True, exist_ok=True)
            model_filename = f"ppo3d_{mep.name}_{room}_{job_id}.zip"
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
