"""
MEP system configuration — defines physical and reward parameters
for each MEP system type (duct, pipe, cable tray).

Adding a new system: copy an existing config, tweak numbers, add to MEP_SYSTEMS.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MEPConfig:
    """All per-system parameters for the 3D routing environment."""

    name: str

    # Physical
    cross_section_mm: float      # nominal cross-section diameter/width
    clearance_m: float           # required clearance from obstacles
    voxel_size_m: float          # world-meters per voxel cell

    # Rewards
    reward_target: float         # reaching the target
    reward_step: float           # per-step penalty
    reward_collision: float      # bumping into wall/obstacle
    reward_turn_horizontal: float  # horizontal direction change (XY plane)
    reward_turn_vertical: float    # vertical direction change (XY <-> Z)
    reward_vertical_per_voxel: float  # per-voxel cost for vertical travel
    reward_revisit: float        # stepping on an already-visited voxel

    # Constraints
    max_steps: int               # episode truncation limit
    min_straight_before_bend: int  # must go this many voxels straight before turning


# ── Presets ──────────────────────────────────────────────────────────────────

DUCT = MEPConfig(
    name="duct",
    cross_section_mm=400.0,
    clearance_m=0.15,
    voxel_size_m=0.3,
    reward_target=100.0,
    reward_step=-1.0,
    reward_collision=-5.0,
    reward_turn_horizontal=-0.5,
    reward_turn_vertical=-2.0,
    reward_vertical_per_voxel=-0.3,
    reward_revisit=-2.0,
    max_steps=300,
    min_straight_before_bend=0,
)

PIPE = MEPConfig(
    name="pipe",
    cross_section_mm=100.0,
    clearance_m=0.05,
    voxel_size_m=0.2,
    reward_target=100.0,
    reward_step=-1.0,
    reward_collision=-5.0,
    reward_turn_horizontal=-1.0,    # pipe bends are expensive
    reward_turn_vertical=-3.0,
    reward_vertical_per_voxel=-0.5,
    reward_revisit=-2.0,
    max_steps=400,
    min_straight_before_bend=2,     # at least 2 voxels straight before a bend
)

CABLE_TRAY = MEPConfig(
    name="cable_tray",
    cross_section_mm=300.0,
    clearance_m=0.10,
    voxel_size_m=0.3,
    reward_target=100.0,
    reward_step=-0.5,
    reward_collision=-5.0,
    reward_turn_horizontal=-0.3,    # cable trays bend easily
    reward_turn_vertical=-1.0,
    reward_vertical_per_voxel=-0.2,
    reward_revisit=-1.5,
    max_steps=300,
    min_straight_before_bend=0,
)

MEP_SYSTEMS: dict[str, MEPConfig] = {
    "duct": DUCT,
    "pipe": PIPE,
    "cable_tray": CABLE_TRAY,
}
