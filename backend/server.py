"""Scene Studio - VPS control panel backend."""
import os
import uuid
import shutil
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Header
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from services.airtable_service import airtable
from services.browser_automation import automation
from services.remotion_service import remotion

# ---------- Setup ----------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
IMAGES_DIR = Path(os.environ.get("IMAGES_DIR", "/app/data/images"))
VIDEOS_DIR = Path(os.environ.get("VIDEOS_DIR", "/app/data/videos"))
IMAGES_DIR.mkdir(parents=True, exist_ok=True)
VIDEOS_DIR.mkdir(parents=True, exist_ok=True)

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Scene Studio API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("scene-studio")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Models ----------
class Scene(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    airtable_id: Optional[str] = None
    scene_number: Optional[str] = None  # accepts string identifiers like "S01-L01-A" or numbers
    image_prompt: str = ""
    video_prompt: str = ""
    status: str = "pending"  # pending | image_generated | video_generated | complete
    created_at: str = Field(default_factory=now_iso)


class ImageAsset(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    scene_id: str
    filename: str
    prompt: str = ""
    selected: bool = False
    source: str = "auto"  # auto | manual
    created_at: str = Field(default_factory=now_iso)


class VideoAsset(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    scene_id: str
    image_id: Optional[str] = None
    filename: str
    prompt: str = ""
    approved: Optional[bool] = None  # None = unreviewed, True/False after review
    source: str = "auto"
    created_at: str = Field(default_factory=now_iso)


class JobRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    kind: str  # image | video
    scene_id: str
    image_id: Optional[str] = None
    status: str = "queued"  # queued | running | done | failed | pending_manual
    prompt: str = ""
    error: Optional[str] = None
    result_asset_id: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


# ---------- Health & Dashboard ----------
@api.get("/")
async def root():
    return {"service": "Scene Studio API", "status": "ok"}


@api.get("/dashboard/stats")
async def dashboard_stats():
    scenes_count = await db.scenes.count_documents({})
    images_count = await db.images.count_documents({})
    videos_count = await db.videos.count_documents({})
    approved_videos = await db.videos.count_documents({"approved": True})
    active_renders = len([j for j in remotion.list_jobs() if j["status"] == "running"])
    return {
        "scenes": scenes_count,
        "images": images_count,
        "videos": videos_count,
        "approved_videos": approved_videos,
        "active_renders": active_renders,
        "playwright_available": automation.playwright_available(),
        "airtable_configured": airtable.is_configured(),
    }


# ---------- Scenes ----------
@api.post("/scenes/sync-airtable")
async def sync_airtable():
    try:
        rows = await airtable.fetch_scenes()
    except Exception as e:
        logger.exception("Airtable fetch failed")
        raise HTTPException(status_code=502, detail=f"Airtable fetch failed: {e}")
    upserted = 0
    for r in rows:
        existing = None
        if r.get("airtable_id"):
            existing = await db.scenes.find_one({"airtable_id": r["airtable_id"]})
        # Coerce scene_number to string for consistency
        sn = r.get("scene_number")
        sn_str = str(sn) if sn is not None and sn != "" else None
        if existing:
            await db.scenes.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "scene_number": sn_str,
                    "image_prompt": r.get("image_prompt", ""),
                    "video_prompt": r.get("video_prompt", ""),
                }},
            )
        else:
            scene = Scene(
                airtable_id=r.get("airtable_id"),
                scene_number=sn_str,
                image_prompt=r.get("image_prompt", ""),
                video_prompt=r.get("video_prompt", ""),
            )
            await db.scenes.insert_one(scene.model_dump())
        upserted += 1
    return {"synced": upserted, "airtable_configured": airtable.is_configured()}


@api.get("/scenes")
async def list_scenes():
    scenes = await db.scenes.find({}, {"_id": 0}).sort("scene_number", 1).to_list(1000)
    return scenes


