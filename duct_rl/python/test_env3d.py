"""
Smoke tests for the 3D MEP routing environment.

Usage:
    python test_env3d.py
"""

from dataclasses import replace

from grid3d import (
    OBS_DIM,
    GeometryDTO3D,
    bend_allowed,
    build_scene,
    compute_obs,
    get_neighbors_3d,
    reset,
    step,
)
from rooms3d import SYNTHETIC_ROOMS_3D, get_room_3d
from mep_config import MEP_SYSTEMS, DUCT, PIPE
from duct_env3d import DuctRoutingEnv3D


def test_grid_build():
    print("=== 3D Grid Build Test ===")
    for name in SYNTHETIC_ROOMS_3D:
        dto = get_room_3d(name)
        scene = build_scene(dto, DUCT)
        obs_count = int((scene.voxels == 1).sum())
        total = scene.nx * scene.ny * scene.nz
        print(f"  {name:20s} -> voxels {scene.nx}x{scene.ny}x{scene.nz} "
              f"({total} total, {obs_count} obstacles), "
              f"start={scene.start_ijk}, target={scene.target_ijk}")
        # Verify start and target are placed
        six, siy, siz = scene.start_ijk
        assert scene.voxels[siz, siy, six] == 2, f"Start not placed in {name}"
        tix, tiy, tiz = scene.target_ijk
        assert scene.voxels[tiz, tiy, tix] == 3, f"Target not placed in {name}"
    print()


def test_neighbors():
    print("=== 3D Neighbors Test ===")
    dto = get_room_3d("simple")
    scene = build_scene(dto, DUCT)
    neighbors = get_neighbors_3d(scene, *scene.start_ijk)
    print(f"  Neighbors at start: {neighbors}  (+X, -X, +Y, -Y, +Z, -Z)")
    assert len(neighbors) == 6
    print()


def test_random_episode():
    print("=== 3D Random Episode Test ===")
    for mep_name, mep in MEP_SYSTEMS.items():
        dto = get_room_3d("simple")
        scene = build_scene(dto, mep)
        state = reset(scene)

        total_reward = 0.0
        for i in range(100):
            import random
            action = random.randint(0, 5)
            result = step(scene, state, action, mep)
            state = result.state
            total_reward += result.reward
            if result.done:
                status = "target" if result.info.get("reached_target") else "timeout"
                print(f"  {mep_name:12s}: ended at step {i+1} ({status}), "
                      f"reward={total_reward:.1f}")
                break
        else:
            print(f"  {mep_name:12s}: 100 steps, reward={total_reward:.1f}")
    print()


def test_env_wrapper():
    print("=== 3D Env Wrapper Test ===")
    dto = get_room_3d("simple")
    env = DuctRoutingEnv3D(dto, mep=DUCT)
    obs, _ = env.reset()
    print(f"  obs shape: {obs.shape}, dtype: {obs.dtype}")
    assert obs.shape == (OBS_DIM,), f"Expected ({OBS_DIM},), got {obs.shape}"

    # Take a few steps
    total_reward = 0.0
    for i in range(50):
        action = env.action_space.sample()
        obs, reward, terminated, truncated, info = env.step(action)
        total_reward += reward
        assert obs.shape == (OBS_DIM,)
        if terminated or truncated:
            print(f"  Episode ended at step {i+1}: reward={total_reward:.1f}, "
                  f"info={info}")
            break
    else:
        print(f"  50 steps done, reward={total_reward:.1f}")
    print()


def test_time_limit_is_truncation():
    """Hitting max_steps must report truncated, not terminated.

    SB3 bootstraps the value estimate on truncation but not on termination,
    so getting this wrong biases the critic against long routes.
    """
    print("=== Truncation vs Termination ===")
    dto = get_room_3d("simple")
    # A step budget far too small to reach the target from the start corner.
    mep = replace(DUCT, max_steps=5)
    env = DuctRoutingEnv3D(dto, mep=mep)
    env.reset()

    for _ in range(mep.max_steps):
        obs, reward, terminated, truncated, info = env.step(0)  # always +X

    assert not info["reached_target"], "test needs a budget too small to win"
    assert truncated, "max_steps should set truncated"
    assert not terminated, "max_steps must not set terminated"
    print(f"  {mep.max_steps} steps -> terminated={terminated}, "
          f"truncated={truncated}")

    # And reaching the target is the other way round.
    dto_close = GeometryDTO3D(
        room_min=(0, 0, 0), room_max=(3, 3, 3), obstacles=[],
        start=(0.2, 0.2, 0.2), target=(1.0, 0.2, 0.2),
    )
    env2 = DuctRoutingEnv3D(dto_close, mep=DUCT)
    env2.reset()
    for _ in range(20):
        _, _, terminated, truncated, info = env2.step(0)  # +X toward target
        if terminated or truncated:
            break
    assert terminated and not truncated, \
        f"reaching target should terminate, got {terminated=} {truncated=}"
    print(f"  reached target -> terminated={terminated}, "
          f"truncated={truncated}")
    print()


