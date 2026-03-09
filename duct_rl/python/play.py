"""
Interactive visual player for the duct routing agent.

Watch the agent navigate step-by-step in real time, or control it yourself
with arrow keys.

Usage:
    python play.py                              # watch trained agent on simple room
    python play.py --room corridor              # different room
    python play.py --mode manual                # YOU control with arrow keys
    python play.py --mode random                # random actions (baseline)
    python play.py --speed 200                  # faster (ms per step)
    python play.py --speed 1000                 # slower

Controls (all modes):
    R         = restart episode
    SPACE     = pause / resume
    Q / ESC   = quit

Manual mode extra controls:
    Arrow keys = move agent
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import matplotlib
matplotlib.use("TkAgg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
from matplotlib.colors import ListedColormap

from duct_env import DuctRoutingEnv
from kindamatic_fetch import get_room
from grid import GridScene

MODELS_DIR = Path(__file__).parent / "models"

# Colors: empty=white, obstacle=dark gray, start=green, target=red
GRID_CMAP = ListedColormap(["#f0f0f0", "#2d2d2d", "#4CAF50", "#f44336"])

# Action map for arrow keys
KEY_TO_ACTION = {
    "up": 0,
    "down": 1,
    "left": 2,
    "right": 3,
}


class Player:
    """Interactive visual player with live grid rendering."""

    def __init__(self, env: DuctRoutingEnv, model=None, mode="agent", speed_ms=400):
        self.env = env
        self.model = model
        self.mode = mode
        self.speed_ms = speed_ms
        self.paused = False
        self.done = True
        self.obs = None
        self.total_reward = 0.0
        self.step_count = 0
        self.pending_action = None

        # --- Set up figure ---
        scene = env.scene
        aspect = scene.width / scene.height
        fig_h = 8
        fig_w = max(fig_h * aspect, 6)
        self.fig, self.ax = plt.subplots(figsize=(fig_w, fig_h + 1.2))
        self.fig.canvas.manager.set_window_title("Duct Routing Agent")
        plt.subplots_adjust(top=0.88, bottom=0.08)

        # Grid image
        self.grid_display = np.copy(scene.cells).astype(float)
        self.im = self.ax.imshow(
            self.grid_display,
            cmap=GRID_CMAP,
            vmin=0, vmax=3,
            origin="lower",
            interpolation="nearest",
        )

        # Grid lines
        self.ax.set_xticks(np.arange(-0.5, scene.width, 1), minor=True)
        self.ax.set_yticks(np.arange(-0.5, scene.height, 1), minor=True)
        self.ax.grid(which="minor", color="#cccccc", linewidth=0.3)
        self.ax.tick_params(which="minor", size=0)

        # Agent marker
        self.agent_dot, = self.ax.plot([], [], "o", color="#2196F3",
                                        markersize=12, markeredgecolor="white",
                                        markeredgewidth=2, zorder=10)

        # Path trail
        self.trail_line, = self.ax.plot([], [], "-", color="#2196F3",
                                         linewidth=2, alpha=0.5, zorder=5)

        # Status text
        self.status_text = self.fig.text(
            0.5, 0.94, "", ha="center", va="center", fontsize=13,
            fontfamily="monospace", fontweight="bold",
        )
        self.info_text = self.fig.text(
            0.5, 0.02, "", ha="center", va="center", fontsize=10,
            fontfamily="monospace", color="#666666",
        )

        # Legend
        legend_patches = [
            mpatches.Patch(color="#f0f0f0", ec="gray", label="Empty"),
            mpatches.Patch(color="#2d2d2d", label="Obstacle"),
            mpatches.Patch(color="#4CAF50", label="Start"),
            mpatches.Patch(color="#f44336", label="Target"),
            mpatches.Patch(color="#2196F3", label="Agent"),
        ]
        self.ax.legend(handles=legend_patches, loc="upper right", fontsize=8,
                       framealpha=0.9)

        self.ax.set_xlabel("col")
        self.ax.set_ylabel("row")

        # Connect events
        self.fig.canvas.mpl_connect("key_press_event", self._on_key)
        self.fig.canvas.mpl_connect("close_event", self._on_close)

        self._alive = True
        self._reset()

    def _reset(self):
        """Reset the environment and visuals."""
        self.obs, _ = self.env.reset()
        self.done = False
        self.total_reward = 0.0
        self.step_count = 0
        self.paused = False
        self.trail_cols = []
        self.trail_rows = []
        self._update_display()
        self._update_status("RUNNING" if self.mode != "manual" else "MANUAL - use arrow keys")

    def _on_key(self, event):
        if event.key in ("q", "escape"):
            self._alive = False
            plt.close(self.fig)
            return
        if event.key == "r":
            self._reset()
            return
        if event.key == " ":
            self.paused = not self.paused
            if self.paused:
                self._update_status("PAUSED (space to resume)")
            else:
                self._update_status("RUNNING")
            return
        if self.mode == "manual" and event.key in KEY_TO_ACTION:
            self.pending_action = KEY_TO_ACTION[event.key]

    def _on_close(self, event):
        self._alive = False

    def _update_display(self):
        """Redraw the grid, agent, and trail."""
        state = self.env._state
        scene = self.env.scene

        # Update agent position
        self.agent_dot.set_data([state.col], [state.row])

        # Update trail
        self.trail_cols.append(state.col)
        self.trail_rows.append(state.row)
        self.trail_line.set_data(self.trail_cols, self.trail_rows)

        # Info bar
        dist = abs(state.row - scene.target_rc[0]) + abs(state.col - scene.target_rc[1])
        self.info_text.set_text(
            f"Step: {self.step_count}  |  Reward: {self.total_reward:.1f}  |  "
            f"Dist to target: {dist}  |  Mode: {self.mode}  |  "
            f"[R]estart  [SPACE]pause  [Q]uit"
        )
        self.fig.canvas.draw_idle()

    def _update_status(self, msg):
        color = "#4CAF50" if "REACHED" in msg else "#f44336" if "FAIL" in msg else "#333333"
        self.status_text.set_text(msg)
        self.status_text.set_color(color)
        self.fig.canvas.draw_idle()

    def _step_once(self):
        """Take one step in the environment."""
        if self.done or self.paused:
            return

        # Get action
        if self.mode == "agent" and self.model is not None:
            action, _ = self.model.predict(self.obs, deterministic=True)
            action = int(action)
        elif self.mode == "manual":
            if self.pending_action is None:
                return  # wait for keypress
            action = self.pending_action
            self.pending_action = None
        else:  # random
            action = self.env.action_space.sample()

        # Step
        self.obs, reward, terminated, truncated, info = self.env.step(action)
        self.total_reward += reward
        self.step_count += 1
        self.done = terminated or truncated

        self._update_display()

        if self.done:
            if info.get("reached_target"):
                self._update_status(
                    f"REACHED TARGET in {self.step_count} steps! (reward={self.total_reward:.1f})  [R] to restart"
                )
            else:
                self._update_status(
                    f"FAILED after {self.step_count} steps (reward={self.total_reward:.1f})  [R] to restart"
                )

    def run(self):
        """Main loop using a matplotlib timer."""
        timer = self.fig.canvas.new_timer(interval=self.speed_ms)
        timer.add_callback(self._step_once)
        timer.start()
        plt.show()


def main():
    parser = argparse.ArgumentParser(
        description="Interactive duct routing viewer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--room", default="simple",
                        choices=["simple", "corridor", "l_shaped", "multi_obstacle"],
                        help="Room to play in")
    parser.add_argument("--mode", default="agent",
                        choices=["agent", "manual", "random"],
                        help="agent=trained model, manual=arrow keys, random=baseline")
    parser.add_argument("--speed", type=int, default=400,
                        help="Milliseconds per step (lower=faster)")
    args = parser.parse_args()

    dto = get_room(args.room)
    env = DuctRoutingEnv(dto)

    model = None
    if args.mode == "agent":
        model_path = MODELS_DIR / f"ppo_{args.room}"
        if not model_path.with_suffix(".zip").exists():
            print(f"No model at {model_path}.zip -- run train.py first, or use --mode manual")
            sys.exit(1)
        from stable_baselines3 import PPO
        model = PPO.load(str(model_path), env=env)
        print(f"Loaded model: {model_path}")

    print(f"Room: {args.room} | Mode: {args.mode} | Speed: {args.speed}ms/step")
    print("Controls: [R] restart | [SPACE] pause | [Q] quit", end="")
    if args.mode == "manual":
        print(" | Arrow keys to move")
    else:
        print()

    player = Player(env, model=model, mode=args.mode, speed_ms=args.speed)
    player.run()


if __name__ == "__main__":
    main()
