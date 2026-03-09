"""
Train an RL agent on the duct routing environment.

Usage:
    python train.py                     # train on "simple" room
    python train.py --room corridor     # train on "corridor" room
    python train.py --timesteps 200000  # train longer
"""

from __future__ import annotations

import argparse
from pathlib import Path

from stable_baselines3 import PPO
from stable_baselines3.common.env_checker import check_env

from duct_env import DuctRoutingEnv
from kindamatic_fetch import get_room

MODELS_DIR = Path(__file__).parent / "models"


def main():
    parser = argparse.ArgumentParser(description="Train duct routing agent")
    parser.add_argument("--room", default="simple",
                        choices=["simple", "corridor", "l_shaped", "multi_obstacle"],
                        help="Synthetic room to train on")
    parser.add_argument("--timesteps", type=int, default=100_000,
                        help="Total training timesteps")
    parser.add_argument("--algo", default="PPO", choices=["PPO"],
                        help="RL algorithm (only PPO for now)")
    args = parser.parse_args()

    # 1. Build environment
    dto = get_room(args.room)
    env = DuctRoutingEnv(dto)

    # Sanity-check the env
    print("Running env checker...")
    check_env(env, warn=True)
    print("Env OK.\n")

    # 2. Train
    model = PPO(
        "MlpPolicy",
        env,
        verbose=1,
        learning_rate=3e-4,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        ent_coef=0.01,
    )

    print(f"Training on '{args.room}' for {args.timesteps} steps...")
    model.learn(total_timesteps=args.timesteps)

    # 3. Save
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    save_path = MODELS_DIR / f"ppo_{args.room}"
    model.save(str(save_path))
    print(f"\nModel saved to {save_path}")


if __name__ == "__main__":
    main()
