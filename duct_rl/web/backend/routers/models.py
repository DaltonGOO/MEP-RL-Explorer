"""Model endpoints — list models, get weights for WASM inference."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api", tags=["models"])

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
WEIGHTS_DIR = Path(__file__).resolve().parent.parent / "weights"


@router.get("/models")
async def list_models():
    """List all saved models."""
    models = []
    if MODELS_DIR.exists():
        for f in sorted(MODELS_DIR.glob("*.zip")):
            parts = f.stem.split("_")
            # Format: ppo3d_{mep}_{room}_{job_id}
            if len(parts) >= 4:
                models.append({
                    "model_id": parts[-1],
                    "mep": parts[1],
                    "room": "_".join(parts[2:-1]),
                    "filename": f.name,
                })
    return {"models": models}


@router.get("/models/{filename}/weights")
async def get_model_weights(filename: str):
    """Get MLP weights as JSON for browser-side inference."""
    weights_file = WEIGHTS_DIR / filename.replace(".zip", ".json")
    if not weights_file.exists():
        return JSONResponse({"error": "Weights not found"}, status_code=404)

    with open(weights_file) as f:
        weights = json.load(f)
    return weights
