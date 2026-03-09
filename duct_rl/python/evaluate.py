"""
Evaluate a trained agent and render its path.

Usage:
    python evaluate.py                          # default simple room
    python evaluate.py --room corridor --episodes 5
    python evaluate.py --render                 # show matplotlib window
    python evaluate.py --save-dir outputs/      # save images to disk
"""

from __future__ import annotations

import argparse
from pathlib import Path

from stable_baselines3 import PPO

from duct_env import DuctRoutingEnv
from kindamatic_fetch import get_room
from render import render_grid

MODELS_DIR = Path(__file__).parent / "models"


def run_episode(model, env: DuctRoutingEnv):
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
    parser = argparse.ArgumentParser(description="Evaluate duct routing agent")
    parser.add_argument("--room", default="simple",
                        choices=["simple", "corridor", "l_shaped", "multi_obstacle"])
    parser.add_argument("--episodes", type=int, default=3)
    parser.add_argument("--render", action="store_true",
                        help="Show matplotlib window")
    parser.add_argument("--save-dir", default=None,
                        help="Directory to save path images")
    args = parser.parse_args()

    # 1. Load model
    model_path = MODELS_DIR / f"ppo_{args.room}"
    if not model_path.with_suffix(".zip").exists():
        print(f"No model found at {model_path}.zip — run train.py first.")
        return

    dto = get_room(args.room)
    env = DuctRoutingEnv(dto)
    model = PPO.load(str(model_path), env=env)

    # 2. Run episodes
    for ep in range(args.episodes):
        path, total_reward, info = run_episode(model, env)
        reached = info.get("reached_target", False)
        steps = info.get("steps", len(path))

        status = "REACHED TARGET" if reached else "FAILED"
        print(f"Episode {ep+1}: {status} | steps={steps} | reward={total_reward:.1f}")

        save_path = None
        if args.save_dir:
            save_path = str(Path(args.save_dir) / f"episode_{ep+1}.png")

        render_grid(
            env.scene,
            path=path,
            title=f"Episode {ep+1} — {status} (reward={total_reward:.1f})",
            save_path=save_path,
            show=args.render,
        )

    if not args.render and not args.save_dir:
        print("\nTip: use --render to show plots, or --save-dir outputs/ to save images.")


if __name__ == "__main__":
    main()
