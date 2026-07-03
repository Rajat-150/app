"""Playwright browser automation for Google Flow (image gen) and Grok (video gen).

Runs headed inside a Docker container with a persistent user-data-dir so the
user only logs in once (via noVNC). Subsequent runs reuse cookies.

On the Emergent sandbox this may not have Playwright browsers installed, so
each function falls back to 'manual' mode: it creates a job record marked
'pending_manual' which the user fulfills by uploading the result via the UI.
"""
import os
import asyncio
import uuid
from pathlib import Path
from typing import Optional

try:
    from playwright.async_api import async_playwright  # type: ignore
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False


PROFILE_DIR = os.environ.get("PLAYWRIGHT_PROFILE_DIR", "/app/data/playwright-profile")
IMAGES_DIR = os.environ.get("IMAGES_DIR", "/app/data/images")
VIDEOS_DIR = os.environ.get("VIDEOS_DIR", "/app/data/videos")
GOOGLE_FLOW_URL = os.environ.get("GOOGLE_FLOW_URL", "https://labs.google/fx/tools/flow")
GROK_URL = os.environ.get("GROK_URL", "https://grok.com")


class BrowserAutomation:
    """
    Real automation uses persistent context. Selectors below are placeholders
    since Google Flow / Grok UI changes frequently. Users may need to tweak
    the CSS selectors in this file to match current UI.
    """

    async def _get_context(self, headless: bool = False):
        if not PLAYWRIGHT_AVAILABLE:
            raise RuntimeError("Playwright not installed. On VPS: pip install playwright && playwright install chromium")
        Path(PROFILE_DIR).mkdir(parents=True, exist_ok=True)
        pw = await async_playwright().start()
        context = await pw.chromium.launch_persistent_context(
            user_data_dir=PROFILE_DIR,
            headless=headless,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        return pw, context

    async def generate_image_google_flow(self, prompt: str) -> Optional[str]:
        """
        Automate Google Flow to generate an image from prompt.
        Returns path to saved image file, or None if failed.
        SELECTORS BELOW ARE PLACEHOLDERS - update to match current Google Flow UI.
        """
        if not PLAYWRIGHT_AVAILABLE:
            return None
        Path(IMAGES_DIR).mkdir(parents=True, exist_ok=True)
        pw, context = await self._get_context(headless=False)
        try:
            page = await context.new_page()
            await page.goto(GOOGLE_FLOW_URL, wait_until="networkidle", timeout=60000)
            # TODO: update selectors when running on VPS
            await page.wait_for_selector("textarea", timeout=30000)
            await page.fill("textarea", prompt)
            await page.keyboard.press("Enter")
            # Wait for image to appear - adjust selector to current UI
            img_el = await page.wait_for_selector("img[src^='https://']", timeout=180000)
            src = await img_el.get_attribute("src")
            if not src:
                return None
            # Download image
            import httpx
            async with httpx.AsyncClient() as client:
                r = await client.get(src)
                r.raise_for_status()
                filename = f"img_{uuid.uuid4().hex}.png"
                fpath = Path(IMAGES_DIR) / filename
                fpath.write_bytes(r.content)
                return str(fpath)
        except Exception as e:
            print(f"[BrowserAutomation] google flow error: {e}")
            return None
        finally:
            await context.close()
            await pw.stop()

    async def generate_video_grok(self, prompt: str, image_path: Optional[str] = None) -> Optional[str]:
        """
        Automate Grok to generate a video from an image + prompt.
        Returns path to saved video file, or None if failed.
        SELECTORS BELOW ARE PLACEHOLDERS.
        """
        if not PLAYWRIGHT_AVAILABLE:
            return None
        Path(VIDEOS_DIR).mkdir(parents=True, exist_ok=True)
        pw, context = await self._get_context(headless=False)
        try:
            page = await context.new_page()
            await page.goto(GROK_URL, wait_until="networkidle", timeout=60000)
            # TODO: update selectors when running on VPS
            if image_path:
                # File input selector - adjust to Grok's current file input
                await page.set_input_files("input[type=file]", image_path)
                await page.wait_for_timeout(2000)
            await page.wait_for_selector("textarea", timeout=30000)
            await page.fill("textarea", prompt)
            await page.keyboard.press("Enter")
            # Wait for video element - adjust selector
            video_el = await page.wait_for_selector("video source, video[src]", timeout=300000)
            src = await video_el.get_attribute("src")
            if not src:
                return None
            import httpx
            async with httpx.AsyncClient() as client:
                r = await client.get(src)
                r.raise_for_status()
                filename = f"vid_{uuid.uuid4().hex}.mp4"
                fpath = Path(VIDEOS_DIR) / filename
                fpath.write_bytes(r.content)
                return str(fpath)
        except Exception as e:
            print(f"[BrowserAutomation] grok error: {e}")
            return None
        finally:
            await context.close()
            await pw.stop()

    def playwright_available(self) -> bool:
        return PLAYWRIGHT_AVAILABLE


automation = BrowserAutomation()
