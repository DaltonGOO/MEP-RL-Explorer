from __future__ import annotations

from pydantic import BaseModel


class MEPConfigSchema(BaseModel):
    name: str = "duct"
    cross_section_mm: float = 400.0
    clearance_m: float = 0.15
    voxel_size_m: float = 0.3
    reward_target: float = 100.0
    reward_step: float = -1.0
    reward_collision: float = -5.0
    reward_turn_horizontal: float = -0.5
    reward_turn_vertical: float = -2.0
    reward_vertical_per_voxel: float = -0.3
    reward_revisit: float = -2.0
    max_steps: int = 300
    min_straight_before_bend: int = 0


class ObstacleBoxSchema(BaseModel):
    x_min: float
    y_min: float
    z_min: float
    x_max: float
    y_max: float
    z_max: float


class CustomGeometry(BaseModel):
    room_min: tuple[float, float, float]
    room_max: tuple[float, float, float]
    obstacles: list[ObstacleBoxSchema]
    start: tuple[float, float, float]
    target: tuple[float, float, float]


class TrainRequest(BaseModel):
    room: str | None = "simple"
    geometry: CustomGeometry | None = None
    mep: MEPConfigSchema = MEPConfigSchema()
    timesteps: int = 50000
    learning_rate: float = 3e-4
    n_steps: int = 2048
    batch_size: int = 64
    # Omit to have one chosen and recorded, so a good run can be repeated.
    seed: int | None = None


class TrainStatus(BaseModel):
    job_id: str
    status: str  # "running", "completed", "failed", "cancelled"
    progress: float  # 0.0 to 1.0
    timestep: int = 0
    total_timesteps: int = 0


class ModelInfo(BaseModel):
    model_id: str
    room: str
    mep_name: str
    timesteps: int
    filename: str
