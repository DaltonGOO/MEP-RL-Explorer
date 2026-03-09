"""
PyQt5 + PyVista GUI for 3D MEP duct routing.

Launch:  python app3d.py
"""

from __future__ import annotations

import sys
import threading
from pathlib import Path

import numpy as np
from PyQt5.QtCore import Qt, QTimer, pyqtSignal
from PyQt5.QtWidgets import (
    QApplication,
    QCheckBox,
    QComboBox,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QMainWindow,
    QProgressBar,
    QPushButton,
    QSpinBox,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

import pyvista as pv
from pyvistaqt import QtInteractor
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback

from duct_env3d import DuctRoutingEnv3D
from mep_config import MEP_SYSTEMS
from rooms3d import SYNTHETIC_ROOMS_3D, get_room_3d
from viewer3d import _voxel_center

MODELS_DIR = Path(__file__).parent / "models"

# ── Training worker (QThread-like, using QTimer+thread) ─────────────────────


class _ProgressCallback(BaseCallback):
    """SB3 callback that fires a callable every *interval* steps."""

    def __init__(self, on_progress, stop_event: threading.Event,
                 total: int, interval: int = 500):
        super().__init__()
        self._on_progress = on_progress
        self._stop = stop_event
        self._total = total
        self._interval = interval

    def _on_step(self) -> bool:
        if self._stop.is_set():
            return False
        if self.num_timesteps % self._interval == 0:
            self._on_progress(self.num_timesteps, self._total)
        return True


class TrainWorker:
    """Runs PPO.learn() in a background thread, emitting Qt signals."""

    progress = None  # set by MainWindow
    finished = None
    error = None

    def __init__(self, env, mep_name: str, room_name: str, timesteps: int):
        self.env = env
        self.mep_name = mep_name
        self.room_name = room_name
        self.timesteps = timesteps
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self):
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self):
        self._stop.set()

    def _run(self):
        try:
            model = PPO(
                "MlpPolicy", self.env, verbose=0,
                learning_rate=3e-4, n_steps=2048, batch_size=64,
                n_epochs=10, gamma=0.99, ent_coef=0.01,
            )
            cb = _ProgressCallback(
                self._emit_progress, self._stop, self.timesteps,
            )
            model.learn(total_timesteps=self.timesteps, callback=cb)

            MODELS_DIR.mkdir(parents=True, exist_ok=True)
            save_path = MODELS_DIR / f"ppo3d_{self.mep_name}_{self.room_name}"
            model.save(str(save_path))

            if self.finished:
                self.finished(str(save_path))
        except Exception as exc:
            if self.error:
                self.error(str(exc))

    def _emit_progress(self, current: int, total: int):
        if self.progress:
            self.progress(current, total)


# ── Main Window ─────────────────────────────────────────────────────────────


