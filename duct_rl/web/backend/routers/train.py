"""Training endpoints — start, monitor, cancel training jobs."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from schemas import TrainRequest
from services.trainer import cancel_job, get_job, start_training

router = APIRouter(prefix="/api", tags=["training"])


@router.post("/train")
async def train(req: TrainRequest):
    """Start a training job. Returns job_id for monitoring."""
    job_id = start_training(
        room=req.room,
        geometry=req.geometry.model_dump() if req.geometry else None,
        mep_params=req.mep.model_dump(),
        timesteps=req.timesteps,
        learning_rate=req.learning_rate,
        n_steps=req.n_steps,
        batch_size=req.batch_size,
    )
    return {"job_id": job_id}


@router.get("/train/{job_id}")
async def get_train_status(job_id: str):
    """Get current status of a training job."""
    job = get_job(job_id)
    if not job:
        return {"error": "Job not found"}, 404
    return {
        "job_id": job.job_id,
        "status": job.status,
        "progress": job.progress,
        "timestep": job.current_timestep,
        "total_timesteps": job.timesteps,
        "metrics": job.metrics[-10:],  # last 10 data points
        "model_path": job.model_path,
        "error": job.error,
    }


@router.delete("/train/{job_id}")
async def cancel_training(job_id: str):
    """Cancel a running training job."""
    success = cancel_job(job_id)
    return {"cancelled": success}


@router.websocket("/ws/train/{job_id}")
async def train_ws(websocket: WebSocket, job_id: str):
    """Stream training metrics in real-time."""
    await websocket.accept()
    last_idx = 0

    try:
        while True:
            job = get_job(job_id)
            if not job:
                await websocket.send_json({"error": "Job not found"})
                break

            # Send any new metrics
            if len(job.metrics) > last_idx:
                for metric in job.metrics[last_idx:]:
                    await websocket.send_json({
                        "type": "metric",
                        "data": metric,
                        "progress": job.progress,
                        "status": job.status,
                    })
                last_idx = len(job.metrics)

            if job.status in ("completed", "failed", "cancelled"):
                await websocket.send_json({
                    "type": "done",
                    "status": job.status,
                    "model_path": job.model_path,
                    "error": job.error,
                })
                break

            await asyncio.sleep(0.5)

    except WebSocketDisconnect:
        pass
