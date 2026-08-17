pub mod grid3d;
pub mod inference;
pub mod mep_config;
pub mod rooms;
pub mod types;

use wasm_bindgen::prelude::*;

use grid3d as g;
use inference::{MLPWeights, SimpleMLP};
use mep_config::MEPConfig;
use types::*;

// Internal state held in WASM memory (not exposed directly to JS).
// JS interacts through opaque handle IDs.
use std::cell::RefCell;
use std::collections::HashMap;

// clippy wants `const { .. }` initializers here, but `HashMap::new` is not
// const-callable (RandomState::new isn't), so only NEXT_ID can take one.
thread_local! {
    #[allow(clippy::missing_const_for_thread_local)]
    static SCENES: RefCell<HashMap<u32, VoxelScene>> = RefCell::new(HashMap::new());
    #[allow(clippy::missing_const_for_thread_local)]
    static STATES: RefCell<HashMap<u32, EnvState3D>> = RefCell::new(HashMap::new());
    #[allow(clippy::missing_const_for_thread_local)]
    static MODELS: RefCell<HashMap<u32, SimpleMLP>> = RefCell::new(HashMap::new());
    static NEXT_ID: RefCell<u32> = const { RefCell::new(1) };
}

fn next_id() -> u32 {
    NEXT_ID.with(|id| {
        let current = *id.borrow();
        *id.borrow_mut() = current + 1;
        current
    })
}

// ── Room listing ────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn list_rooms() -> JsValue {
    serde_wasm_bindgen::to_value(&rooms::room_names()).unwrap()
}

// ── Scene management ────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn create_scene(room_name: &str, mep: &MEPConfig) -> u32 {
    let dto = rooms::get_room(room_name).expect("Unknown room name");
    let scene = g::build_scene(&dto, mep);
    let id = next_id();
    SCENES.with(|s| s.borrow_mut().insert(id, scene));
    id
}

#[wasm_bindgen]
pub fn create_scene_from_json(geometry_json: &str, mep: &MEPConfig) -> u32 {
    let dto: GeometryDTO3D = serde_json::from_str(geometry_json).expect("Invalid geometry JSON");
    let scene = g::build_scene(&dto, mep);
    let id = next_id();
    SCENES.with(|s| s.borrow_mut().insert(id, scene));
    id
}

#[wasm_bindgen]
pub fn get_scene_info(scene_id: u32) -> JsValue {
    SCENES.with(|s| {
        let scenes = s.borrow();
        let scene = scenes.get(&scene_id).expect("Invalid scene ID");

        let info = serde_json::json!({
            "nx": scene.nx,
            "ny": scene.ny,
            "nz": scene.nz,
            "voxel_size": scene.voxel_size,
            "origin": scene.origin,
            "start_ijk": scene.start_ijk,
            "target_ijk": scene.target_ijk,
        });
        serde_wasm_bindgen::to_value(&info).unwrap()
    })
}

#[wasm_bindgen]
pub fn get_voxels(scene_id: u32) -> Vec<u8> {
    SCENES.with(|s| {
        let scenes = s.borrow();
        let scene = scenes.get(&scene_id).expect("Invalid scene ID");
        scene.voxels.clone()
    })
}

#[wasm_bindgen]
pub fn get_obstacle_positions(scene_id: u32) -> Vec<f32> {
    SCENES.with(|s| {
        let scenes = s.borrow();
        let scene = scenes.get(&scene_id).expect("Invalid scene ID");
        let mut positions = Vec::new();
        let vs = scene.voxel_size;
        let [ox, oy, oz] = scene.origin;

        for iz in 0..scene.nz {
            for iy in 0..scene.ny {
                for ix in 0..scene.nx {
                    if scene.get(ix, iy, iz) == 1 {
                        positions.push((ox + (ix as f64 + 0.5) * vs) as f32);
                        positions.push((oy + (iy as f64 + 0.5) * vs) as f32);
                        positions.push((oz + (iz as f64 + 0.5) * vs) as f32);
                    }
                }
            }
        }
        positions
    })
}

// ── Episode management ──────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn reset_episode(scene_id: u32) -> u32 {
    SCENES.with(|s| {
        let scenes = s.borrow();
        let scene = scenes.get(&scene_id).expect("Invalid scene ID");
        let state = g::reset(scene);
        let id = next_id();
        STATES.with(|st| st.borrow_mut().insert(id, state));
        id
    })
}