@api.post("/scenes")
async def create_scene(scene: Scene):
    await db.scenes.insert_one(scene.model_dump())
    return scene


@api.delete("/scenes/{scene_id}")
async def delete_scene(scene_id: str):
    await db.scenes.delete_one({"id": scene_id})
    await db.images.delete_many({"scene_id": scene_id})
    await db.videos.delete_many({"scene_id": scene_id})
    return {"deleted": scene_id}


# ---------- Image generation ----------
async def _run_image_job(job_id: str, scene_id: str, prompt: str):
    await db.jobs.update_one({"id": job_id}, {"$set": {"status": "running", "updated_at": now_iso()}})
    try:
        result_path = await automation.generate_image_google_flow(prompt)
        if result_path:
            filename = Path(result_path).name
            asset = ImageAsset(scene_id=scene_id, filename=filename, prompt=prompt, source="auto")
            await db.images.insert_one(asset.model_dump())
            await db.scenes.update_one({"id": scene_id}, {"$set": {"status": "image_generated"}})
            await db.jobs.update_one(
                {"id": job_id},
                {"$set": {"status": "done", "result_asset_id": asset.id, "updated_at": now_iso()}},
            )
        else:
            await db.jobs.update_one(
                {"id": job_id},
                {"$set": {
                    "status": "pending_manual",
                    "error": "Automation unavailable or failed. Please upload the generated image manually.",
                    "updated_at": now_iso(),
                }},
            )
    except Exception as e:
        await db.jobs.update_one({"id": job_id}, {"$set": {"status": "failed", "error": str(e), "updated_at": now_iso()}})


@api.post("/images/generate")
async def generate_image(payload: Dict[str, Any]):
    scene_id = payload.get("scene_id")
    if not scene_id:
        raise HTTPException(400, "scene_id required")
    scene = await db.scenes.find_one({"id": scene_id}, {"_id": 0})
    if not scene:
        raise HTTPException(404, "scene not found")
    prompt = payload.get("prompt") or scene.get("image_prompt", "")
    job = JobRecord(kind="image", scene_id=scene_id, prompt=prompt)
    await db.jobs.insert_one(job.model_dump())
    asyncio.create_task(_run_image_job(job.id, scene_id, prompt))
    return job


@api.post("/images/upload")
async def upload_image(scene_id: str = Form(...), file: UploadFile = File(...)):
    scene = await db.scenes.find_one({"id": scene_id}, {"_id": 0})
    if not scene:
        raise HTTPException(404, "scene not found")
    ext = Path(file.filename or "img.png").suffix or ".png"
    filename = f"img_{uuid.uuid4().hex}{ext}"
    fpath = IMAGES_DIR / filename
    with fpath.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    asset = ImageAsset(scene_id=scene_id, filename=filename, prompt=scene.get("image_prompt", ""), source="manual")
    await db.images.insert_one(asset.model_dump())
    await db.scenes.update_one({"id": scene_id}, {"$set": {"status": "image_generated"}})
    return asset


@api.get("/images")
async def list_images(scene_id: Optional[str] = None):
    q = {"scene_id": scene_id} if scene_id else {}
    return await db.images.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)


@api.patch("/images/{image_id}")
async def update_image(image_id: str, payload: Dict[str, Any]):
    update = {k: v for k, v in payload.items() if k in {"selected", "prompt"}}
    if not update:
        raise HTTPException(400, "no valid fields")
    await db.images.update_one({"id": image_id}, {"$set": update})
    return await db.images.find_one({"id": image_id}, {"_id": 0})


@api.delete("/images/{image_id}")
async def delete_image(image_id: str):
    img = await db.images.find_one({"id": image_id})
    if img:
        try:
            (IMAGES_DIR / img["filename"]).unlink(missing_ok=True)
        except Exception:
            pass
    await db.images.delete_one({"id": image_id})
    return {"deleted": image_id}


