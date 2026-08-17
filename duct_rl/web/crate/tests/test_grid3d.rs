use mep_routing_core::grid3d::*;
use mep_routing_core::mep_config::*;
use mep_routing_core::rooms::*;
use mep_routing_core::types::GeometryDTO3D;

/// Sum of the per-component fields, which must always equal `total`.
fn breakdown_sum(b: &mep_routing_core::types::RewardBreakdown) -> f64 {
    b.step_penalty
        + b.distance_delta
        + b.turn_penalty
        + b.vertical_penalty
        + b.revisit_penalty
        + b.collision_penalty
        + b.target_bonus
}

#[test]
fn test_reward_breakdown_sums_on_every_step() {
    // The old test only checked the first step of one episode, which is why
    // it never caught the target branch reporting components it didn't award.
    let meps = [preset_duct(), preset_pipe(), preset_cable_tray()];
    for name in room_names() {
        for mep in &meps {
            let scene = build_scene(&get_room(name).unwrap(), mep);
            let mut state = reset(&scene);
            for i in 0..150u32 {
                let result = step(&scene, &mut state, (i % 6) as u8, mep);
                let b = &result.breakdown;
                assert!(
                    (b.total - breakdown_sum(b)).abs() < 1e-10,
                    "{name}/{i}: components sum to {} but total is {}",
                    breakdown_sum(b),
                    b.total
                );
                assert!(
                    (b.total - result.reward).abs() < 1e-10,
                    "{name}/{i}: breakdown total {} != awarded reward {}",
                    b.total,
                    result.reward
                );
                if result.done {
                    break;
                }
            }
        }
    }
}

#[test]
fn test_reward_breakdown_on_the_winning_step() {
    // None of the preset rooms are winnable by a fixed action sequence, so
    // the step that reaches the target — the one branch that was wrong —
    // needs a room small enough to cross in a straight line.
    let mep = preset_duct();
    let dto = GeometryDTO3D {
        room_min: [0.0, 0.0, 0.0],
        room_max: [3.0, 3.0, 3.0],
        obstacles: vec![],
        start: [0.2, 0.2, 0.2],
        target: [1.0, 0.2, 0.2],
    };
    let scene = build_scene(&dto, &mep);
    let mut state = reset(&scene);

    let mut reached = false;
    for _ in 0..20 {
        let result = step(&scene, &mut state, 0, &mep); // straight +X
        let b = &result.breakdown;
        assert!(
            (b.total - breakdown_sum(b)).abs() < 1e-10,
            "components sum to {} but total is {}",
            breakdown_sum(b),
            b.total
        );
        if result.reached_target {
            reached = true;
            // The whole reward on this step is the target bonus.
            assert_eq!(b.target_bonus, mep.reward_target);
            assert_eq!(b.total, mep.reward_target);
            assert_eq!(result.reward, mep.reward_target);
            // Nothing else may be reported — it wasn't awarded.
            assert_eq!(b.step_penalty, 0.0, "step penalty was not awarded");
            assert_eq!(b.distance_delta, 0.0, "distance delta was not awarded");
            assert_eq!(b.turn_penalty, 0.0);
            assert_eq!(b.vertical_penalty, 0.0);
            assert_eq!(b.revisit_penalty, 0.0);
            assert_eq!(b.collision_penalty, 0.0);
            break;
        }
    }
    assert!(
        reached,
        "test needs an episode that actually reaches the target"
    );
}

#[test]
fn test_obs_has_expected_width() {
    let mep = preset_duct();
    let scene = build_scene(&get_room("simple").unwrap(), &mep);
    let state = reset(&scene);
    assert_eq!(compute_obs(&scene, &state, &mep).len(), OBS_DIM);
}

