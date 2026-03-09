"""
Interactive 3D player — watch the agent route in real time.

Usage:
    python play3d.py                                # agent mode, simple room
    python play3d.py --room corridor --mep duct --mode agent
    python play3d.py --mode random --speed 0.1      # random actions, fast
"""

from __future__ import annotations

import argparse
from pathlib import Path

from duct_env3d import DuctRoutingEnv3D
from mep_config import MEP_SYSTEMS
from rooms3d import SYNTHETIC_ROOMS_3D, get_room_3d
from viewer3d import run_interactive

MODELS_DIR = Path(__file__).parent / "models"


def main():
    parser = argparse.ArgumentParser(description="Interactive 3D MEP player")
    parser.add_argument("--room", default="simple",
                        choices=list(SYNTHETIC_ROOMS_3D.keys()))
    parser.add_argument("--mep", default="duct",
                        choices=list(MEP_SYSTEMS.keys()))
    parser.add_argument("--mode", default="agent",
                        choices=["agent", "random"],
                        help="'agent' uses trained model, 'random' samples actions")
    parser.add_argument("--speed", type=float, default=0.3,
                        help="Seconds between steps")
    args = parser.parse_args()

    mep = MEP_SYSTEMS[args.mep]
    dto = get_room_3d(args.room)
    env = DuctRoutingEnv3D(dto, mep=mep)

    model = None
    if args.mode == "agent":
        from stable_baselines3 import PPO
        model_path = MODELS_DIR / f"ppo3d_{args.mep}_{args.room}"
        if not model_path.with_suffix(".zip").exists():
            print(f"No model at {model_path}.zip -- falling back to random mode.")
            args.mode = "random"
        else:
            model = PPO.load(str(model_path), env=env)

    run_interactive(env, model=model, mode=args.mode, speed=args.speed)


if __name__ == "__main__":
    main()
