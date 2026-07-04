"""
Google Flow automation via Playwright, using the persistent Chrome profile that
was populated by the one-time noVNC login.

Runs headed (via Xvfb DISPLAY=:99) so that Google's anti-bot heuristics are
less aggressive AND so you can watch it in the noVNC viewer.
"""
import asyncio
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any

from playwright.async_api import async_playwright, Page, TimeoutError as PWTimeout

import flow_selectors as S

PROFILE_DIR = os.environ.get("PLAYWRIGHT_PROFILE_DIR", "/data/playwright-profile")
IMAGES_DIR = Path(os.environ.get("IMAGES_DIR", "/data/images"))
SCREENSHOTS_DIR = Path(os.environ.get("SCREENSHOTS_DIR", "/data/screenshots"))
IMAGES_DIR.mkdir(parents=True, exist_ok=True)
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


def today_project_name() -> str:
    return "Scene Studio - " + datetime.now(timezone.utc).strftime("%Y-%m-%d")


async def _try(page: Page, selector: str, action: str = "click", timeout: int = 8000, **kwargs) -> bool:
    """Try one selector for a given action; return True on success, False if not found in time."""
    try:
        loc = page.locator(selector).first
        await loc.wait_for(state="visible", timeout=timeout)
        if action == "click":
            await loc.click()
        elif action == "fill":
            await loc.fill(kwargs["value"])
        elif action == "type":
            await loc.type(kwargs["value"], delay=30)
        return True
    except (PWTimeout, Exception):
        return False


async def dump_debug(page: Page, tag: str) -> str:
    """Screenshot + HTML dump for debugging when a step fails."""
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    png = SCREENSHOTS_DIR / f"flow_{tag}_{stamp}.png"
    html = SCREENSHOTS_DIR / f"flow_{tag}_{stamp}.html"
    try:
        await page.screenshot(path=str(png), full_page=True)
        html.write_text(await page.content(), encoding="utf-8")
    except Exception:
        pass
    return str(png)


async def open_or_create_today_project(page: Page) -> None:
    """Look for today's project tile; if not found, create it."""
    name = today_project_name()
    # Try to click existing project tile
    tile_sel = S.PROJECT_TILE_BY_NAME.replace("{name}", name)
    try:
        await page.locator(tile_sel).first.click(timeout=5000)
        await page.wait_for_load_state("networkidle", timeout=15000)
        return
    except (PWTimeout, Exception):
        pass

    # Create new project
    if not await _try(page, S.NEW_PROJECT_BUTTON, "click", timeout=10000):
        await dump_debug(page, "new_project_button_missing")
        raise RuntimeError("Could not find 'New project' button — update flow_selectors.NEW_PROJECT_BUTTON")

    # Type project name if a name input appears
    await asyncio.sleep(1.2)
    filled = await _try(page, S.PROJECT_NAME_INPUT, "fill", timeout=4000, value=name)
    if filled:
        await _try(page, S.CREATE_CONFIRM_BUTTON, "click", timeout=4000)
    # else: some flows create with a default name and land you directly on the prompt page
    await page.wait_for_load_state("networkidle", timeout=20000)


async def apply_settings(page: Page, aspect: str, count: str) -> None:
    """Open the Agent settings gear and apply the requested aspect + count."""
    if not await _try(page, S.SETTINGS_GEAR, "click", timeout=4000):
        # Not fatal — settings might be already correct
        return

    aspect_map = {
        "16:9": S.ASPECT_16_9, "4:3": S.ASPECT_4_3, "1:1": S.ASPECT_1_1,
        "3:4": S.ASPECT_3_4, "9:16": S.ASPECT_9_16,
    }
    count_map = {"1x": S.COUNT_1X, "x2": S.COUNT_X2, "x3": S.COUNT_X3, "x4": S.COUNT_X4}

    await _try(page, aspect_map.get(aspect, S.ASPECT_16_9), "click", timeout=3000)
    await _try(page, count_map.get(count, S.COUNT_1X), "click", timeout=3000)
    await _try(page, S.SETTINGS_SAVE, "click", timeout=3000)
    await asyncio.sleep(0.5)


