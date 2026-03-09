"""FastAPI backend for MEP RL Explorer."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from routers import models, rooms, train

app = FastAPI(title="MEP RL Explorer", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rooms.router)
app.include_router(train.router)
app.include_router(models.router)

# Serve pre-exported WASM weights as static files
weights_dir = Path(__file__).parent / "weights"
weights_dir.mkdir(exist_ok=True)
app.mount("/weights", StaticFiles(directory=str(weights_dir)), name="weights")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