#[wasm_bindgen]
pub fn step_episode(scene_id: u32, state_id: u32, action: u8, mep: &MEPConfig) -> JsValue {
    SCENES.with(|s| {
        let scenes = s.borrow();
        let scene = scenes.get(&scene_id).expect("Invalid scene ID");

        STATES.with(|st| {
            let mut states = st.borrow_mut();
            let state = states.get_mut(&state_id).expect("Invalid state ID");

            let result = g::step(scene, state, action, mep);

            // Update the stored state
            *state = result.state;

            let obs = g::compute_obs(scene, &states[&state_id], mep);

            let info = serde_json::json!({
                "reward": result.reward,
                "done": result.done,
                "reached_target": result.reached_target,
                "hit_obstacle": result.hit_obstacle,
                "bend_rejected": result.bend_rejected,
                "position": [states[&state_id].ix, states[&state_id].iy, states[&state_id].iz],
                "steps": states[&state_id].steps,
                "obs": obs.to_vec(),
                "breakdown": {
                    "step_penalty": result.breakdown.step_penalty,
                    "distance_delta": result.breakdown.distance_delta,
                    "turn_penalty": result.breakdown.turn_penalty,
                    "vertical_penalty": result.breakdown.vertical_penalty,
                    "revisit_penalty": result.breakdown.revisit_penalty,
                    "collision_penalty": result.breakdown.collision_penalty,
                    "target_bonus": result.breakdown.target_bonus,
                    "total": result.breakdown.total,
                },
            });
            serde_wasm_bindgen::to_value(&info).unwrap()
        })
    })
}

#[wasm_bindgen]
pub fn get_state_position(state_id: u32) -> Vec<u32> {
    STATES.with(|st| {
        let states = st.borrow();
        let state = states.get(&state_id).expect("Invalid state ID");
        vec![state.ix as u32, state.iy as u32, state.iz as u32]
    })
}

#[wasm_bindgen]
pub fn get_obs(scene_id: u32, state_id: u32, mep: &MEPConfig) -> Vec<f32> {
    SCENES.with(|s| {
        let scenes = s.borrow();
        let scene = scenes.get(&scene_id).expect("Invalid scene ID");

        STATES.with(|st| {
            let states = st.borrow();
            let state = states.get(&state_id).expect("Invalid state ID");
            g::compute_obs(scene, state, mep).to_vec()
        })
    })
}

/// Observation width this build produces. Exposed so the frontend can tell a
/// stale model from a current one before loading it.
#[wasm_bindgen]
pub fn obs_dim() -> usize {
    g::OBS_DIM
}

// ── Model inference ─────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn load_model(weights_json: &str) -> u32 {
    let weights: MLPWeights = serde_json::from_str(weights_json).expect("Invalid model JSON");

    // A policy trained against a different observation layout would still run,
    // it would just produce meaningless actions. Reject it instead.
    let in_dim = weights
        .layers
        .first()
        .and_then(|l| l.weights.first())
        .map(|row| row.len())
        .unwrap_or(0);
    if in_dim != g::OBS_DIM {
        panic!(
            "model expects {}-dim observations but this build produces {} — retrain the agent",
            in_dim,
            g::OBS_DIM
        );
    }

    let mlp = SimpleMLP::from_weights(&weights);
    let id = next_id();
    MODELS.with(|m| m.borrow_mut().insert(id, mlp));
    id
}

#[wasm_bindgen]
pub fn predict_action(model_id: u32, obs: Vec<f32>) -> u8 {
    MODELS.with(|m| {
        let models = m.borrow();
        let mlp = models.get(&model_id).expect("Invalid model ID");
        mlp.predict(&obs) as u8
    })
}

// ── Cleanup ─────────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn free_scene(scene_id: u32) {
    SCENES.with(|s| s.borrow_mut().remove(&scene_id));
}

#[wasm_bindgen]
pub fn free_state(state_id: u32) {
    STATES.with(|st| st.borrow_mut().remove(&state_id));
}

#[wasm_bindgen]
pub fn free_model(model_id: u32) {
    MODELS.with(|m| m.borrow_mut().remove(&model_id));
}