# ---------- Video generation ----------
async def _run_video_job(job_id: str, scene_id: str, image_id: str, prompt: str, image_path: Optional[str]):
    await db.jobs.update_one({"id": job_id}, {"$set": {"status": "running", "updated_at": now_iso()}})
    try:
        result_path = await automation.generate_video_grok(prompt, image_path=image_path)
        if result_path:
            filename = Path(result_path).name
            asset = VideoAsset(scene_id=scene_id, image_id=image_id, filename=filename, prompt=prompt, source="auto")
            await db.videos.insert_one(asset.model_dump())
            await db.scenes.update_one({"id": scene_id}, {"$set": {"status": "video_generated"}})
            await db.jobs.update_one(
                {"id": job_id},
                {"$set": {"status": "done", "result_asset_id": asset.id, "updated_at": now_iso()}},
            )
        else:
            await db.jobs.update_one(
                {"id": job_id},
                {"$set": {
                    "status": "pending_manual",
                    "error": "Automation unavailable or failed. Please upload the generated video manually.",
                    "updated_at": now_iso(),
                }},
            )
    except Exception as e:
        await db.jobs.update_one({"id": job_id}, {"$set": {"status": "failed", "error": str(e), "updated_at": now_iso()}})


@api.post("/videos/generate")
async def generate_video(payload: Dict[str, Any]):
    image_id = payload.get("image_id")
    if not image_id:
        raise HTTPException(400, "image_id required")
    img = await db.images.find_one({"id": image_id}, {"_id": 0})
    if not img:
        raise HTTPException(404, "image not found")
    scene = await db.scenes.find_one({"id": img["scene_id"]}, {"_id": 0})
    if not scene:
        raise HTTPException(404, "scene not found")
    prompt = payload.get("prompt") or scene.get("video_prompt", "")
    image_path = str(IMAGES_DIR / img["filename"])
    job = JobRecord(kind="video", scene_id=img["scene_id"], image_id=image_id, prompt=prompt)
    await db.jobs.insert_one(job.model_dump())
    asyncio.create_task(_run_video_job(job.id, img["scene_id"], image_id, prompt, image_path))
    return job


@api.post("/videos/generate-selected")
async def generate_selected_videos():
    selected = await db.images.find({"selected": True}, {"_id": 0}).to_list(1000)
    jobs = []
    for img in selected:
        scene = await db.scenes.find_one({"id": img["scene_id"]}, {"_id": 0})
        prompt = (scene or {}).get("video_prompt", "")
        image_path = str(IMAGES_DIR / img["filename"])
        job = JobRecord(kind="video", scene_id=img["scene_id"], image_id=img["id"], prompt=prompt)
        await db.jobs.insert_one(job.model_dump())
        asyncio.create_task(_run_video_job(job.id, img["scene_id"], img["id"], prompt, image_path))
        jobs.append(job.model_dump())
    return {"queued": len(jobs), "jobs": jobs}


@api.post("/videos/upload")
async def upload_video(
    scene_id: str = Form(...),
    image_id: Optional[str] = Form(None),
    file: UploadFile = File(...),
):
    ext = Path(file.filename or "vid.mp4").suffix or ".mp4"
    filename = f"vid_{uuid.uuid4().hex}{ext}"
    fpath = VIDEOS_DIR / filename
    with fpath.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    scene = await db.scenes.find_one({"id": scene_id}, {"_id": 0})
    asset = VideoAsset(
        scene_id=scene_id,
        image_id=image_id,
        filename=filename,
        prompt=(scene or {}).get("video_prompt", ""),
        source="manual",
    )
    await db.videos.insert_one(asset.model_dump())
    await db.scenes.update_one({"id": scene_id}, {"$set": {"status": "video_generated"}})
    return asset


@api.get("/videos")
async def list_videos(scene_id: Optional[str] = None):
    q = {"scene_id": scene_id} if scene_id else {}
    return await db.videos.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)


