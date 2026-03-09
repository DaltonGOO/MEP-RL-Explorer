"""
PyVista 3D viewer for the MEP routing environment.

Provides:
- show_static(scene, path)        -- view a completed route
- run_interactive(env, model, ...) -- real-time agent stepping
"""

from __future__ import annotations

from typing import List, Optional, Tuple

import numpy as np

from grid3d import VoxelScene


def _voxel_center(scene: VoxelScene, ix: int, iy: int, iz: int):
    """Return world-coordinate center of voxel (ix, iy, iz)."""
    vs = scene.voxel_size
    ox, oy, oz = scene.origin
    return (
        ox + (ix + 0.5) * vs,
        oy + (iy + 0.5) * vs,
        oz + (iz + 0.5) * vs,
    )


def _build_plotter(scene: VoxelScene, title: str = "MEP 3D Viewer"):
    """Create a PyVista plotter with obstacles, room boundary, and start/target."""
    import pyvista as pv

    plotter = pv.Plotter(title=title)
    vs = scene.voxel_size
    ox, oy, oz = scene.origin

    # Room boundary wireframe
    room_box = pv.Box(bounds=(
        ox, ox + scene.nx * vs,
        oy, oy + scene.ny * vs,
        oz, oz + scene.nz * vs,
    ))
    plotter.add_mesh(room_box, style="wireframe", color="gray",
                     line_width=1, opacity=0.3)

    # Obstacles as semi-transparent cubes
    obstacle_indices = np.argwhere(scene.voxels == 1)
    if len(obstacle_indices) > 0:
        blocks = pv.MultiBlock()
        for iz_v, iy_v, ix_v in obstacle_indices:
            cx, cy, cz = _voxel_center(scene, ix_v, iy_v, iz_v)
            half = vs / 2
            cube = pv.Box(bounds=(
                cx - half, cx + half,
                cy - half, cy + half,
                cz - half, cz + half,
            ))
            blocks.append(cube)
        merged = blocks.combine()
        plotter.add_mesh(merged, color="dimgray", opacity=0.25)

    # Start sphere
    sx, sy, sz = _voxel_center(scene, *scene.start_ijk)
    start_sphere = pv.Sphere(radius=vs * 0.4, center=(sx, sy, sz))
    plotter.add_mesh(start_sphere, color="limegreen", label="Start")

    # Target sphere
    tx, ty, tz = _voxel_center(scene, *scene.target_ijk)
    target_sphere = pv.Sphere(radius=vs * 0.4, center=(tx, ty, tz))
    plotter.add_mesh(target_sphere, color="red", label="Target")

    plotter.add_legend()
    plotter.add_axes()

    return plotter


def show_static(
    scene: VoxelScene,
    path: Optional[List[Tuple[int, int, int]]] = None,
    title: str = "MEP 3D Route",
):
    """Display the voxel scene with an optional completed path."""
    import pyvista as pv

    plotter = _build_plotter(scene, title=title)

    if path and len(path) > 1:
        # Convert path to world coordinates
        world_pts = np.array([_voxel_center(scene, *p) for p in path])
        spline = pv.Spline(world_pts, n_points=len(world_pts) * 3)
        plotter.add_mesh(spline.tube(radius=scene.voxel_size * 0.15),
                         color="dodgerblue", label="Route")

        # Agent end position
        ex, ey, ez = world_pts[-1]
        end_sphere = pv.Sphere(radius=scene.voxel_size * 0.3,
                               center=(ex, ey, ez))
        plotter.add_mesh(end_sphere, color="dodgerblue")

    plotter.show()


def run_interactive(
    env,
    model=None,
    mode: str = "agent",
    speed: float = 0.3,
):
    """Real-time interactive viewer.

    Args:
        env: DuctRoutingEnv3D instance (already reset)
        model: Trained SB3 model (required if mode='agent')
        mode: 'agent' (model steps) or 'random' (random actions)
        speed: seconds between steps
    """
    import pyvista as pv

    obs, _ = env.reset()
    scene = env.scene
    vs = scene.voxel_size

    plotter = _build_plotter(scene, title=f"Interactive ({mode})")

    # Agent sphere (will be updated)
    ax, ay, az = _voxel_center(scene, *env.path[-1])
    agent_sphere = pv.Sphere(radius=vs * 0.3, center=(ax, ay, az))
    agent_actor = plotter.add_mesh(agent_sphere, color="dodgerblue")

    # Path tube — built incrementally
    path_points = [np.array([ax, ay, az])]
    path_actor = [None]  # mutable ref for callback

    done = [False]

    def step_callback():
        if done[0]:
            return

        if mode == "agent" and model is not None:
            action, _ = model.predict(obs, deterministic=True)
            action = int(action)
        else:
            action = env.action_space.sample()

        nonlocal obs
        obs_new, reward, terminated, truncated, info = env.step(action)
        obs = obs_new

        # Update agent position
        ix, iy, iz = env.path[-1]
        cx, cy, cz = _voxel_center(scene, ix, iy, iz)

        # Remove old agent, add new
        plotter.remove_actor(agent_actor)
        new_sphere = pv.Sphere(radius=vs * 0.3, center=(cx, cy, cz))
        plotter.add_mesh(new_sphere, color="dodgerblue")

        # Update path
        path_points.append(np.array([cx, cy, cz]))
        if len(path_points) >= 2:
            if path_actor[0] is not None:
                plotter.remove_actor(path_actor[0])
            pts = np.array(path_points)
            line = pv.lines_from_points(pts)
            path_actor[0] = plotter.add_mesh(
                line.tube(radius=vs * 0.1), color="dodgerblue", opacity=0.7
            )

        if terminated or truncated:
            done[0] = True
            status = "REACHED" if info.get("reached_target") else "FAILED"
            print(f"Episode done: {status} in {info.get('steps', '?')} steps")

    plotter.add_callback(step_callback, interval=int(speed * 1000))
    plotter.show()
