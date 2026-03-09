"""
Synthetic 3D rooms for MEP routing.

Each room targets a specific 3D routing challenge.
"""

from __future__ import annotations

from grid3d import Box3D, GeometryDTO3D


# ── Synthetic Rooms ──────────────────────────────────────────────────────────

def make_simple_3d() -> GeometryDTO3D:
    """10x10x3m room with a column — same-level routing."""
    return GeometryDTO3D(
        room_min=(0, 0, 0),
        room_max=(10, 10, 3),
        obstacles=[
            Box3D(4, 4, 0, 6, 6, 3, label="column"),
        ],
        start=(1, 1, 1.5),
        target=(9, 9, 1.5),
    )


def make_corridor_3d() -> GeometryDTO3D:
    """20x6x3m corridor with a wall that has a gap at the top.

    Forces routing over the wall (go up, cross, go down).
    """
    return GeometryDTO3D(
        room_min=(0, 0, 0),
        room_max=(20, 6, 3),
        obstacles=[
            # Wall across corridor, full height except top 0.6m gap
            Box3D(10, 0, 0, 10.5, 6, 2.4, label="wall"),
        ],
        start=(1, 3, 1.5),
        target=(19, 3, 1.5),
    )


def make_multi_floor_3d() -> GeometryDTO3D:
    """10x10x7m two-floor room with a floor slab and shaft opening.

    Floor slab at z=3..3.3m with a 2x2m shaft opening at (7-9, 7-9).
    Start on floor 1, target on floor 2 — agent must find the shaft.
    """
    return GeometryDTO3D(
        room_min=(0, 0, 0),
        room_max=(10, 10, 7),
        obstacles=[
            # Floor slab (full coverage minus shaft opening)
            Box3D(0, 0, 3, 7, 10, 3.3, label="slab_left"),
            Box3D(7, 0, 3, 10, 7, 3.3, label="slab_right"),
            # shaft opening is at x=7..10, y=7..10 (no slab there)
        ],
        start=(1, 1, 1.5),
        target=(1, 1, 5),
    )


def make_ceiling_beams_3d() -> GeometryDTO3D:
    """15x15x3m room with beams at ceiling height.

    Beams run along Y at regular X intervals — agent must duck under them
    to route at ceiling level.
    """
    beams = []
    for x_start in [3, 6, 9, 12]:
        beams.append(
            Box3D(x_start, 0, 2.4, x_start + 0.3, 15, 3, label="beam")
        )
    return GeometryDTO3D(
        room_min=(0, 0, 0),
        room_max=(15, 15, 3),
        obstacles=beams,
        start=(1, 1, 2),
        target=(14, 14, 2),
    )


# ── Registry ─────────────────────────────────────────────────────────────────

SYNTHETIC_ROOMS_3D = {
    "simple": make_simple_3d,
    "corridor": make_corridor_3d,
    "multi_floor": make_multi_floor_3d,
    "ceiling_beams": make_ceiling_beams_3d,
}


def get_room_3d(name: str = "simple") -> GeometryDTO3D:
    """Get a synthetic 3D room by name."""
    return SYNTHETIC_ROOMS_3D[name]()