class MainWindow(QMainWindow):
    # Signals for thread-safe GUI updates
    _sig_progress = pyqtSignal(int, int)
    _sig_finished = pyqtSignal(str)
    _sig_error = pyqtSignal(str)

    def __init__(self):
        super().__init__()
        self.setWindowTitle("3D MEP Routing Agent")
        self.resize(1200, 750)

        # State
        self.env: DuctRoutingEnv3D | None = None
        self.model: PPO | None = None
        self.worker: TrainWorker | None = None
        self.play_timer: QTimer | None = None
        self._play_obs = None
        self._play_path_pts: list[np.ndarray] = []
        self._play_agent_actor = None
        self._play_path_actor = None
        self._play_step_count = 0

        # Signals
        self._sig_progress.connect(self._on_train_progress)
        self._sig_finished.connect(self._on_train_finished)
        self._sig_error.connect(self._on_train_error)

        self._build_ui()
        self._update_buttons()

    # ── UI construction ─────────────────────────────────────────────────

    def _build_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        root = QHBoxLayout(central)

        # --- Sidebar ---
        sidebar = QVBoxLayout()
        sidebar.setAlignment(Qt.AlignTop)

        # Scene group
        grp_scene = QGroupBox("Scene")
        lay_scene = QVBoxLayout(grp_scene)
        self.combo_room = QComboBox()
        self.combo_room.addItems(list(SYNTHETIC_ROOMS_3D.keys()))
        self.combo_mep = QComboBox()
        self.combo_mep.addItems(list(MEP_SYSTEMS.keys()))
        self.btn_build = QPushButton("Build Scene")
        self.btn_build.clicked.connect(self.on_build_scene)
        lay_scene.addWidget(QLabel("Room"))
        lay_scene.addWidget(self.combo_room)
        lay_scene.addWidget(QLabel("MEP System"))
        lay_scene.addWidget(self.combo_mep)
        lay_scene.addWidget(self.btn_build)
        sidebar.addWidget(grp_scene)

        # Training group
        grp_train = QGroupBox("Training")
        lay_train = QVBoxLayout(grp_train)
        self.spin_timesteps = QSpinBox()
        self.spin_timesteps.setRange(1_000, 5_000_000)
        self.spin_timesteps.setSingleStep(10_000)
        self.spin_timesteps.setValue(100_000)
        self.btn_train = QPushButton("Train")
        self.btn_train.clicked.connect(self.on_train)
        self.progress_bar = QProgressBar()
        self.progress_bar.setValue(0)
        lay_train.addWidget(QLabel("Timesteps"))
        lay_train.addWidget(self.spin_timesteps)
        lay_train.addWidget(self.btn_train)
        lay_train.addWidget(self.progress_bar)
        sidebar.addWidget(grp_train)

        # Episode group
        grp_ep = QGroupBox("Episode")
        lay_ep = QVBoxLayout(grp_ep)
        self.btn_evaluate = QPushButton("Evaluate")
        self.btn_evaluate.clicked.connect(self.on_evaluate)
        self.chk_random = QCheckBox("Random mode")
        self.spin_speed = QSpinBox()
        self.spin_speed.setRange(20, 2000)
        self.spin_speed.setSingleStep(50)
        self.spin_speed.setValue(200)
        self.spin_speed.setSuffix(" ms")
        self.btn_play = QPushButton("Play")
        self.btn_play.clicked.connect(self.on_play)
        self.btn_stop = QPushButton("Stop / Reset")
        self.btn_stop.clicked.connect(self.on_stop)
        lay_ep.addWidget(self.btn_evaluate)
        lay_ep.addWidget(self.chk_random)
        lay_ep.addWidget(QLabel("Speed"))
        lay_ep.addWidget(self.spin_speed)
        lay_ep.addWidget(self.btn_play)
        lay_ep.addWidget(self.btn_stop)
        sidebar.addWidget(grp_ep)

        # Log
        grp_log = QGroupBox("Log")
        lay_log = QVBoxLayout(grp_log)
        self.log = QTextEdit()
        self.log.setReadOnly(True)
        self.log.setMaximumHeight(160)
        lay_log.addWidget(self.log)
        sidebar.addWidget(grp_log)

        sidebar_widget = QWidget()
        sidebar_widget.setLayout(sidebar)
        sidebar_widget.setFixedWidth(280)
        root.addWidget(sidebar_widget)

        # --- 3D Viewport ---
        self.plotter = QtInteractor(central)
        self.plotter.set_background("white")
        self.plotter.add_axes()
        root.addWidget(self.plotter, stretch=1)

    # ── Logging helper ──────────────────────────────────────────────────

    def _log(self, msg: str):
        self.log.append(msg)
        self.log.verticalScrollBar().setValue(
            self.log.verticalScrollBar().maximum()
        )

    # ── Button state machine ────────────────────────────────────────────

    def _update_buttons(self):
        has_env = self.env is not None
        has_model = self.model is not None
        training = self.worker is not None
        playing = self.play_timer is not None and self.play_timer.isActive()

        self.btn_build.setEnabled(not training and not playing)
        self.combo_room.setEnabled(not training and not playing)
        self.combo_mep.setEnabled(not training and not playing)

        self.btn_train.setEnabled(has_env and not training and not playing)
        self.spin_timesteps.setEnabled(not training)

        self.btn_evaluate.setEnabled(has_env and has_model and not training and not playing)
        self.btn_play.setEnabled(has_env and (has_model or self.chk_random.isChecked())
                                 and not training and not playing)
        self.btn_stop.setEnabled(training or playing)

    # ── Scene ───────────────────────────────────────────────────────────

    def on_build_scene(self):
        room_name = self.combo_room.currentText()
        mep_name = self.combo_mep.currentText()
        mep = MEP_SYSTEMS[mep_name]
        dto = get_room_3d(room_name)
        self.env = DuctRoutingEnv3D(dto, mep=mep)
        self.env.reset()
        self.model = None

        # Auto-load model if it exists
        model_path = MODELS_DIR / f"ppo3d_{mep_name}_{room_name}"
        if model_path.with_suffix(".zip").exists():
            self.model = PPO.load(str(model_path), env=self.env)
            self._log(f"Loaded model: {model_path.name}")

        self._draw_scene()
        self._log(f"Built scene: {room_name} / {mep_name}")
        self._update_buttons()

    def _draw_scene(self):
        """Render obstacles, start, target in the 3D viewport."""
        self.plotter.clear()
        scene = self.env.scene
        vs = scene.voxel_size
        ox, oy, oz = scene.origin

        # Room boundary wireframe
        room_box = pv.Box(bounds=(
            ox, ox + scene.nx * vs,
            oy, oy + scene.ny * vs,
            oz, oz + scene.nz * vs,
        ))
        self.plotter.add_mesh(room_box, style="wireframe", color="gray",
                              line_width=1, opacity=0.3)

        # Obstacles
        obstacle_indices = np.argwhere(scene.voxels == 1)
        if len(obstacle_indices) > 0:
            blocks = pv.MultiBlock()
            for iz_v, iy_v, ix_v in obstacle_indices:
                cx, cy, cz = _voxel_center(scene, ix_v, iy_v, iz_v)
                half = vs / 2
                cube = pv.Box(bounds=(
                    cx - half, cx + half,
                    cy - half, cy + half,
                    cz - half, cz + half,
                ))
                blocks.append(cube)
            merged = blocks.combine()
            self.plotter.add_mesh(merged, color="dimgray", opacity=0.25)

        # Start sphere
        sx, sy, sz = _voxel_center(scene, *scene.start_ijk)
        self.plotter.add_mesh(
            pv.Sphere(radius=vs * 0.4, center=(sx, sy, sz)),
            color="limegreen", label="Start",
        )

        # Target sphere
        tx, ty, tz = _voxel_center(scene, *scene.target_ijk)
        self.plotter.add_mesh(
            pv.Sphere(radius=vs * 0.4, center=(tx, ty, tz)),
            color="red", label="Target",
        )

        self.plotter.add_legend()
        self.plotter.reset_camera()

    def _draw_path(self, path):
        """Draw a spline tube for a completed route."""
        scene = self.env.scene
        if len(path) < 2:
            return
        world_pts = np.array([_voxel_center(scene, *p) for p in path])
        spline = pv.Spline(world_pts, n_points=len(world_pts) * 3)
        self.plotter.add_mesh(
            spline.tube(radius=scene.voxel_size * 0.15),
            color="dodgerblue", label="Route",
        )
        # End marker
        ex, ey, ez = world_pts[-1]
        self.plotter.add_mesh(
            pv.Sphere(radius=scene.voxel_size * 0.3, center=(ex, ey, ez)),
            color="dodgerblue",
        )

    # ── Training ────────────────────────────────────────────────────────

    def on_train(self):
        room_name = self.combo_room.currentText()
        mep_name = self.combo_mep.currentText()
        mep = MEP_SYSTEMS[mep_name]
        dto = get_room_3d(room_name)
        train_env = DuctRoutingEnv3D(dto, mep=mep)

        ts = self.spin_timesteps.value()
        self.progress_bar.setValue(0)

        self.worker = TrainWorker(train_env, mep_name, room_name, ts)
        self.worker.progress = lambda c, t: self._sig_progress.emit(c, t)
        self.worker.finished = lambda p: self._sig_finished.emit(p)
        self.worker.error = lambda m: self._sig_error.emit(m)
        self.worker.start()

        self._log(f"Training started: {ts} timesteps...")
        self._update_buttons()

    def _on_train_progress(self, current: int, total: int):
        pct = int(100 * current / max(total, 1))
        self.progress_bar.setValue(pct)

    def _on_train_finished(self, save_path: str):
        self.progress_bar.setValue(100)
        self.worker = None
        # Reload model into current env
        self.model = PPO.load(save_path, env=self.env)
        self._log(f"Training done. Model saved: {Path(save_path).name}")
        self._update_buttons()

    def _on_train_error(self, msg: str):
        self.worker = None
        self._log(f"Training error: {msg}")
        self._update_buttons()

    # ── Evaluate ────────────────────────────────────────────────────────

    def on_evaluate(self):
        obs, _ = self.env.reset()
        total_reward = 0.0
        done = False
        while not done:
            action, _ = self.model.predict(obs, deterministic=True)
            obs, reward, terminated, truncated, info = self.env.step(int(action))
            total_reward += reward
            done = terminated or truncated

        path = self.env.path
        reached = info.get("reached_target", False)
        steps = info.get("steps", len(path))
        status = "REACHED" if reached else "FAILED"

        self._draw_scene()
        self._draw_path(path)
        self._log(f"Eval: {status} | steps={steps} | reward={total_reward:.1f}")

    # ── Play (animated) ─────────────────────────────────────────────────

    def on_play(self):
        self._play_obs, _ = self.env.reset()
        self._play_path_pts = []
        self._play_agent_actor = None
        self._play_path_actor = None
        self._play_step_count = 0

        self._draw_scene()

        # Initial agent sphere
        scene = self.env.scene
        ix, iy, iz = self.env.path[-1]
        cx, cy, cz = _voxel_center(scene, ix, iy, iz)
        self._play_path_pts.append(np.array([cx, cy, cz]))
        self._play_agent_actor = self.plotter.add_mesh(
            pv.Sphere(radius=scene.voxel_size * 0.3, center=(cx, cy, cz)),
            color="dodgerblue", name="agent_sphere",
        )

        self.play_timer = QTimer()
        self.play_timer.timeout.connect(self._step_play)
        self.play_timer.start(self.spin_speed.value())
        self._log("Play started.")
        self._update_buttons()

    def _step_play(self):
        if self.env is None:
            self.on_stop()
            return

        random_mode = self.chk_random.isChecked()
        if random_mode:
            action = self.env.action_space.sample()
        else:
            action, _ = self.model.predict(self._play_obs, deterministic=True)
            action = int(action)

        self._play_obs, reward, terminated, truncated, info = self.env.step(action)
        self._play_step_count += 1

        scene = self.env.scene
        ix, iy, iz = self.env.path[-1]
        cx, cy, cz = _voxel_center(scene, ix, iy, iz)
        self._play_path_pts.append(np.array([cx, cy, cz]))

        # Update agent sphere
        self.plotter.remove_actor("agent_sphere")
        self._play_agent_actor = self.plotter.add_mesh(
            pv.Sphere(radius=scene.voxel_size * 0.3, center=(cx, cy, cz)),
            color="dodgerblue", name="agent_sphere",
        )

        # Rebuild path tube every 5 steps (performance)
        if len(self._play_path_pts) >= 2 and self._play_step_count % 5 == 0:
            self.plotter.remove_actor("path_tube")
            pts = np.array(self._play_path_pts)
            line = pv.lines_from_points(pts)
            self.plotter.add_mesh(
                line.tube(radius=scene.voxel_size * 0.1),
                color="dodgerblue", opacity=0.7, name="path_tube",
            )

        if terminated or truncated:
            # Final path tube
            if len(self._play_path_pts) >= 2:
                self.plotter.remove_actor("path_tube")
                pts = np.array(self._play_path_pts)
                line = pv.lines_from_points(pts)
                self.plotter.add_mesh(
                    line.tube(radius=scene.voxel_size * 0.1),
                    color="dodgerblue", opacity=0.7, name="path_tube",
                )
            reached = info.get("reached_target", False)
            status = "REACHED" if reached else "FAILED"
            self._log(f"Play done: {status} | steps={self._play_step_count} | reward={reward:.1f}")
            self.play_timer.stop()
            self._update_buttons()

    # ── Stop ────────────────────────────────────────────────────────────

    def on_stop(self):
        if self.play_timer and self.play_timer.isActive():
            self.play_timer.stop()
            self._log("Play stopped.")
        if self.worker:
            self.worker.stop()
            self._log("Training abort requested.")
            self.worker = None
        self._update_buttons()


# ── Entry point ─────────────────────────────────────────────────────────────

def main():
    pv.global_theme.allow_empty_mesh = True
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
