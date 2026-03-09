"""
Gymnasium environment for 3D MEP routing on a voxel grid.

Wraps grid3d module — supports duct, pipe, and cable_tray systems.
"""

from __future__ import annotations

from typing import Optional

import gymnasium as gym
import numpy as np
from gymnasium import spaces

from grid3d import (
    GeometryDTO3D,
    VoxelScene,
    build_scene,
    get_neighbors_3d,
    reset as grid_reset,
    step as grid_step,
)
from mep_config import MEPConfig, DUCT


class DuctRoutingEnv3D(gym.Env):
    """
    Observation (Box, float32, shape=(12,)):
        [x_norm, y_norm, z_norm, dx, dy, dz,
         n_px, n_nx, n_py, n_ny, n_pz, n_nz]

        x/y/z_norm  -- agent position normalized to [0, 1]
        dx/dy/dz    -- vector to target normalized to [-1, 1]
        n_*         -- neighbor cell types (0=empty, 1=obstacle, 3=target)
                       divided by 3 so values stay in [0, 1]

    Action (Discrete(6)):
        0=+X, 1=-X, 2=+Y, 3=-Y, 4=+Z(up), 5=-Z(down)
    """

    metadata = {"render_modes": ["human"]}

    def __init__(self, dto: GeometryDTO3D, mep: MEPConfig = DUCT,
                 render_mode: Optional[str] = None):
        super().__init__()
        self.dto = dto
        self.mep = mep
        self.scene: VoxelScene = build_scene(dto, mep)
        self.render_mode = render_mode

        self.action_space = spaces.Discrete(6)
        self.observation_space = spaces.Box(
            low=-1.0, high=1.0, shape=(12,), dtype=np.float32
        )

        self._state = None
        self.path: list[tuple[int, int, int]] = []

    def _obs(self) -> np.ndarray:
        s = self._state
        sc = self.scene

        x_norm = s.ix / max(sc.nx - 1, 1)
        y_norm = s.iy / max(sc.ny - 1, 1)
        z_norm = s.iz / max(sc.nz - 1, 1)

        dx = (sc.target_ijk[0] - s.ix) / max(sc.nx - 1, 1)
        dy = (sc.target_ijk[1] - s.iy) / max(sc.ny - 1, 1)
        dz = (sc.target_ijk[2] - s.iz) / max(sc.nz - 1, 1)

        neighbors = get_neighbors_3d(sc, s.ix, s.iy, s.iz)
        n_scaled = [v / 3.0 for v in neighbors]

        return np.array(
            [x_norm, y_norm, z_norm, dx, dy, dz] + n_scaled,
            dtype=np.float32,
        )

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        self._state = grid_reset(self.scene)
        self.path = [(self._state.ix, self._state.iy, self._state.iz)]
        return self._obs(), {}

    def step(self, action: int):
        result = grid_step(self.scene, self._state, action, self.mep)
        self._state = result.state
        self.path.append((self._state.ix, self._state.iy, self._state.iz))

        truncated = False
        terminated = result.done

        return self._obs(), result.reward, terminated, truncated, result.info
