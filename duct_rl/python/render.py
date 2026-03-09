"""
Grid and path renderer using matplotlib.
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional, Tuple

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import ListedColormap

from grid import GridScene


# Color map: 0=empty(white), 1=obstacle(black), 2=start(green), 3=target(red)
GRID_CMAP = ListedColormap(["white", "black", "limegreen", "red"])


def render_grid(
    scene: GridScene,
    path: Optional[List[Tuple[int, int]]] = None,
    title: str = "Duct Routing Grid",
    save_path: Optional[str] = None,
    show: bool = True,
):
    """Render the occupancy grid and optionally overlay an agent path."""
    fig, ax = plt.subplots(1, 1, figsize=(8, 8))

    ax.imshow(
        scene.cells,
        cmap=GRID_CMAP,
        vmin=0,
        vmax=3,
        origin="lower",
        interpolation="nearest",
    )

    # Grid lines
    ax.set_xticks(np.arange(-0.5, scene.width, 1), minor=True)
    ax.set_yticks(np.arange(-0.5, scene.height, 1), minor=True)
    ax.grid(which="minor", color="gray", linewidth=0.3)
    ax.tick_params(which="minor", size=0)

    # Draw path
    if path and len(path) > 1:
        rows, cols = zip(*path)
        ax.plot(cols, rows, color="dodgerblue", linewidth=2, marker=".", markersize=4)
        # mark start/end of path
        ax.plot(cols[0], rows[0], "gs", markersize=10, label="start")
        ax.plot(cols[-1], rows[-1], "r^", markersize=10, label="end")
        ax.legend(loc="upper right")

    ax.set_title(title)
    ax.set_xlabel("col")
    ax.set_ylabel("row")

    plt.tight_layout()

    if save_path:
        Path(save_path).parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(save_path, dpi=150)
        print(f"Saved: {save_path}")

    if show:
        plt.show()
    else:
        plt.close(fig)
