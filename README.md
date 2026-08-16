# MEP RL Explorer

Reinforcement learning for MEP (Mechanical, Electrical, Plumbing) duct routing in 3D building environments. An agent learns to navigate ducts from a start point to a target while avoiding obstacles, minimizing turns, and respecting real-world MEP constraints.

## Quick Start

```bash
docker compose up --build
# Open http://localhost:3000
```

That's it. No Rust toolchain, no Python environment — Docker handles everything.

## What It Does

1. **Build a scene** — Pick a preset room layout or design your own with the Layout Builder (drag obstacles, start/target points directly in the 3D viewer)
2. **Train an agent** — PPO (Proximal Policy Optimization) trains in the Python backend with live reward curves streamed to the browser
3. **Watch it route** — Run the trained policy at 60fps entirely in the browser via WebAssembly, or compare against a random baseline

The reward function is fully tunable from the UI: step penalties, collision costs, turn penalties (horizontal vs vertical), vertical travel costs, and target bonus.

## Architecture

```
Browser (WASM + React)          Python Backend
┌─────────────────────┐         ┌──────────────────┐
│  Three.js 3D viewer │         │  FastAPI + SB3    │
│  Zustand state      │◄──WS──►│  PPO training     │
│  Rust/WASM core:    │         │  Weight export    │
│   - Grid building   │         └──────────────────┘
│   - Episode stepping│
│   - MLP inference   │
└─────────────────────┘
```

**Everything except training runs client-side.** The WASM core handles grid voxelization, collision detection, reward computation, and neural network inference — no round-trips to the server during playback.

### Rust/WASM Core (`duct_rl/web/crate/`)

Grid building, episode stepping, observation vectors, and trained policy inference compiled to WebAssembly. The pre-built WASM package is included in the repo so users don't need a Rust toolchain.

### Python Backend (`duct_rl/web/backend/`)

FastAPI server wrapping Stable-Baselines3 PPO. Trains models in background threads, streams progress over WebSocket, and exports MLP weights as JSON for browser-side inference.

### React Frontend (`duct_rl/web/frontend/`)

React 18 + Three.js (react-three/fiber) + Zustand + Recharts. Features a 3D viewport with draggable objects, a layout builder for custom room geometries, reward parameter sliders, and live training dashboards.

### Standalone Python (`duct_rl/python/`)

The original Python implementation with 2D and 3D environments, training scripts, and a PyQt5 desktop GUI. Fully functional independently of the web platform.

## Development Setup (without Docker)

### Frontend

```bash
cd duct_rl/web/frontend
npm install
npm run dev          # http://localhost:3000
```

### Backend

```bash
cd duct_rl/web/backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Rebuild WASM (optional — pre-built pkg is included)

```bash
cd duct_rl/web/crate
wasm-pack build --target web --release
git checkout -- pkg/.gitignore pkg/package.json   # see below
```

Requires [Rust](https://rustup.rs/) and [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/).

`wasm-pack` overwrites `pkg/.gitignore` with its own "ignore everything" default, which would drop the committed WASM package from version control. The repo's version is an allowlist that keeps the four build artifacts tracked — restore it after every rebuild.

### Standalone Python

```bash
cd duct_rl/python
pip install -r requirements.txt
python train3d.py          # Train a model
python app3d.py            # Launch desktop GUI
```

## MEP Systems

Three preset MEP configurations with different routing behaviors:

| System | Cross Section | Voxel Size | Turn Penalty | Notes |
|--------|--------------|------------|--------------|-------|
| Duct | 400mm | 0.3m | Low | Flexible routing |
| Pipe | 100mm | 0.2m | High | Prefers straight runs |
| Cable Tray | 300mm | 0.3m | Medium | Balanced |

All parameters are adjustable from the UI at runtime.

## Key Design Decisions

- **Collisions don't terminate episodes** — the agent bounces back with a penalty, encouraging it to learn avoidance rather than just dying
- **Distance shaping** — +1 reward for moving closer to target (Manhattan distance), -1 for moving farther
- **6-action space** — +X, -X, +Y, -Y, +Z, -Z movement on a voxel grid
- **The observation exposes everything the reward reads** — turn penalties depend on the previous action, the bend constraint on the current straight run, and the revisit penalty on visited voxels, so all three are in the observation vector. Without them the agent is guessing at rules it's being scored on.
- **WASM pkg committed** — users never need a Rust toolchain; the 162KB binary is version-controlled

### Observation vector (26 floats, all in [-1, 1])

| Index | Contents |
|-------|----------|
| 0–2 | Agent position, normalized |
| 3–5 | Vector to target, normalized |
| 6–11 | Neighbor cell types (+X, -X, +Y, -Y, +Z, -Z) |
| 12–17 | Previous action, one-hot |
| 18 | Length of the current straight run |
| 19 | Whether a turn would be accepted right now |
| 20–25 | Which neighbor voxels have already been visited |

Defined twice — `duct_rl/python/grid3d.py` (training) and `duct_rl/web/crate/src/grid3d.rs` (browser playback). `duct_rl/testdata/obs_parity.json` records observations from fixed action sequences, and both test suites replay them, so the two implementations can't drift apart silently. Regenerate it with `python gen_obs_parity.py` after any intentional change.

## Tech Stack

- **Rust** + wasm-pack (WebAssembly core)
- **Python 3.12** + FastAPI + Stable-Baselines3 + PyTorch (training backend)
- **React 18** + Three.js + Zustand + Recharts + Vite (frontend)
- **Docker Compose** (orchestration)

## License

[MIT](LICENSE)
