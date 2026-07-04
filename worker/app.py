"""Worker HTTP API — called by the main backend to run Playwright automation."""
import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional

from flow_automation import generate_image as flow_generate_image

logging.basicConfig(level=logging.INFO, format="%(asctime)s [worker] %(message)s")

app = FastAPI(title="Scene Studio Worker")


class ImageGenRequest(BaseModel):
    prompt: str
    scene_key: Optional[str] = None
    settings: Dict[str, Any] = {}


@app.get("/health")
async def health():
    return {"status": "ok", "display": os.environ.get("DISPLAY")}


@app.post("/automate/image")
async def automate_image(req: ImageGenRequest):
    result = await flow_generate_image(req.prompt, req.scene_key or "img", req.settings)
    # Always return 200 with the result dict — the backend inspects `ok` field.
    # This avoids losing the error detail when FastAPI wraps a 500 body poorly.
    return result


@app.get("/screenshot/{name}")
async def get_screenshot(name: str):
    p = f"/data/screenshots/{name}"
    if not os.path.exists(p):
        raise HTTPException(404)
    return FileResponse(p)
