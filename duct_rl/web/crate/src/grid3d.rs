use crate::mep_config::MEPConfig;
use crate::types::*;

// Actions: 0=+X, 1=-X, 2=+Y, 3=-Y, 4=+Z(up), 5=-Z(down)
const DELTAS: [(i32, i32, i32); 6] = [
    (1, 0, 0),
    (-1, 0, 0),
    (0, 1, 0),
    (0, -1, 0),
    (0, 0, 1),
    (0, 0, -1),
];

#[inline]
fn is_vertical(action: u8) -> bool {
    action >= 4
}

pub fn build_scene(dto: &GeometryDTO3D, mep: &MEPConfig) -> VoxelScene {
    let vs = mep.voxel_size_m;
    let clearance = mep.clearance_m;

    let [ox, oy, oz] = dto.room_min;
    let [rx, ry, rz] = dto.room_max;

    let nx = ((rx - ox) / vs).ceil().max(1.0) as usize;
    let ny = ((ry - oy) / vs).ceil().max(1.0) as usize;
    let nz = ((rz - oz) / vs).ceil().max(1.0) as usize;

    let mut voxels = vec![0u8; nz * ny * nx];

    // Rasterize obstacles with clearance inflation
    for obs in &dto.obstacles {
        let bx0 = obs.x_min - clearance;
        let by0 = obs.y_min - clearance;
        let bz0 = obs.z_min - clearance;
        let bx1 = obs.x_max + clearance;
        let by1 = obs.y_max + clearance;
        let bz1 = obs.z_max + clearance;

        let ix0 = ((bx0 - ox) / vs).floor().max(0.0) as usize;
        let iy0 = ((by0 - oy) / vs).floor().max(0.0) as usize;
        let iz0 = ((bz0 - oz) / vs).floor().max(0.0) as usize;
        let ix1 = ((bx1 - ox) / vs).ceil().min(nx as f64) as usize;
        let iy1 = ((by1 - oy) / vs).ceil().min(ny as f64) as usize;
        let iz1 = ((bz1 - oz) / vs).ceil().min(nz as f64) as usize;

        for iz in iz0..iz1 {
            for iy in iy0..iy1 {
                for ix in ix0..ix1 {
                    voxels[iz * ny * nx + iy * nx + ix] = 1;
                }
            }
        }
    }

    // World to voxel index
    let w2i = |wx: f64, wy: f64, wz: f64| -> [usize; 3] {
        let ix = ((wx - ox) / vs).floor().max(0.0).min((nx - 1) as f64) as usize;
        let iy = ((wy - oy) / vs).floor().max(0.0).min((ny - 1) as f64) as usize;
        let iz = ((wz - oz) / vs).floor().max(0.0).min((nz - 1) as f64) as usize;
        [ix, iy, iz]
    };

    let start_ijk = w2i(dto.start[0], dto.start[1], dto.start[2]);
    let target_ijk = w2i(dto.target[0], dto.target[1], dto.target[2]);

    // Ensure start/target are not obstacles
    voxels[start_ijk[2] * ny * nx + start_ijk[1] * nx + start_ijk[0]] = 2;
    voxels[target_ijk[2] * ny * nx + target_ijk[1] * nx + target_ijk[0]] = 3;

    VoxelScene {
        nx,
        ny,
        nz,
        voxels,
        start_ijk,
        target_ijk,
        origin: [ox, oy, oz],
        voxel_size: vs,
    }
}

pub fn reset(scene: &VoxelScene) -> EnvState3D {
    let [ix, iy, iz] = scene.start_ijk;
    let mut visited = std::collections::HashSet::new();
    visited.insert((ix, iy, iz));
    EnvState3D {
        ix,
        iy,
        iz,
        prev_action: -1,
        steps: 0,
        visited,
        straight_run: 0,
    }
}