#[test]
fn test_reward_state_is_observable() {
    // Turn penalties depend on prev_action, the bend constraint on
    // straight_run, and the revisit penalty on visited. All three must be
    // visible to the agent.
    let mep = preset_pipe(); // min_straight_before_bend = 2
    let scene = build_scene(&get_room("simple").unwrap(), &mep);
    let mut state = reset(&scene);

    // Fresh episode: no previous action, so a bend is trivially allowed.
    let obs = compute_obs(&scene, &state, &mep);
    assert_eq!(obs[12..18].iter().sum::<f32>(), 0.0);
    assert_eq!(obs[19], 1.0);
    assert!(bend_allowed(&state, &mep));

    // One step of +X: the one-hot lights up and pipe cannot bend yet.
    step(&scene, &mut state, 0, &mep);
    let obs = compute_obs(&scene, &state, &mep);
    assert_eq!(obs[12], 1.0, "prev_action=+X is one-hot at index 12");
    assert_eq!(obs[12..18].iter().sum::<f32>(), 1.0);
    assert!((obs[18] - 0.1).abs() < 1e-6, "straight_run=1 scaled");
    assert_eq!(obs[19], 0.0, "pipe cannot bend after one straight voxel");
    assert!(!bend_allowed(&state, &mep));

    // A second +X satisfies min_straight_before_bend.
    step(&scene, &mut state, 0, &mep);
    let obs = compute_obs(&scene, &state, &mep);
    assert!((obs[18] - 0.2).abs() < 1e-6, "straight_run=2 scaled");
    assert_eq!(obs[19], 1.0, "pipe can bend after two straight voxels");
    assert!(bend_allowed(&state, &mep));

    // The voxel behind us is visited; the one ahead is not.
    assert_eq!(obs[21], 1.0, "-X neighbor was visited");
    assert_eq!(obs[20], 0.0, "+X neighbor has not been visited");
}

#[test]
fn test_obs_stays_in_declared_bounds() {
    let meps = [preset_duct(), preset_pipe(), preset_cable_tray()];
    for name in room_names() {
        for mep in &meps {
            let scene = build_scene(&get_room(name).unwrap(), mep);
            let mut state = reset(&scene);
            for i in 0..120u32 {
                let obs = compute_obs(&scene, &state, mep);
                for (j, v) in obs.iter().enumerate() {
                    assert!(
                        (-1.0..=1.0).contains(v),
                        "{name}/{i}: obs[{j}] = {v} is outside [-1, 1]"
                    );
                }
                if step(&scene, &mut state, (i % 6) as u8, mep).done {
                    break;
                }
            }
        }
    }
}

/// Replays the action sequences recorded by duct_rl/python/gen_obs_parity.py
/// and compares observations against the Python implementation.
///
/// The Python suite runs the same check against the same file. If one side
/// changes without the other, one of the two suites fails.
#[test]
fn test_obs_parity_fixture() {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../testdata/obs_parity.json"
    );
    let raw = std::fs::read_to_string(path).unwrap_or_else(|e| panic!("cannot read {path}: {e}"));
    let fixture: serde_json::Value = serde_json::from_str(&raw).expect("invalid fixture JSON");

    assert_eq!(
        fixture["obs_dim"].as_u64().unwrap() as usize,
        OBS_DIM,
        "fixture obs_dim does not match this build — regenerate with: \
         python gen_obs_parity.py"
    );

    for spec in fixture["scenarios"].as_array().unwrap() {
        let room = spec["room"].as_str().unwrap();
        let mep_name = spec["mep"].as_str().unwrap();
        let mep = preset_by_name(mep_name).unwrap_or_else(|| panic!("unknown preset {mep_name}"));
        let scene = build_scene(&get_room(room).unwrap(), &mep);
        let mut state = reset(&scene);

        let expected = spec["obs"].as_array().unwrap();
        let actions = spec["actions"].as_array().unwrap();

        // Index 0 is the observation at reset; index i+1 follows actions[i].
        let mut actual = vec![compute_obs(&scene, &state, &mep)];
        for action in actions {
            step(&scene, &mut state, action.as_u64().unwrap() as u8, &mep);
            actual.push(compute_obs(&scene, &state, &mep));
        }

        assert_eq!(
            actual.len(),
            expected.len(),
            "{room}/{mep_name}: step count"
        );
        for (i, (want, got)) in expected.iter().zip(actual.iter()).enumerate() {
            let want = want.as_array().unwrap();
            for (j, (a, b)) in want.iter().zip(got.iter()).enumerate() {
                let a = a.as_f64().unwrap() as f32;
                assert!(
                    (a - b).abs() < 1e-6,
                    "{room}/{mep_name} step {i} index {j}: python={a}, rust={b}"
                );
            }
        }
    }
}

