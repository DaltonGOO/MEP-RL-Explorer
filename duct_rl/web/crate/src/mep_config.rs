use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct MEPConfig {
    pub cross_section_mm: f64,
    pub clearance_m: f64,
    pub voxel_size_m: f64,
    pub reward_target: f64,
    pub reward_step: f64,
    pub reward_collision: f64,
    pub reward_turn_horizontal: f64,
    pub reward_turn_vertical: f64,
    pub reward_vertical_per_voxel: f64,
    pub reward_revisit: f64,
    pub max_steps: u32,
    pub min_straight_before_bend: u32,
}

#[wasm_bindgen]
impl MEPConfig {
    // The parameter list mirrors the struct fields one-for-one; wasm_bindgen
    // constructors can't take a struct literal from JS.
    #[allow(clippy::too_many_arguments)]
    #[wasm_bindgen(constructor)]
    pub fn new(
        cross_section_mm: f64,
        clearance_m: f64,
        voxel_size_m: f64,
        reward_target: f64,
        reward_step: f64,
        reward_collision: f64,
        reward_turn_horizontal: f64,
        reward_turn_vertical: f64,
        reward_vertical_per_voxel: f64,
        reward_revisit: f64,
        max_steps: u32,
        min_straight_before_bend: u32,
    ) -> Self {
        Self {
            cross_section_mm,
            clearance_m,
            voxel_size_m,
            reward_target,
            reward_step,
            reward_collision,
            reward_turn_horizontal,
            reward_turn_vertical,
            reward_vertical_per_voxel,
            reward_revisit,
            max_steps,
            min_straight_before_bend,
        }
    }

    pub fn name(&self) -> String {
        if self.min_straight_before_bend >= 2 {
            "pipe".into()
        } else if self.cross_section_mm > 350.0 && self.reward_turn_horizontal > -0.4 {
            "cable_tray".into()
        } else {
            "duct".into()
        }
    }
}

/// Look up a preset by the same key the Python side uses in `MEP_SYSTEMS`.
pub fn preset_by_name(name: &str) -> Option<MEPConfig> {
    match name {
        "duct" => Some(preset_duct()),
        "pipe" => Some(preset_pipe()),
        "cable_tray" => Some(preset_cable_tray()),
        _ => None,
    }
}

// Preset constructors
#[wasm_bindgen]
pub fn preset_duct() -> MEPConfig {
    MEPConfig {
        cross_section_mm: 400.0,
        clearance_m: 0.15,
        voxel_size_m: 0.3,
        reward_target: 100.0,
        reward_step: -1.0,
        reward_collision: -5.0,
        reward_turn_horizontal: -0.5,
        reward_turn_vertical: -2.0,
        reward_vertical_per_voxel: -0.3,
        reward_revisit: -2.0,
        max_steps: 300,
        min_straight_before_bend: 0,
    }
}

#[wasm_bindgen]
pub fn preset_pipe() -> MEPConfig {
    MEPConfig {
        cross_section_mm: 100.0,
        clearance_m: 0.05,
        voxel_size_m: 0.2,
        reward_target: 100.0,
        reward_step: -1.0,
        reward_collision: -5.0,
        reward_turn_horizontal: -1.0,
        reward_turn_vertical: -3.0,
        reward_vertical_per_voxel: -0.5,
        reward_revisit: -2.0,
        max_steps: 400,
        min_straight_before_bend: 2,
    }
}

#[wasm_bindgen]
pub fn preset_cable_tray() -> MEPConfig {
    MEPConfig {
        cross_section_mm: 300.0,
        clearance_m: 0.10,
        voxel_size_m: 0.3,
        reward_target: 100.0,
        reward_step: -0.5,
        reward_collision: -5.0,
        reward_turn_horizontal: -0.3,
        reward_turn_vertical: -1.0,
        reward_vertical_per_voxel: -0.2,
        reward_revisit: -1.5,
        max_steps: 300,
        min_straight_before_bend: 0,
    }
}