@api.patch("/videos/{video_id}")
async def update_video(video_id: str, payload: Dict[str, Any]):
    update = {k: v for k, v in payload.items() if k in {"approved"}}
    if not update:
        raise HTTPException(400, "no valid fields")
    await db.videos.update_one({"id": video_id}, {"$set": update})
    return await db.videos.find_one({"id": video_id}, {"_id": 0})


@api.delete("/videos/{video_id}")
async def delete_video(video_id: str):
    v = await db.videos.find_one({"id": video_id})
    if v:
        try:
            (VIDEOS_DIR / v["filename"]).unlink(missing_ok=True)
        except Exception:
            pass
    await db.videos.delete_one({"id": video_id})
    return {"deleted": video_id}


# ---------- Jobs ----------
@api.get("/jobs")
async def list_jobs(limit: int = 100):
    return await db.jobs.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)


# ---------- File serving ----------
@api.get("/files/images/{filename}")
async def serve_image(filename: str):
    p = IMAGES_DIR / filename
    if not p.exists():
        raise HTTPException(404, "not found")
    return FileResponse(p)


@api.get("/files/videos/{filename}")
async def serve_video(filename: str):
    p = VIDEOS_DIR / filename
    if not p.exists():
        raise HTTPException(404, "not found")
    return FileResponse(p)


# ---------- Remotion render ----------
@api.post("/render/start")
async def render_start(payload: Dict[str, Any]):
    job_id = await remotion.start_render(
        composition=payload.get("composition", "MainVideo"),
        output_name=payload.get("output_name"),
        resolution=payload.get("resolution"),
    )
    return {"job_id": job_id}


@api.get("/render/jobs")
async def render_jobs():
    return remotion.list_jobs()


@api.get("/render/jobs/{job_id}")
async def render_job(job_id: str):
    j = remotion.get_job(job_id)
    if not j:
        raise HTTPException(404, "not found")
    return j


# ---------- Config ----------
@api.get("/config")
async def get_config():
    return {
        "airtable": {
            "configured": airtable.is_configured(),
            "base_id": airtable.base_id if airtable.is_configured() else "(placeholder)",
            "table_name": airtable.table_name,
        },
        "storage": {
            "images_dir": str(IMAGES_DIR),
            "videos_dir": str(VIDEOS_DIR),
        },
        "browser": {
            "playwright_available": automation.playwright_available(),
            "profile_dir": os.environ.get("PLAYWRIGHT_PROFILE_DIR"),
            "novnc_url": os.environ.get("NOVNC_URL", ""),
            "google_flow_url": os.environ.get("GOOGLE_FLOW_URL"),
            "grok_url": os.environ.get("GROK_URL"),
        },
        "remotion": {
            "project_dir": os.environ.get("REMOTION_PROJECT_DIR"),
        },
        "n8n": {
            "base_url": os.environ.get("N8N_BASE_URL"),
        },
    }


# ---------- n8n webhook receiver ----------
@api.post("/webhooks/n8n/scenes")
async def n8n_receive_scenes(payload: Dict[str, Any], x_webhook_secret: Optional[str] = Header(None)):
    """Accept scenes pushed from n8n. Expects {"scenes": [{"scene_number":1,"image_prompt":"...","video_prompt":"..."}]}"""
    secret = os.environ.get("N8N_WEBHOOK_SECRET", "")
    if secret and x_webhook_secret != secret:
        raise HTTPException(401, "invalid webhook secret")
    scenes = payload.get("scenes", [])
    inserted = 0
    for s in scenes:
        scene = Scene(
            scene_number=s.get("scene_number"),
            image_prompt=s.get("image_prompt", ""),
            video_prompt=s.get("video_prompt", ""),
            airtable_id=s.get("airtable_id"),
        )
        await db.scenes.insert_one(scene.model_dump())
        inserted += 1
    return {"inserted": inserted}


# ---------- CORS & mount ----------
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def _shutdown():
    client.close()
