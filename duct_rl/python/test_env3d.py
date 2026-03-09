"""
Smoke tests for the 3D MEP routing environment.

Usage:
    python test_env3d.py
"""

from grid3d import build_scene, reset, step, get_neighbors_3d
from rooms3d import SYNTHETIC_ROOMS_3D, get_room_3d
from mep_config import MEP_SYSTEMS, DUCT
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
    assert obs.shape == (12,), f"Expected (12,), got {obs.shape}"

    # Take a few steps
    total_reward = 0.0
    for i in range(50):
        action = env.action_space.sample()
        obs, reward, terminated, truncated, info = env.step(action)
        total_reward += reward
        assert obs.shape == (12,)
        if terminated or truncated:
            print(f"  Episode ended at step {i+1}: reward={total_reward:.1f}, "
                  f"info={info}")
            break
    else:
        print(f"  50 steps done, reward={total_reward:.1f}")
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
    test_env_checker()
    test_all_rooms_all_mep()
    print("All 3D tests passed!")