async def paste_prompt_and_generate(page: Page, prompt: str) -> None:
    """Type the prompt into the input and press the Generate button."""
    if not await _try(page, S.PROMPT_INPUT, "click", timeout=15000):
        await dump_debug(page, "prompt_input_missing")
        raise RuntimeError("Prompt input not found — update flow_selectors.PROMPT_INPUT")

    # Use keyboard to clear + type (more reliable than fill on contenteditable)
    await page.keyboard.press("Control+A")
    await page.keyboard.press("Delete")
    # Type in chunks for very long prompts
    for chunk in [prompt[i:i+400] for i in range(0, len(prompt), 400)]:
        await page.keyboard.type(chunk, delay=5)

    if not await _try(page, S.GENERATE_BUTTON, "click", timeout=8000):
        await dump_debug(page, "generate_button_missing")
        raise RuntimeError("Generate button not found — update flow_selectors.GENERATE_BUTTON")


async def wait_for_and_download_image(page: Page, scene_key: str) -> str:
    """Wait for a new generated image to appear, then save its bytes as {scene_key}_{hash}.png."""
    img = page.locator(S.GENERATED_IMAGE).first
    try:
        await img.wait_for(state="visible", timeout=180_000)
    except PWTimeout:
        await dump_debug(page, "image_timeout")
        raise RuntimeError("Image never appeared within 3 min — update flow_selectors.GENERATED_IMAGE or check credits")

    src = await img.get_attribute("src")
    if not src:
        await dump_debug(page, "image_no_src")
        raise RuntimeError("Image has no src attribute")

    # Fetch via the page's fetch (uses browser session/cookies)
    data_url_js = """
    async (u) => {
      const r = await fetch(u, { credentials: 'include' });
      const buf = await r.arrayBuffer();
      return Array.from(new Uint8Array(buf));
    }
    """
    byte_array = await page.evaluate(data_url_js, src)
    safe_key = re.sub(r"[^A-Za-z0-9._-]", "_", scene_key or "img")
    filename = f"{safe_key}_{uuid.uuid4().hex[:6]}.png"
    fpath = IMAGES_DIR / filename
    fpath.write_bytes(bytes(byte_array))
    return str(fpath)


async def generate_image(prompt: str, scene_key: str, settings: Dict[str, Any]) -> Dict[str, Any]:
    """Full end-to-end: launch → open/create project → apply settings → prompt → download."""
    Path(PROFILE_DIR).mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        # channel="chrome" uses installed Google Chrome (less bot-detectable than bundled Chromium)
        context = await pw.chromium.launch_persistent_context(
            user_data_dir=PROFILE_DIR,
            channel="chrome",
            headless=False,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--start-maximized"],
            viewport=None,
            no_viewport=True,
        )
        try:
            page = context.pages[0] if context.pages else await context.new_page()
            await page.goto(S.FLOW_URL, wait_until="networkidle", timeout=60000)

            # If Google redirected to a login page, bail out with a clear message
            if "accounts.google.com" in page.url:
                await dump_debug(page, "login_required")
                raise RuntimeError("Not logged in. Open http://<vps>:6080 (noVNC), launch Chrome, sign in to Google Flow, then retry.")

            await open_or_create_today_project(page)
            await apply_settings(page, settings.get("aspect", "16:9"), settings.get("count", "1x"))
            await paste_prompt_and_generate(page, prompt)
            path = await wait_for_and_download_image(page, scene_key)
            return {"ok": True, "path": path, "filename": Path(path).name}
        except Exception as e:
            debug = await dump_debug(page, "fatal")
            return {"ok": False, "error": str(e), "debug_screenshot": debug}
        finally:
            await context.close()
