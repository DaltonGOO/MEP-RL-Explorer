use mep_routing_core::grid3d::*;
use mep_routing_core::mep_config::*;
use mep_routing_core::rooms::*;

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
