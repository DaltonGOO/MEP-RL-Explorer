"""
Gymnasium environment for duct routing on a 2D occupancy grid.

Wraps the pure-Python grid module (M0) — later swap in Rust via PyO3.
"""

from __future__ import annotations

from typing import Optional

import gymnasium as gym
import numpy as np
from gymnasium import spaces

from grid import (
    GeometryDTO,
    GridScene,
    build_scene,
    get_neighbors,
    reset as grid_reset,
    step as grid_step,
)


class DuctRoutingEnv(gym.Env):
    """
    Observation (Box, float32, shape=(8,)):
        [x_norm, y_norm, dx_norm, dy_norm, n_up, n_down, n_left, n_right]

        x_norm, y_norm   — agent position normalized to [0, 1]
        dx_norm, dy_norm — vector to target normalized to [-1, 1]
        n_up … n_right   — neighbor cell type (0=empty, 1=obstacle, 3=target)
                            divided by 3 so values stay in [0, 1]

    Action (Discrete(4)):
        0=up, 1=down, 2=left, 3=right
    """

    metadata = {"render_modes": ["human"]}

    def __init__(self, dto: GeometryDTO, render_mode: Optional[str] = None):
        super().__init__()
        self.dto = dto
        self.scene: GridScene = build_scene(dto)
        self.render_mode = render_mode

        self.action_space = spaces.Discrete(4)
        self.observation_space = spaces.Box(
            low=-1.0, high=1.0, shape=(8,), dtype=np.float32
        )

        self._state = None
        self.path: list[tuple[int, int]] = []  # recorded for rendering

    # ── helpers ────────────────────────────────────────────────────────────

    def _obs(self) -> np.ndarray:
        s = self._state
        sc = self.scene

        x_norm = s.col / max(sc.width - 1, 1)
        y_norm = s.row / max(sc.height - 1, 1)
        dx = (sc.target_rc[1] - s.col) / max(sc.width - 1, 1)
        dy = (sc.target_rc[0] - s.row) / max(sc.height - 1, 1)

        neighbors = get_neighbors(sc, s.row, s.col)
        n_scaled = [v / 3.0 for v in neighbors]

        return np.array(
            [x_norm, y_norm, dx, dy] + n_scaled,
            dtype=np.float32,
        )

    # ── Gymnasium API ─────────────────────────────────────────────────────

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        self._state = grid_reset(self.scene)
        self.path = [(self._state.row, self._state.col)]
        return self._obs(), {}

    def step(self, action: int):
        result = grid_step(self.scene, self._state, action)
        self._state = result.state
        self.path.append((self._state.row, self._state.col))

        truncated = False
        terminated = result.done

        return self._obs(), result.reward, terminated, truncated, result.info
