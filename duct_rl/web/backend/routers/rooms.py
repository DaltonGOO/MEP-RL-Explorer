"""Room endpoints — list available rooms and MEP presets."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["rooms"])


ROOMS = {
    "simple": {
        "name": "simple",
        "description": "10x10x3m room with a column",
        "challenge": "Basic same-level routing around an obstacle",
    },
    "corridor": {
        "name": "corridor",
        "description": "20x6x3m corridor with wall gap at top",
        "challenge": "Agent must route over a wall (up, across, down)",
    },
    "multi_floor": {
        "name": "multi_floor",
        "description": "10x10x7m two-floor room with shaft",
        "challenge": "Find the vertical shaft to reach the upper floor",
    },
    "ceiling_beams": {
        "name": "ceiling_beams",
        "description": "15x15x3m room with ceiling beams",
        "challenge": "Navigate between parallel beams at ceiling height",
    },
}

MEP_PRESETS = {
    "duct": {
        "name": "duct",
        "description": "HVAC ductwork — moderate bend penalties",
        "cross_section_mm": 400.0,
        "clearance_m": 0.15,
        "voxel_size_m": 0.3,
        "reward_target": 100.0,
        "reward_step": -1.0,
        "reward_collision": -5.0,
        "reward_turn_horizontal": -0.5,
        "reward_turn_vertical": -2.0,
        "reward_vertical_per_voxel": -0.3,
        "reward_revisit": -2.0,
        "max_steps": 300,
        "min_straight_before_bend": 0,
    },
    "pipe": {
        "name": "pipe",
        "description": "Piping — strict bend constraints, expensive turns",
        "cross_section_mm": 100.0,
        "clearance_m": 0.05,
        "voxel_size_m": 0.2,
        "reward_target": 100.0,
        "reward_step": -1.0,
        "reward_collision": -5.0,
        "reward_turn_horizontal": -1.0,
        "reward_turn_vertical": -3.0,
        "reward_vertical_per_voxel": -0.5,
        "reward_revisit": -2.0,
        "max_steps": 400,
        "min_straight_before_bend": 2,
    },
    "cable_tray": {
        "name": "cable_tray",
        "description": "Cable trays — flexible routing, low penalties",
        "cross_section_mm": 300.0,
        "clearance_m": 0.10,
        "voxel_size_m": 0.3,
        "reward_target": 100.0,
        "reward_step": -0.5,
        "reward_collision": -5.0,
        "reward_turn_horizontal": -0.3,
        "reward_turn_vertical": -1.0,
        "reward_vertical_per_voxel": -0.2,
        "reward_revisit": -1.5,
        "max_steps": 300,
        "min_straight_before_bend": 0,
    },
}


@router.get("/rooms")
async def list_rooms():
    return {"rooms": list(ROOMS.values())}


@router.get("/mep-systems")
async def list_mep_systems():
    return {"systems": list(MEP_PRESETS.values())}
