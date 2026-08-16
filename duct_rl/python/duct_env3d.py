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
    OBS_DIM,
    GeometryDTO3D,
    VoxelScene,
    build_scene,
    compute_obs,
    reset as grid_reset,
    step as grid_step,
)
from mep_config import MEPConfig, DUCT


class DuctRoutingEnv3D(gym.Env):
    """
    Observation (Box, float32, shape=(OBS_DIM,)):
        See :func:`grid3d.compute_obs` for the full layout. In short:
        position, vector to target, neighbor cell types, previous action,
        current straight-run length, whether a bend is currently allowed,
        and which neighbors have already been visited.

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
            low=-1.0, high=1.0, shape=(OBS_DIM,), dtype=np.float32
        )

        self._state = None
        self.path: list[tuple[int, int, int]] = []

    def _obs(self) -> np.ndarray:
        return compute_obs(self.scene, self._state, self.mep)

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        self._state = grid_reset(self.scene)
        self.path = [(self._state.ix, self._state.iy, self._state.iz)]
        return self._obs(), {}

    def step(self, action: int):
        result = grid_step(self.scene, self._state, action, self.mep)
        self._state = result.state
        self.path.append((self._state.ix, self._state.iy, self._state.iz))

        # Reaching the target is a real terminal state; running out of steps
        # is a time limit. Reporting the time limit as termination tells SB3
        # the future value there is zero, which biases the critic against the
        # long routes the harder rooms need.
        terminated = bool(result.info.get("reached_target", False))
        truncated = bool(result.done and not terminated)

        return self._obs(), result.reward, terminated, truncated, result.info
