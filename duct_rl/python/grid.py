"""
Grid builder — pure-Python replacement for the Rust core (M0).

Converts a geometry DTO into a 2D occupancy grid and provides
the step/reset logic used by the Gymnasium environment.

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


# ── Geometry DTO ──────────────────────────────────────────────────────────────

@dataclass
class GeometryDTO:
    """Minimal geometry description passed from Python to the grid builder."""

    room_boundary: List[Tuple[float, float]]   # closed polygon [(x,y), ...]
    obstacles: List[List[Tuple[float, float]]]  # list of polygons
    start: Tuple[float, float]
    target: Tuple[float, float]
    grid_resolution: float = 0.3   # world-units per cell
    clearance: float = 0.0         # obstacle inflation radius (world-units)


# ── Grid Scene (immutable after build) ────────────────────────────────────────

@dataclass
class GridScene:
    width: int
    height: int
    cells: np.ndarray          # shape (height, width), dtype uint8
    start_rc: Tuple[int, int]  # (row, col)
    target_rc: Tuple[int, int]
    # world ↔ grid transforms
    origin_x: float = 0.0
    origin_y: float = 0.0
    cell_size: float = 0.3


# ── Env State (mutable per episode) ──────────────────────────────────────────

@dataclass
class EnvState:
    row: int = 0
    col: int = 0
    prev_dir: int = -1   # last action taken (-1 = none)
    steps: int = 0


# ── Step result ───────────────────────────────────────────────────────────────

@dataclass
class StepResult:
    state: EnvState
    reward: float
    done: bool
    info: dict = field(default_factory=dict)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _point_in_polygon(px: float, py: float,
                      polygon: List[Tuple[float, float]]) -> bool:
    """Ray-casting point-in-polygon test."""
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def _inflate_polygon(polygon: List[Tuple[float, float]],
                     radius: float) -> List[Tuple[float, float]]:
    """Cheap polygon inflation: push each vertex outward by *radius*.

    This is a rough approximation (proper Minkowski sum is complex).
    Good enough for M0.
    """
    if radius <= 0:
        return polygon
    # compute centroid
    cx = sum(p[0] for p in polygon) / len(polygon)
    cy = sum(p[1] for p in polygon) / len(polygon)
    inflated = []
    for x, y in polygon:
        dx, dy = x - cx, y - cy
        d = math.hypot(dx, dy)
        if d == 0:
            inflated.append((x, y))
        else:
            inflated.append((x + radius * dx / d, y + radius * dy / d))
    return inflated


# ── Build Scene ───────────────────────────────────────────────────────────────

def build_scene(dto: GeometryDTO) -> GridScene:
    """Convert a GeometryDTO into a GridScene (occupancy grid)."""

    # 1. Bounding box of room boundary
    xs = [p[0] for p in dto.room_boundary]
    ys = [p[1] for p in dto.room_boundary]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)

    cs = dto.grid_resolution
    width = int(math.ceil((max_x - min_x) / cs))
    height = int(math.ceil((max_y - min_y) / cs))
    # ensure at least 1×1
    width = max(width, 1)
    height = max(height, 1)

    # 2. Allocate grid — default obstacle (cells outside room are obstacles)
    cells = np.ones((height, width), dtype=np.uint8)

    # 3. Inflate obstacles
    inflated_obstacles = [
        _inflate_polygon(obs, dto.clearance) for obs in dto.obstacles
    ]

    # 4. Rasterize: mark cells inside room_boundary as empty,
    #    then mark cells inside obstacles as blocked.
    for r in range(height):
        for c in range(width):
            # cell centre in world coords
            wx = min_x + (c + 0.5) * cs
            wy = min_y + (r + 0.5) * cs

            if not _point_in_polygon(wx, wy, dto.room_boundary):
                continue  # stays obstacle (outside room)

            # inside room — start as empty
            cell_val = 0

            for obs in inflated_obstacles:
                if _point_in_polygon(wx, wy, obs):
                    cell_val = 1
                    break

            cells[r, c] = cell_val

    # 5. Place start & target
    def world_to_rc(wx, wy):
        c = int((wx - min_x) / cs)
        r = int((wy - min_y) / cs)
        c = max(0, min(c, width - 1))
        r = max(0, min(r, height - 1))
        return r, c

    start_rc = world_to_rc(*dto.start)
    target_rc = world_to_rc(*dto.target)

    cells[start_rc] = 2
    cells[target_rc] = 3

    return GridScene(
        width=width,
        height=height,
        cells=cells,
        start_rc=start_rc,
        target_rc=target_rc,
        origin_x=min_x,
        origin_y=min_y,
        cell_size=cs,
    )


# ── Reset / Step ──────────────────────────────────────────────────────────────

# Action mapping: 0=up, 1=down, 2=left, 3=right
_DELTAS = {
    0: (-1, 0),   # up    (row-1)
    1: (1, 0),    # down  (row+1)
    2: (0, -1),   # left  (col-1)
    3: (0, 1),    # right (col+1)
}

# Reward constants — easy to tweak
REWARD_TARGET = 100.0
REWARD_STEP = -1.0
REWARD_COLLISION = -5.0   # penalty for bumping into wall (no termination)
REWARD_TURN = -0.5

MAX_STEPS = 200


def reset(scene: GridScene) -> EnvState:
    """Place agent at start."""
    return EnvState(
        row=scene.start_rc[0],
        col=scene.start_rc[1],
        prev_dir=-1,
        steps=0,
    )


def step(scene: GridScene, state: EnvState, action: int) -> StepResult:
    """Execute one step and return (next_state, reward, done, info)."""

    dr, dc = _DELTAS[action]
    nr, nc = state.row + dr, state.col + dc
    state.steps += 1

    info = {"hit_obstacle": False, "reached_target": False, "steps": state.steps}

    # Out-of-bounds or obstacle → bounce back (don't move, penalize, continue)
    if nr < 0 or nr >= scene.height or nc < 0 or nc >= scene.width:
        info["hit_obstacle"] = True
        state.prev_dir = action
        reward = REWARD_COLLISION
        if state.steps >= MAX_STEPS:
            return StepResult(state, reward, True, info)
        return StepResult(state, reward, False, info)

    cell = scene.cells[nr, nc]
    if cell == 1:  # obstacle
        info["hit_obstacle"] = True
        state.prev_dir = action
        reward = REWARD_COLLISION
        if state.steps >= MAX_STEPS:
            return StepResult(state, reward, True, info)
        return StepResult(state, reward, False, info)

    # Move agent
    # Distance shaping: reward getting closer to target
    old_dist = abs(state.row - scene.target_rc[0]) + abs(state.col - scene.target_rc[1])
    new_dist = abs(nr - scene.target_rc[0]) + abs(nc - scene.target_rc[1])
    dist_reward = (old_dist - new_dist) * 1.0  # +1 closer, -1 farther

    reward = REWARD_STEP + dist_reward

    # Turn penalty
    if state.prev_dir != -1 and action != state.prev_dir:
        reward += REWARD_TURN

    state.row = nr
    state.col = nc
    state.prev_dir = action

    # Reached target?
    if cell == 3:
        info["reached_target"] = True
        return StepResult(state, REWARD_TARGET, True, info)

    # Max steps?
    if state.steps >= MAX_STEPS:
        return StepResult(state, reward, True, info)

    return StepResult(state, reward, False, info)


def get_neighbors(scene: GridScene, row: int, col: int) -> List[int]:
    """Return cell values for [up, down, left, right] neighbors.

    Out-of-bounds neighbors are reported as 1 (obstacle).
    """
    result = []
    for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
        nr, nc = row + dr, col + dc
        if 0 <= nr < scene.height and 0 <= nc < scene.width:
            result.append(int(scene.cells[nr, nc]))
        else:
            result.append(1)
    return result