#[test]
fn test_build_all_rooms() {
    let mep = preset_duct();
    for name in room_names() {
        let dto = get_room(name).unwrap();
        let scene = build_scene(&dto, &mep);
        assert!(scene.nx > 0);
        assert!(scene.ny > 0);
        assert!(scene.nz > 0);
        // Start and target should be placed
        assert_eq!(
            scene.get(scene.start_ijk[0], scene.start_ijk[1], scene.start_ijk[2]),
            2
        );
        assert_eq!(
            scene.get(
                scene.target_ijk[0],
                scene.target_ijk[1],
                scene.target_ijk[2]
            ),
            3
        );
    }
}

#[test]
fn test_reset_and_step() {
    let mep = preset_duct();
    let dto = get_room("simple").unwrap();
    let scene = build_scene(&dto, &mep);
    let mut state = reset(&scene);

    assert_eq!(state.ix, scene.start_ijk[0]);
    assert_eq!(state.iy, scene.start_ijk[1]);
    assert_eq!(state.iz, scene.start_ijk[2]);

    // Take a step in +X direction
    let result = step(&scene, &mut state, 0, &mep);
    assert!(!result.done || result.reached_target);
    assert!(result.breakdown.step_penalty < 0.0);
}

#[test]
fn test_random_episode() {
    let mep = preset_duct();
    let dto = get_room("simple").unwrap();
    let scene = build_scene(&dto, &mep);
    let mut state = reset(&scene);

    let mut total_reward = 0.0;
    for i in 0..300 {
        let action = (i % 6) as u8;
        let result = step(&scene, &mut state, action, &mep);
        total_reward += result.reward;
        if result.done {
            break;
        }
    }
    // Just verify it ran without panicking
    assert!(total_reward.is_finite());
}

#[test]
fn test_neighbors() {
    let mep = preset_duct();
    let dto = get_room("simple").unwrap();
    let scene = build_scene(&dto, &mep);
    let neighbors = get_neighbors(&scene, 0, 0, 0);
    // At corner (0,0,0), -X/-Y/-Z neighbors should be obstacles (out of bounds = 1)
    assert_eq!(neighbors[1], 1); // -X
    assert_eq!(neighbors[3], 1); // -Y
    assert_eq!(neighbors[5], 1); // -Z
}

#[test]
fn test_all_rooms_all_mep() {
    let meps = [preset_duct(), preset_pipe(), preset_cable_tray()];
    for name in room_names() {
        for mep in &meps {
            let dto = get_room(name).unwrap();
            let scene = build_scene(&dto, mep);
            let mut state = reset(&scene);
            // Run a few steps
            for i in 0..10 {
                let result = step(&scene, &mut state, (i % 6) as u8, mep);
                if result.done {
                    break;
                }
            }
        }
    }
}

#[test]
fn test_reward_breakdown() {
    let mep = preset_duct();
    let dto = get_room("simple").unwrap();
    let scene = build_scene(&dto, &mep);
    let mut state = reset(&scene);

    let result = step(&scene, &mut state, 0, &mep);
    let b = &result.breakdown;
    // Total should equal sum of components
    let sum = b.step_penalty
        + b.distance_delta
        + b.turn_penalty
        + b.vertical_penalty
        + b.revisit_penalty
        + b.collision_penalty
        + b.target_bonus;
    assert!((b.total - sum).abs() < 1e-10);
}
