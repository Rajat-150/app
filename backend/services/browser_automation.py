"""Playwright browser automation — delegated to the worker container.

Uses a global asyncio.Lock so only ONE automation job runs at a time.
Reason: we have a single Chrome profile in /data/playwright-profile; parallel
jobs would fight over the SingletonLock file and only one would succeed.
"""
import os
import asyncio
import httpx
from pathlib import Path
from typing import Optional, Dict, Any

WORKER_URL = os.environ.get("WORKER_URL", "").rstrip("/")
IMAGES_DIR = os.environ.get("IMAGES_DIR", "/app/data/images")
VIDEOS_DIR = os.environ.get("VIDEOS_DIR", "/app/data/videos")

# Serialize all worker calls — one Chrome instance, one job at a time.
_worker_lock = asyncio.Lock()


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
    ) -> Dict[str, Any]:
        """Ask the worker to run Playwright against Google Flow.

        Serialized via _worker_lock so parallel bulk jobs are queued and don't
        collide over the single Chrome profile.
        """
        if not WORKER_URL:
            return {"ok": False, "error": "WORKER_URL not configured on backend"}
        Path(IMAGES_DIR).mkdir(parents=True, exist_ok=True)
        async with _worker_lock:
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
                        try:
                            payload = r.json()
                            detail = payload.get("detail", payload)
                            if isinstance(detail, dict):
                                return {"ok": False, **detail}
                            return {"ok": False, "error": str(detail)}
                        except Exception:
                            return {"ok": False, "error": f"worker HTTP {r.status_code}: {r.text[:500]}"}
                    return r.json()
            except httpx.ConnectError as e:
                return {"ok": False, "error": f"cannot reach worker at {WORKER_URL}: {e}"}
            except httpx.TimeoutException:
                return {"ok": False, "error": "worker timed out after 10 min"}
            except Exception as e:
                return {"ok": False, "error": f"unexpected: {type(e).__name__}: {e}"}

    async def generate_video_grok(self, prompt: str, image_path: Optional[str] = None) -> Optional[str]:
        # Grok automation to be added in a follow-up (same pattern as flow).
        return None


automation = BrowserAutomation()

