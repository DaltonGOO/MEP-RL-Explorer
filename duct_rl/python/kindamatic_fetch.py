"""
Synthetic room generator for 2D duct routing.

Provides four test rooms of increasing complexity.
"""

from __future__ import annotations

import json

from grid import GeometryDTO


# ── Synthetic rooms ──────────────────────────────────────────────────────────


def make_simple_room() -> GeometryDTO:
    """10x10 meter room with one rectangular obstacle in the middle."""
    return GeometryDTO(
        room_boundary=[(0, 0), (10, 0), (10, 10), (0, 10)],
        obstacles=[
            [(4, 4), (6, 4), (6, 6), (4, 6)],  # 2x2 block
        ],
        start=(1, 1),
        target=(9, 9),
        grid_resolution=0.5,
        clearance=0.0,
    )


def make_corridor_room() -> GeometryDTO:
    """Narrow corridor with a wall gap the agent must find."""
    return GeometryDTO(
        room_boundary=[(0, 0), (20, 0), (20, 6), (0, 6)],
        obstacles=[
            # wall across the corridor with a gap at y=4..6
            [(10, 0), (10.5, 0), (10.5, 4), (10, 4)],
        ],
        start=(1, 3),
        target=(19, 3),
        grid_resolution=0.5,
        clearance=0.0,
    )


def make_l_shaped_room() -> GeometryDTO:
    """L-shaped room -- tests routing around an internal corner."""
    return GeometryDTO(
        room_boundary=[
            (0, 0), (10, 0), (10, 5), (5, 5), (5, 10), (0, 10),
        ],
        obstacles=[
            [(2, 3), (3, 3), (3, 7), (2, 7)],  # pillar-like wall
        ],
        start=(1, 1),
        target=(3, 8),
        grid_resolution=0.5,
        clearance=0.0,
    )


def make_multi_obstacle_room() -> GeometryDTO:
    """Room with several scattered obstacles."""
    return GeometryDTO(
        room_boundary=[(0, 0), (15, 0), (15, 15), (0, 15)],
        obstacles=[
            [(3, 3), (5, 3), (5, 5), (3, 5)],
            [(8, 2), (10, 2), (10, 4), (8, 4)],
            [(6, 8), (8, 8), (8, 10), (6, 10)],
            [(11, 10), (13, 10), (13, 12), (11, 12)],
        ],
        start=(1, 1),
        target=(14, 14),
        grid_resolution=0.5,
        clearance=0.0,
    )


# ── Convenience ───────────────────────────────────────────────────────────────

SYNTHETIC_ROOMS = {
    "simple": make_simple_room,
    "corridor": make_corridor_room,
    "l_shaped": make_l_shaped_room,
    "multi_obstacle": make_multi_obstacle_room,
}


def get_room(name: str = "simple") -> GeometryDTO:
    """Get a synthetic room by name, or raise KeyError."""
    return SYNTHETIC_ROOMS[name]()


def dto_to_json(dto: GeometryDTO) -> str:
    """Serialize DTO to JSON (useful for saving/loading scenes)."""
    return json.dumps({
        "room_boundary": dto.room_boundary,
        "obstacles": dto.obstacles,
        "start": list(dto.start),
        "target": list(dto.target),
        "grid_resolution": dto.grid_resolution,
        "clearance": dto.clearance,
    }, indent=2)


def dto_from_json(text: str) -> GeometryDTO:
    """Deserialize DTO from JSON."""
    d = json.loads(text)
    return GeometryDTO(
        room_boundary=[tuple(p) for p in d["room_boundary"]],
        obstacles=[[tuple(p) for p in obs] for obs in d["obstacles"]],
        start=tuple(d["start"]),
        target=tuple(d["target"]),
        grid_resolution=d.get("grid_resolution", 0.3),
        clearance=d.get("clearance", 0.0),
    )
