"""
Quick smoke test — run this to verify the env works before training.

Usage:
    python test_env.py
"""

from kindamatic_fetch import get_room, SYNTHETIC_ROOMS
from grid import build_scene, reset, step
from duct_env import DuctRoutingEnv
from render import render_grid


def test_grid_build():
    print("=== Grid Build Test ===")
    for name in SYNTHETIC_ROOMS:
        dto = get_room(name)
        scene = build_scene(dto)
        print(f"  {name:20s} -> grid {scene.width}x{scene.height}, "
              f"start={scene.start_rc}, target={scene.target_rc}")
    print()


def test_random_episode():
    print("=== Random Episode Test ===")
    dto = get_room("simple")
    env = DuctRoutingEnv(dto)
    obs, _ = env.reset()
    print(f"  obs shape: {obs.shape}, obs: {obs}")

    total_reward = 0.0
    for i in range(50):
        action = env.action_space.sample()
        obs, reward, terminated, truncated, info = env.step(action)
        total_reward += reward
        if terminated or truncated:
            print(f"  Episode ended at step {i+1}: reward={total_reward:.1f}, info={info}")
            break
    else:
        print(f"  50 steps done, reward={total_reward:.1f}")

    print()


def test_render():
    print("=== Render Test (saving to test_grid.png) ===")
    dto = get_room("multi_obstacle")
    scene = build_scene(dto)
    render_grid(scene, title="Multi-Obstacle Room", save_path="test_grid.png", show=False)
    print()


if __name__ == "__main__":
    test_grid_build()
    test_random_episode()
    test_render()
    print("All tests passed!")