def test_reward_state_is_observable():
    """The obs must expose the state the reward function reads.

    Turn penalties depend on prev_action, the bend constraint on
    straight_run, and the revisit penalty on visited. None of those were
    visible to the agent before.
    """
    print("=== Reward State Observability ===")
    dto = get_room_3d("simple")
    scene = build_scene(dto, PIPE)
    state = reset(scene)

    # Fresh episode: no previous action, so the one-hot block is all zero
    # and a bend is trivially allowed.
    obs = compute_obs(scene, state, PIPE)
    assert obs.shape == (OBS_DIM,)
    assert obs[12:18].sum() == 0.0, "no previous action should be all-zero"
    assert obs[19] == 1.0, "first move can go any direction"

    # One step of +X: prev_action one-hot lights up, straight_run is 1, and
    # pipe needs 2 straight before a bend -- so a turn is not yet allowed.
    result = step(scene, state, 0, PIPE)
    state = result.state
    obs = compute_obs(scene, state, PIPE)
    assert obs[12] == 1.0, "prev_action=+X should be one-hot at index 12"
    assert obs[12:18].sum() == 1.0, "one-hot should have exactly one bit set"
    assert abs(obs[18] - 0.1) < 1e-6, f"straight_run=1 scaled, got {obs[18]}"
    assert obs[19] == 0.0, "pipe cannot bend after a single straight voxel"
    assert not bend_allowed(state, PIPE)

    # A second +X satisfies min_straight_before_bend=2.
    result = step(scene, state, 0, PIPE)
    state = result.state
    obs = compute_obs(scene, state, PIPE)
    assert abs(obs[18] - 0.2) < 1e-6, f"straight_run=2 scaled, got {obs[18]}"
    assert obs[19] == 1.0, "pipe can bend after two straight voxels"
    assert bend_allowed(state, PIPE)

    # The voxel we came from is visited, so its -X neighbor flag is set.
    assert obs[21] == 1.0, "the voxel behind us should read as visited"
    assert obs[20] == 0.0, "the voxel ahead has not been visited"
    print("  prev_action one-hot, straight_run, bend flag, visited: OK")
    print()


def test_obs_stays_in_declared_bounds():
    print("=== Observation Bounds ===")
    import random
    for room_name in SYNTHETIC_ROOMS_3D:
        for mep in MEP_SYSTEMS.values():
            env = DuctRoutingEnv3D(get_room_3d(room_name), mep=mep)
            obs, _ = env.reset()
            for _ in range(120):
                assert env.observation_space.contains(obs), \
                    f"obs out of bounds in {room_name}: {obs}"
                obs, _, term, trunc, _ = env.step(random.randint(0, 5))
                if term or trunc:
                    break
    print("  all rooms x all systems stay within [-1, 1]")
    print()


def test_obs_parity_fixture():
    """Replay the recorded action sequences and compare observations.

    The Rust core runs the same check against the same file. If one
    implementation changes without the other, one of the two suites fails.
    Regenerate with: python gen_obs_parity.py
    """
    print("=== Observation Parity Fixture ===")
    import json
    from pathlib import Path

    path = Path(__file__).resolve().parent.parent / "testdata" / "obs_parity.json"
    with open(path) as f:
        fixture = json.load(f)

    assert fixture["obs_dim"] == OBS_DIM, (
        f"fixture is for obs_dim={fixture['obs_dim']} but this build produces "
        f"{OBS_DIM} — regenerate with: python gen_obs_parity.py"
    )

    for spec in fixture["scenarios"]:
        mep = MEP_SYSTEMS[spec["mep"]]
        scene = build_scene(get_room_3d(spec["room"]), mep)
        state = reset(scene)

        actual = [compute_obs(scene, state, mep).tolist()]
        for action in spec["actions"]:
            state = step(scene, state, action, mep).state
            actual.append(compute_obs(scene, state, mep).tolist())

        for i, (want, got) in enumerate(zip(spec["obs"], actual)):
            for j, (a, b) in enumerate(zip(want, got)):
                assert abs(a - b) < 1e-6, (
                    f"{spec['room']}/{spec['mep']} step {i} index {j}: "
                    f"expected {a}, got {b}"
                )
        print(f"  {spec['room']:14s} x {spec['mep']:11s} -> "
              f"{len(actual)} observations match")
    print()


def test_env_checker():
    print("=== SB3 Env Checker ===")
    from stable_baselines3.common.env_checker import check_env
    dto = get_room_3d("simple")
    env = DuctRoutingEnv3D(dto, mep=DUCT)
    check_env(env, warn=True)
    print("  check_env passed!")
    print()


def test_all_rooms_all_mep():
    print("=== All Rooms x All MEP Systems ===")
    for room_name in SYNTHETIC_ROOMS_3D:
        for mep_name, mep in MEP_SYSTEMS.items():
            dto = get_room_3d(room_name)
            env = DuctRoutingEnv3D(dto, mep=mep)
            obs, _ = env.reset()
            # Just verify it doesn't crash for 10 steps
            for _ in range(10):
                obs, _, term, trunc, _ = env.step(env.action_space.sample())
                if term or trunc:
                    break
            print(f"  {room_name:20s} x {mep_name:12s} -> OK")
    print()


if __name__ == "__main__":
    test_grid_build()
    test_neighbors()
    test_random_episode()
    test_env_wrapper()
    test_time_limit_is_truncation()
    test_reward_state_is_observable()
    test_obs_stays_in_declared_bounds()
    test_obs_parity_fixture()
    test_env_checker()
    test_all_rooms_all_mep()
    print("All 3D tests passed!")
