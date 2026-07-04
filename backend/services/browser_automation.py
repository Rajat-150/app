"""Playwright browser automation — delegated to the worker container.

The 'worker' service in docker-compose exposes an HTTP API at http://worker:8002.
This module just forwards requests to it and saves the returned image bytes.

If the worker isn't running (no --profile automation), everything falls back
to 'pending_manual' so the semi-manual upload flow keeps working.
"""
import os
import uuid
import httpx
from pathlib import Path
from typing import Optional, Dict, Any

WORKER_URL = os.environ.get("WORKER_URL", "").rstrip("/")
IMAGES_DIR = os.environ.get("IMAGES_DIR", "/app/data/images")
VIDEOS_DIR = os.environ.get("VIDEOS_DIR", "/app/data/videos")


class BrowserAutomation:
    def playwright_available(self) -> bool:
        """True if the worker container is reachable."""
        if not WORKER_URL:
            return False
        try:
            with httpx.Client(timeout=2.0) as c:
                r = c.get(f"{WORKER_URL}/health")
                return r.status_code == 200
        except Exception:
            return False

    async def generate_image_google_flow(
        self,
        prompt: str,
        scene_key: Optional[str] = None,
        settings: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """Ask the worker to run Playwright against Google Flow. Returns path or None."""
        if not WORKER_URL:
            return None
        Path(IMAGES_DIR).mkdir(parents=True, exist_ok=True)
        try:
            async with httpx.AsyncClient(timeout=600.0) as client:
                r = await client.post(
                    f"{WORKER_URL}/automate/image",
                    json={
                        "prompt": prompt,
                        "scene_key": scene_key or "img",
                        "settings": settings or {},
                    },
                )
                if r.status_code != 200:
                    print(f"[worker] error {r.status_code}: {r.text[:500]}")
                    return None
                data = r.json()
                return data.get("path") if data.get("ok") else None
        except Exception as e:
            print(f"[worker] request failed: {e}")
            return None

    async def generate_video_grok(self, prompt: str, image_path: Optional[str] = None) -> Optional[str]:
        # Grok automation to be added in a follow-up (same pattern as flow).
        return None


automation = BrowserAutomation()

