"""
Evaluate a trained 3D agent and optionally render the path.

Usage:
    python evaluate3d.py                                  # defaults
    python evaluate3d.py --room corridor --mep duct --render
    python evaluate3d.py --episodes 5 --mep pipe
"""

from __future__ import annotations

import argparse
from pathlib import Path

from stable_baselines3 import PPO

from duct_env3d import DuctRoutingEnv3D
from mep_config import MEP_SYSTEMS
from rooms3d import SYNTHETIC_ROOMS_3D, get_room_3d

MODELS_DIR = Path(__file__).parent / "models"


def run_episode(model, env: DuctRoutingEnv3D):
    """Run one episode and return (path, total_reward, info)."""
    obs, _ = env.reset()
    total_reward = 0.0
    done = False
    info = {}

    while not done:
        action, _ = model.predict(obs, deterministic=True)
        obs, reward, terminated, truncated, info = env.step(int(action))
        total_reward += reward
        done = terminated or truncated

    return env.path, total_reward, info


def main():
    parser = argparse.ArgumentParser(description="Evaluate 3D MEP routing agent")
    parser.add_argument("--room", default="simple",
                        choices=list(SYNTHETIC_ROOMS_3D.keys()))
    parser.add_argument("--mep", default="duct",
                        choices=list(MEP_SYSTEMS.keys()))
    parser.add_argument("--episodes", type=int, default=3)
    parser.add_argument("--render", action="store_true",
                        help="Show 3D viewer for last episode")
    args = parser.parse_args()

    model_path = MODELS_DIR / f"ppo3d_{args.mep}_{args.room}"
    if not model_path.with_suffix(".zip").exists():
        print(f"No model found at {model_path}.zip -- run train3d.py first.")
        return

    mep = MEP_SYSTEMS[args.mep]
    dto = get_room_3d(args.room)
    env = DuctRoutingEnv3D(dto, mep=mep)
    model = PPO.load(str(model_path), env=env)

    last_path = None
    for ep in range(args.episodes):
        path, total_reward, info = run_episode(model, env)
        reached = info.get("reached_target", False)
        steps = info.get("steps", len(path))
        status = "REACHED TARGET" if reached else "FAILED"
        print(f"Episode {ep+1}: {status} | steps={steps} | reward={total_reward:.1f}")
        last_path = path

    if args.render and last_path:
        from viewer3d import show_static
        show_static(env.scene, last_path,
                    title=f"{args.mep} / {args.room} -- last episode")


if __name__ == "__main__":
    main()