pub fn step(
    scene: &VoxelScene,
    state: &mut EnvState3D,
    action: u8,
    mep: &MEPConfig,
) -> StepResult3D {
    let (dx, dy, dz) = DELTAS[action as usize];
    let nix = state.ix as i32 + dx;
    let niy = state.iy as i32 + dy;
    let niz = state.iz as i32 + dz;
    state.steps += 1;

    let mut breakdown = RewardBreakdown::default();
    let mut _hit_obstacle = false;
    let mut _reached_target = false;
    let mut _bend_rejected = false;

    // Bend constraint
    if mep.min_straight_before_bend > 0
        && state.prev_action >= 0
        && action as i32 != state.prev_action
        && state.straight_run < mep.min_straight_before_bend
    {
        _bend_rejected = true;
        breakdown.step_penalty = mep.reward_step;
        breakdown.total = mep.reward_step;
        let done = state.steps >= mep.max_steps;
        return StepResult3D {
            state: state.clone(),
            reward: breakdown.total,
            done,
            reached_target: false,
            hit_obstacle: false,
            bend_rejected: true,
            breakdown,
        };
    }

    // Out of bounds
    if nix < 0
        || nix >= scene.nx as i32
        || niy < 0
        || niy >= scene.ny as i32
        || niz < 0
        || niz >= scene.nz as i32
    {
        _hit_obstacle = true;
        state.prev_action = action as i32;
        state.straight_run = 0;
        breakdown.collision_penalty = mep.reward_collision;
        breakdown.total = mep.reward_collision;
        let done = state.steps >= mep.max_steps;
        return StepResult3D {
            state: state.clone(),
            reward: breakdown.total,
            done,
            reached_target: false,
            hit_obstacle: true,
            bend_rejected: false,
            breakdown,
        };
    }

    let nix = nix as usize;
    let niy = niy as usize;
    let niz = niz as usize;

    // Obstacle check
    let cell = scene.get(nix, niy, niz);
    if cell == 1 {
        _hit_obstacle = true;
        state.prev_action = action as i32;
        state.straight_run = 0;
        breakdown.collision_penalty = mep.reward_collision;
        breakdown.total = mep.reward_collision;
        let done = state.steps >= mep.max_steps;
        return StepResult3D {
            state: state.clone(),
            reward: breakdown.total,
            done,
            reached_target: false,
            hit_obstacle: true,
            bend_rejected: false,
            breakdown,
        };
    }

    // Valid move — distance shaping
    let old_dist = (state.ix as i32 - scene.target_ijk[0] as i32).unsigned_abs()
        + (state.iy as i32 - scene.target_ijk[1] as i32).unsigned_abs()
        + (state.iz as i32 - scene.target_ijk[2] as i32).unsigned_abs();
    let new_dist = (nix as i32 - scene.target_ijk[0] as i32).unsigned_abs()
        + (niy as i32 - scene.target_ijk[1] as i32).unsigned_abs()
        + (niz as i32 - scene.target_ijk[2] as i32).unsigned_abs();
    let dist_reward = old_dist as f64 - new_dist as f64;

    breakdown.step_penalty = mep.reward_step;
    breakdown.distance_delta = dist_reward;
    let mut reward = mep.reward_step + dist_reward;

    // Turn penalties
    if state.prev_action >= 0 && action as i32 != state.prev_action {
        let prev_vert = is_vertical(state.prev_action as u8);
        let curr_vert = is_vertical(action);
        if prev_vert != curr_vert {
            breakdown.turn_penalty = mep.reward_turn_vertical;
            reward += mep.reward_turn_vertical;
        } else {
            breakdown.turn_penalty = mep.reward_turn_horizontal;
            reward += mep.reward_turn_horizontal;
        }
    }

    // Vertical penalty
    if is_vertical(action) {
        breakdown.vertical_penalty = mep.reward_vertical_per_voxel;
        reward += mep.reward_vertical_per_voxel;
    }

    // Revisit penalty
    let pos = (nix, niy, niz);
    if state.visited.contains(&pos) {
        breakdown.revisit_penalty = mep.reward_revisit;
        reward += mep.reward_revisit;
    }

    // Update state
    state.ix = nix;
    state.iy = niy;
    state.iz = niz;
    state.visited.insert(pos);

    if action as i32 == state.prev_action {
        state.straight_run += 1;
    } else {
        state.straight_run = 1;
    }
    state.prev_action = action as i32;

    // Reached target?
    if cell == 3 {
        _reached_target = true;
        breakdown.target_bonus = mep.reward_target;
        breakdown.total = mep.reward_target;
        return StepResult3D {
            state: state.clone(),
            reward: mep.reward_target,
            done: true,
            reached_target: true,
            hit_obstacle: false,
            bend_rejected: false,
            breakdown,
        };
    }

    breakdown.total = reward;
    let done = state.steps >= mep.max_steps;

    StepResult3D {
        state: state.clone(),
        reward,
        done,
        reached_target: false,
        hit_obstacle: false,
        bend_rejected: false,
        breakdown,
    }
}

pub fn get_neighbors(scene: &VoxelScene, ix: usize, iy: usize, iz: usize) -> [u8; 6] {
    let mut result = [1u8; 6]; // default to obstacle (out of bounds)
    for (i, (dx, dy, dz)) in DELTAS.iter().enumerate() {
        let nx = ix as i32 + dx;
        let ny = iy as i32 + dy;
        let nz = iz as i32 + dz;
        if nx >= 0
            && (nx as usize) < scene.nx
            && ny >= 0
            && (ny as usize) < scene.ny
            && nz >= 0
            && (nz as usize) < scene.nz
        {
            result[i] = scene.get(nx as usize, ny as usize, nz as usize);
        }
    }
    result
}

pub fn compute_obs(scene: &VoxelScene, state: &EnvState3D) -> [f32; 12] {
    let x_norm = state.ix as f32 / (scene.nx - 1).max(1) as f32;
    let y_norm = state.iy as f32 / (scene.ny - 1).max(1) as f32;
    let z_norm = state.iz as f32 / (scene.nz - 1).max(1) as f32;

    let dx = (scene.target_ijk[0] as f32 - state.ix as f32) / (scene.nx - 1).max(1) as f32;
    let dy = (scene.target_ijk[1] as f32 - state.iy as f32) / (scene.ny - 1).max(1) as f32;
    let dz = (scene.target_ijk[2] as f32 - state.iz as f32) / (scene.nz - 1).max(1) as f32;

    let neighbors = get_neighbors(scene, state.ix, state.iy, state.iz);
    let n_scaled: Vec<f32> = neighbors.iter().map(|&v| v as f32 / 3.0).collect();

    [
        x_norm,
        y_norm,
        z_norm,
        dx,
        dy,
        dz,
        n_scaled[0],
        n_scaled[1],
        n_scaled[2],
        n_scaled[3],
        n_scaled[4],
        n_scaled[5],
    ]
}
