use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct Box3D {
    pub x_min: f64,
    pub y_min: f64,
    pub z_min: f64,
    pub x_max: f64,
    pub y_max: f64,
    pub z_max: f64,
}

#[wasm_bindgen]
impl Box3D {
    #[wasm_bindgen(constructor)]
    pub fn new(x_min: f64, y_min: f64, z_min: f64, x_max: f64, y_max: f64, z_max: f64) -> Self {
        Self {
            x_min,
            y_min,
            z_min,
            x_max,
            y_max,
            z_max,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeometryDTO3D {
    pub room_min: [f64; 3],
    pub room_max: [f64; 3],
    pub obstacles: Vec<Box3D>,
    pub start: [f64; 3],
    pub target: [f64; 3],
}

/// Immutable voxel scene — built once, used for all episodes.
#[derive(Debug, Clone)]
pub struct VoxelScene {
    pub nx: usize,
    pub ny: usize,
    pub nz: usize,
    pub voxels: Vec<u8>,       // flat array: voxels[iz * ny * nx + iy * nx + ix]
    pub start_ijk: [usize; 3], // (ix, iy, iz)
    pub target_ijk: [usize; 3],
    pub origin: [f64; 3],
    pub voxel_size: f64,
}

impl VoxelScene {
    #[inline]
    pub fn idx(&self, ix: usize, iy: usize, iz: usize) -> usize {
        iz * self.ny * self.nx + iy * self.nx + ix
    }

    #[inline]
    pub fn get(&self, ix: usize, iy: usize, iz: usize) -> u8 {
        self.voxels[self.idx(ix, iy, iz)]
    }
}

/// Mutable per-episode state.
#[derive(Debug, Clone)]
pub struct EnvState3D {
    pub ix: usize,
    pub iy: usize,
    pub iz: usize,
    pub prev_action: i32, // -1 = no previous
    pub steps: u32,
    pub visited: std::collections::HashSet<(usize, usize, usize)>,
    pub straight_run: u32,
}

/// Per-component reward breakdown for visualization.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[wasm_bindgen]
pub struct RewardBreakdown {
    pub step_penalty: f64,
    pub distance_delta: f64,
    pub turn_penalty: f64,
    pub vertical_penalty: f64,
    pub revisit_penalty: f64,
    pub collision_penalty: f64,
    pub target_bonus: f64,
    pub total: f64,
}

/// Result of a single step.
#[derive(Debug, Clone)]
pub struct StepResult3D {
    pub state: EnvState3D,
    pub reward: f64,
    pub done: bool,
    pub reached_target: bool,
    pub hit_obstacle: bool,
    pub bend_rejected: bool,
    pub breakdown: RewardBreakdown,
}
