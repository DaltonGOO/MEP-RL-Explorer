"""
3D voxel grid — build_scene, reset, step for the 3D MEP routing environment.

Cell values:
    0 = empty
    1 = obstacle
    2 = start
    3 = target
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import List, Tuple

import numpy as np

from mep_config import MEPConfig


# ── Geometry DTO ─────────────────────────────────────────────────────────────

@dataclass
class Box3D:
    """Axis-aligned 3D obstacle primitive (meters, Z-up)."""
    x_min: float
    y_min: float
    z_min: float
    x_max: float
    y_max: float
    z_max: float
    label: str = "obstacle"


@dataclass
class GeometryDTO3D:
    """Minimal 3D geometry description passed to the grid builder."""
    room_min: Tuple[float, float, float]   # (x, y, z) lower corner in meters
    room_max: Tuple[float, float, float]   # (x, y, z) upper corner in meters
    obstacles: List[Box3D]
    start: Tuple[float, float, float]      # (x, y, z) in meters
    target: Tuple[float, float, float]     # (x, y, z) in meters


# ── Voxel Scene (immutable after build) ──────────────────────────────────────

@dataclass
class VoxelScene:
    nx: int  # number of voxels along X
    ny: int  # number of voxels along Y
    nz: int  # number of voxels along Z
    voxels: np.ndarray        # shape (nz, ny, nx), dtype uint8
    start_ijk: Tuple[int, int, int]   # (ix, iy, iz)
    target_ijk: Tuple[int, int, int]  # (ix, iy, iz)
    origin: Tuple[float, float, float]  # world position of voxel (0,0,0) corner
    voxel_size: float


# ── Env State (mutable per episode) ─────────────────────────────────────────

@dataclass
class EnvState3D:
    ix: int = 0
    iy: int = 0
    iz: int = 0
    prev_action: int = -1
    steps: int = 0
    visited: set = field(default_factory=set)
    straight_run: int = 0  # consecutive steps in same direction


# ── Step result ──────────────────────────────────────────────────────────────

@dataclass
class StepResult3D:
    state: EnvState3D
    reward: float
    done: bool
    info: dict = field(default_factory=dict)


# ── Actions ──────────────────────────────────────────────────────────────────
# 0=+X, 1=-X, 2=+Y, 3=-Y, 4=+Z(up), 5=-Z(down)
_DELTAS_3D = {
    0: (1, 0, 0),    # +X
    1: (-1, 0, 0),   # -X
    2: (0, 1, 0),    # +Y
    3: (0, -1, 0),   # -Y
    4: (0, 0, 1),    # +Z (up)
    5: (0, 0, -1),   # -Z (down)
}

# Actions 0-3 are horizontal, 4-5 are vertical
_HORIZONTAL_ACTIONS = {0, 1, 2, 3}
_VERTICAL_ACTIONS = {4, 5}


def _is_vertical(action: int) -> bool:
    return action in _VERTICAL_ACTIONS


# ── Observation ──────────────────────────────────────────────────────────────

#: Length of the vector produced by :func:`compute_obs`.
#:
#: Must stay in sync with ``OBS_DIM`` in
#: ``duct_rl/web/crate/src/grid3d.rs`` — this is the implementation the agent
#: trains against, that is the one it plays back against in the browser.
OBS_DIM = 26

#: ``straight_run`` is normalized against this cap in the observation;
#: anything longer reads as 1.0.
STRAIGHT_RUN_CAP = 10


def bend_allowed(state: EnvState3D, mep: MEPConfig) -> bool:
    """Whether a direction change would be accepted from the current state.

    Continuing in the same direction is always allowed -- this only gates
    turns.
    """
    return (mep.min_straight_before_bend == 0
            or state.prev_action < 0
            or state.straight_run >= mep.min_straight_before_bend)


# ── Build Scene ──────────────────────────────────────────────────────────────

def build_scene(dto: GeometryDTO3D, mep: MEPConfig) -> VoxelScene:
    """Convert a GeometryDTO3D into a VoxelScene (3D occupancy grid)."""
    vs = mep.voxel_size_m
    clearance = mep.clearance_m

    ox, oy, oz = dto.room_min
    rx, ry, rz = dto.room_max

    nx = max(1, int(math.ceil((rx - ox) / vs)))
    ny = max(1, int(math.ceil((ry - oy) / vs)))
    nz = max(1, int(math.ceil((rz - oz) / vs)))

    # Start with all empty
    voxels = np.zeros((nz, ny, nx), dtype=np.uint8)

    # Rasterize obstacles (with clearance inflation)
    for box in dto.obstacles:
        # Inflate box by clearance
        bx0 = box.x_min - clearance
        by0 = box.y_min - clearance
        bz0 = box.z_min - clearance
        bx1 = box.x_max + clearance
        by1 = box.y_max + clearance
        bz1 = box.z_max + clearance

        # Convert to voxel indices (clamp to grid)
        ix0 = max(0, int(math.floor((bx0 - ox) / vs)))
        iy0 = max(0, int(math.floor((by0 - oy) / vs)))
        iz0 = max(0, int(math.floor((bz0 - oz) / vs)))
        ix1 = min(nx, int(math.ceil((bx1 - ox) / vs)))
        iy1 = min(ny, int(math.ceil((by1 - oy) / vs)))
        iz1 = min(nz, int(math.ceil((bz1 - oz) / vs)))

        voxels[iz0:iz1, iy0:iy1, ix0:ix1] = 1

    # Place start and target
    def world_to_ijk(wx, wy, wz):
        ix = max(0, min(nx - 1, int((wx - ox) / vs)))
        iy = max(0, min(ny - 1, int((wy - oy) / vs)))
        iz = max(0, min(nz - 1, int((wz - oz) / vs)))
        return ix, iy, iz

    start_ijk = world_to_ijk(*dto.start)
    target_ijk = world_to_ijk(*dto.target)

    # Ensure start/target are not inside an obstacle
    voxels[start_ijk[2], start_ijk[1], start_ijk[0]] = 2
    voxels[target_ijk[2], target_ijk[1], target_ijk[0]] = 3

    return VoxelScene(
        nx=nx, ny=ny, nz=nz,
        voxels=voxels,
        start_ijk=start_ijk,
        target_ijk=target_ijk,
        origin=(ox, oy, oz),
        voxel_size=vs,
    )


# ── Reset / Step ─────────────────────────────────────────────────────────────

def reset(scene: VoxelScene) -> EnvState3D:
    """Place agent at start."""
    ix, iy, iz = scene.start_ijk
    state = EnvState3D(ix=ix, iy=iy, iz=iz)
    state.visited.add((ix, iy, iz))
    return state


def step(scene: VoxelScene, state: EnvState3D, action: int,
         mep: MEPConfig) -> StepResult3D:
    """Execute one step. Returns StepResult3D."""
    dx, dy, dz = _DELTAS_3D[action]
    nix, niy, niz = state.ix + dx, state.iy + dy, state.iz + dz
    state.steps += 1

    info = {"hit_obstacle": False, "reached_target": False,
            "steps": state.steps, "bend_rejected": False}

    # Bend constraint: reject turn if straight_run < min_straight_before_bend
    if action != state.prev_action and not bend_allowed(state, mep):
        # Reject the turn — treat like a wasted step
        info["bend_rejected"] = True
        reward = mep.reward_step
        if state.steps >= mep.max_steps:
            return StepResult3D(state, reward, True, info)
        return StepResult3D(state, reward, False, info)

    # Out-of-bounds check
    if (nix < 0 or nix >= scene.nx
            or niy < 0 or niy >= scene.ny
            or niz < 0 or niz >= scene.nz):
        info["hit_obstacle"] = True
        state.prev_action = action
        state.straight_run = 0
        reward = mep.reward_collision
        if state.steps >= mep.max_steps:
            return StepResult3D(state, reward, True, info)
        return StepResult3D(state, reward, False, info)

    # Obstacle check
    cell = scene.voxels[niz, niy, nix]
    if cell == 1:
        info["hit_obstacle"] = True
        state.prev_action = action
        state.straight_run = 0
        reward = mep.reward_collision
        if state.steps >= mep.max_steps:
            return StepResult3D(state, reward, True, info)
        return StepResult3D(state, reward, False, info)

    # --- Valid move ---
    # Distance shaping (3D Manhattan)
    old_dist = (abs(state.ix - scene.target_ijk[0])
                + abs(state.iy - scene.target_ijk[1])
                + abs(state.iz - scene.target_ijk[2]))
    new_dist = (abs(nix - scene.target_ijk[0])
                + abs(niy - scene.target_ijk[1])
                + abs(niz - scene.target_ijk[2]))
    dist_reward = float(old_dist - new_dist)

    reward = mep.reward_step + dist_reward

    # Turn penalties
    if state.prev_action >= 0 and action != state.prev_action:
        prev_vert = _is_vertical(state.prev_action)
        curr_vert = _is_vertical(action)
        if prev_vert != curr_vert:
            # Vertical <-> horizontal transition
            reward += mep.reward_turn_vertical
        else:
            # Horizontal direction change
            reward += mep.reward_turn_horizontal

    # Vertical travel penalty
    if _is_vertical(action):
        reward += mep.reward_vertical_per_voxel

    # Revisit penalty
    pos = (nix, niy, niz)
    if pos in state.visited:
        reward += mep.reward_revisit

    # Update state
    state.ix = nix
    state.iy = niy
    state.iz = niz
    state.visited.add(pos)

    if action == state.prev_action:
        state.straight_run += 1
    else:
        state.straight_run = 1
    state.prev_action = action

    # Reached target?
    if cell == 3:
        info["reached_target"] = True
        return StepResult3D(state, mep.reward_target, True, info)

    # Max steps?
    if state.steps >= mep.max_steps:
        return StepResult3D(state, reward, True, info)

    return StepResult3D(state, reward, False, info)


def compute_obs(scene: VoxelScene, state: EnvState3D,
                mep: MEPConfig) -> np.ndarray:
    """Build the observation vector.

    Layout (all components in [-1, 1]):

        index    contents
        0..3     agent position, normalized to [0, 1]
        3..6     vector to target, normalized to [-1, 1]
        6..12    neighbor cell types / 3 (+X, -X, +Y, -Y, +Z, -Z)
        12..18   previous action, one-hot (all zero on the first step)
        18       length of the current straight run, capped and scaled
        19       1.0 if a turn would be accepted right now, else 0.0
        20..26   1.0 for each neighbor voxel already visited

    Indices 12..26 exist because the reward function reads state the agent
    could not otherwise see: turn penalties depend on ``prev_action``, the
    bend constraint on ``straight_run``, and the revisit penalty on
    ``visited``.
    """
    span_x = max(scene.nx - 1, 1)
    span_y = max(scene.ny - 1, 1)
    span_z = max(scene.nz - 1, 1)

    obs = np.zeros(OBS_DIM, dtype=np.float32)

    obs[0] = state.ix / span_x
    obs[1] = state.iy / span_y
    obs[2] = state.iz / span_z

    obs[3] = (scene.target_ijk[0] - state.ix) / span_x
    obs[4] = (scene.target_ijk[1] - state.iy) / span_y
    obs[5] = (scene.target_ijk[2] - state.iz) / span_z

    neighbors = get_neighbors_3d(scene, state.ix, state.iy, state.iz)
    for i, v in enumerate(neighbors):
        obs[6 + i] = v / 3.0

    if state.prev_action >= 0:
        obs[12 + state.prev_action] = 1.0

    obs[18] = min(state.straight_run, STRAIGHT_RUN_CAP) / STRAIGHT_RUN_CAP
    obs[19] = 1.0 if bend_allowed(state, mep) else 0.0

    for i, (dx, dy, dz) in _DELTAS_3D.items():
        nix, niy, niz = state.ix + dx, state.iy + dy, state.iz + dz
        if (0 <= nix < scene.nx and 0 <= niy < scene.ny
                and 0 <= niz < scene.nz
                and (nix, niy, niz) in state.visited):
            obs[20 + i] = 1.0

    return obs


def get_neighbors_3d(scene: VoxelScene, ix: int, iy: int,
                     iz: int) -> List[int]:
    """Return cell values for [+X, -X, +Y, -Y, +Z, -Z] neighbors.

    Out-of-bounds neighbors are reported as 1 (obstacle).
    """
    result = []
    for dx, dy, dz in [(1,0,0), (-1,0,0), (0,1,0), (0,-1,0), (0,0,1), (0,0,-1)]:
        nx, ny, nz = ix + dx, iy + dy, iz + dz
        if 0 <= nx < scene.nx and 0 <= ny < scene.ny and 0 <= nz < scene.nz:
            result.append(int(scene.voxels[nz, ny, nx]))
        else:
            result.append(1)
    return result
