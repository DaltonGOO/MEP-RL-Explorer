"""
Train an RL agent on the 3D MEP routing environment.

Usage:
    python train3d.py                                    # defaults
    python train3d.py --room corridor --mep pipe
    python train3d.py --timesteps 200000 --mep cable_tray
"""

from __future__ import annotations

import argparse
from pathlib import Path

from stable_baselines3 import PPO
from stable_baselines3.common.env_checker import check_env

from duct_env3d import DuctRoutingEnv3D
from mep_config import MEP_SYSTEMS
from rooms3d import SYNTHETIC_ROOMS_3D, get_room_3d

MODELS_DIR = Path(__file__).parent / "models"


def main():
    parser = argparse.ArgumentParser(description="Train 3D MEP routing agent")
    parser.add_argument("--room", default="simple",
                        choices=list(SYNTHETIC_ROOMS_3D.keys()),
                        help="Synthetic 3D room")
    parser.add_argument("--mep", default="duct",
                        choices=list(MEP_SYSTEMS.keys()),
                        help="MEP system type")
    parser.add_argument("--timesteps", type=int, default=100_000,
                        help="Total training timesteps")
    args = parser.parse_args()

    mep = MEP_SYSTEMS[args.mep]
    dto = get_room_3d(args.room)
    env = DuctRoutingEnv3D(dto, mep=mep)

    print("Running env checker...")
    check_env(env, warn=True)
    print("Env OK.\n")

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

    print(f"Training on '{args.room}' with MEP='{args.mep}' "
          f"for {args.timesteps} steps...")
    model.learn(total_timesteps=args.timesteps)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    save_path = MODELS_DIR / f"ppo3d_{args.mep}_{args.room}"
    model.save(str(save_path))
    print(f"\nModel saved to {save_path}")


if __name__ == "__main__":
    main()
