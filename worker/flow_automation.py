"""
Google Flow automation via Playwright, using the persistent Chrome profile that
was populated by the one-time noVNC login.
"""
import asyncio
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any

from playwright.async_api import async_playwright, Page, TimeoutError as PWTimeout

import flow_selectors as S

logger = logging.getLogger("flow")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [flow] %(message)s")

PROFILE_DIR = os.environ.get("PLAYWRIGHT_PROFILE_DIR", "/data/playwright-profile")
IMAGES_DIR = Path(os.environ.get("IMAGES_DIR", "/data/images"))
SCREENSHOTS_DIR = Path(os.environ.get("SCREENSHOTS_DIR", "/data/screenshots"))
IMAGES_DIR.mkdir(parents=True, exist_ok=True)
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


def today_project_name() -> str:
    return "Scene Studio - " + datetime.now(timezone.utc).strftime("%Y-%m-%d")


async def _try(page: Page, selector: str, action: str = "click", timeout: int = 8000, **kwargs) -> bool:
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


async def dump_debug(page: Optional[Page], tag: str) -> str:
    if page is None:
        return ""
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    png = SCREENSHOTS_DIR / f"flow_{tag}_{stamp}.png"
    html = SCREENSHOTS_DIR / f"flow_{tag}_{stamp}.html"
    try:
        await page.screenshot(path=str(png), full_page=True)
        html.write_text(await page.content(), encoding="utf-8")
    except Exception as e:
        logger.warning("dump_debug failed: %s", e)
    return str(png)


async def ensure_in_project(page: Page) -> None:
    """Land on a Google Flow project page with the prompt bar accessible.

    Strategy:
      - If URL already contains /project/, we're good.
      - Otherwise try to click an existing project tile.
      - Only if no tile exists, click a *specifically-labelled* 'New project' button
        (never a generic 'Create', which sometimes matches 'Create character').
      - Finally, press Escape a few times to dismiss any modal overlay.
    """
    for _ in range(4):
        await page.keyboard.press("Escape")
        await asyncio.sleep(0.2)

    if "/project/" in page.url:
        await asyncio.sleep(0.6)
        return

    # Look for existing project tile (href-based, most stable)
    try:
        tile = page.locator('a[href*="/project/"]').first
        await tile.click(timeout=6000)
        await page.wait_for_load_state("networkidle", timeout=15000)
        for _ in range(4):
            await page.keyboard.press("Escape")
            await asyncio.sleep(0.2)
        return
    except Exception:
        pass

    # Fall back: click a strictly-named 'New project' button
    for sel in [
        'button:has-text("New project")',
        'button:has-text("New Project")',
        'button[aria-label="New project"]',
    ]:
        if await _try(page, sel, "click", timeout=4000):
            await page.wait_for_load_state("networkidle", timeout=15000)
            for _ in range(4):
                await page.keyboard.press("Escape")
                await asyncio.sleep(0.2)
            return

    await dump_debug(page, "no_project")
    raise RuntimeError("Could not enter any project — none exist and 'New project' button not found")


async def open_or_create_today_project(page: Page) -> None:
    """Backward-compatible alias — routing to the safer ensure_in_project()."""
    await ensure_in_project(page)


async def apply_settings(page: Page, aspect: str, count: str) -> None:
    if not await _try(page, S.SETTINGS_GEAR, "click", timeout=4000):
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
    # Dismiss any overlay modals first (asset picker, character sheet, etc)
    for _ in range(4):
        await page.keyboard.press("Escape")
        await asyncio.sleep(0.2)

    focus_js = """
    () => {
      const cands = Array.from(document.querySelectorAll(
        'textarea, [contenteditable="true"], input[type="text"], input:not([type])'
      ));
      const visible = cands.filter(el => {
        if (!el.offsetParent) return false;
        const r = el.getBoundingClientRect();
        if (r.height < 20 || r.width < 100) return false;
        // Exclude anything labelled 'search' — that's Google Flow's asset search bar.
        const meta = ((el.placeholder || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('data-placeholder') || '')).toLowerCase();
        if (/search|find|look for/.test(meta)) return false;
        return true;
      });
      const totalOnPage = cands.length;
      if (!visible.length) return { ok: false, count: totalOnPage };
      // Prefer the bottom-most (highest .top means lowest on screen)
      visible.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
      const target = visible[0];
      target.focus();
      target.click();
      target.scrollIntoView({ block: 'center' });
      return {
        ok: true,
        tag: target.tagName,
        placeholder: target.placeholder || target.getAttribute('aria-label') || target.getAttribute('data-placeholder') || '',
        top: target.getBoundingClientRect().top,
        totalOnPage,
      };
    }
    """
    r = await page.evaluate(focus_js)
    logger.info("focus attempt: %s", r)
    if not r.get("ok"):
        await dump_debug(page, "prompt_input_missing")
        raise RuntimeError(f"Could not find prompt input (visible candidates on page: {r.get('count')})")
    await asyncio.sleep(0.4)

    await page.keyboard.press("Control+A")
    await page.keyboard.press("Delete")
    for chunk in [prompt[i:i+400] for i in range(0, len(prompt), 400)]:
        await page.keyboard.type(chunk, delay=5)

    await asyncio.sleep(0.8)

    # Strategy 2 (most reliable for Google Flow): find the submit button by GEOMETRY,
    # not DOM structure — pick the button closest to the right edge of the input we
    # just filled (which is the → arrow button).
    js = """
    () => {
      // Find the filled input (visible, has text, bottom-most, not a search bar)
      const cands = Array.from(document.querySelectorAll('textarea, [contenteditable="true"], input[type="text"], input:not([type])'))
        .filter(el => {
          if (!el.offsetParent) return false;
          const meta = ((el.placeholder || '') + ' ' + (el.getAttribute('aria-label') || '')).toLowerCase();
          if (/search|find/.test(meta)) return false;
          const v = el.value || el.textContent || '';
          return v.trim().length > 3;
        });
      if (!cands.length) return { ok: false, reason: 'no filled input' };
      cands.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
      const input = cands[0];
      const ir = input.getBoundingClientRect();

      // All visible non-disabled buttons anywhere on the page
      const allBtns = Array.from(document.querySelectorAll('button, [role="button"]'))
        .filter(b => b.offsetParent && !b.disabled);

      // Score each button by proximity to input's right edge, vertical alignment,
      // and icon-button-ness. Small buttons with just an svg are strong candidates.
      const scored = allBtns.map(b => {
        const r = b.getBoundingClientRect();
        // Must overlap vertically with input (within +/- 120px of input center)
        const inputCy = ir.top + ir.height / 2;
        const btnCy = r.top + r.height / 2;
        const vDist = Math.abs(inputCy - btnCy);
        // Must be to the right of the input's left edge (or below-right)
        const isRight = r.left >= ir.left - 10;
        // Distance from button center to input's right edge
        const hDist = Math.abs(r.left - ir.right);
        // Icon-only heuristic
        const text = (b.innerText || '').trim();
        const iconOnly = text.length === 0 && b.querySelector('svg') !== null;
        const areaSmall = r.width * r.height < 5000; // small buttons preferred
        let score = 1000;
        score -= vDist;               // closer vertically -> higher score
        score -= hDist * 0.7;         // closer horizontally -> higher
        if (iconOnly) score += 150;
        if (areaSmall) score += 100;
        if (!isRight) score -= 400;
        // aria-label bonuses
        const lbl = (b.getAttribute('aria-label') || '').toLowerCase();
        if (/generat|submit|send|run|create|prompt/.test(lbl)) score += 300;
        return { b, score, r, lbl, text, iconOnly };
      });

      // Filter out obviously bad candidates
      const good = scored.filter(s => s.score > 0);
      good.sort((a, b) => b.score - a.score);
      if (!good.length) return { ok: false, reason: 'no button near input', totalBtns: allBtns.length };

      const top = good.slice(0, 3);
      good[0].b.click();
      return {
        ok: true,
        clicked: {
          score: good[0].score,
          rect: { top: good[0].r.top, left: good[0].r.left, w: good[0].r.width, h: good[0].r.height },
          lbl: good[0].lbl,
          text: good[0].text,
          iconOnly: good[0].iconOnly,
        },
        top3: top.map(s => ({ score: s.score, lbl: s.lbl, text: s.text, rect: [s.r.top|0, s.r.left|0, s.r.width|0] })),
      };
    }
    """
    result = await page.evaluate(js)
    logger.info("JS-click result: %s", result)
    if result.get("ok"):
        return

    # Strategy 3: keyboard fallbacks
    logger.info("falling back to keyboard shortcuts")
    await page.keyboard.press("Control+Enter")
    await asyncio.sleep(1.5)
    await page.keyboard.press("Enter")
    await asyncio.sleep(1.5)


async def wait_for_and_download_image(page: Page, scene_key: str) -> str:
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
    """Robust wrapper — never lets an unhandled exception escape."""
    Path(PROFILE_DIR).mkdir(parents=True, exist_ok=True)
    # Clean stale SingletonLock files from any previous Chrome session that didn't
    # exit cleanly (happens after manual noVNC login). Chrome refuses to launch otherwise.
    for lock in ("SingletonLock", "SingletonCookie", "SingletonSocket"):
        try:
            (Path(PROFILE_DIR) / lock).unlink()
            logger.info("removed stale %s", lock)
        except FileNotFoundError:
            pass
        except Exception as e:
            logger.warning("could not remove %s: %s", lock, e)
    # Kill any orphaned Chrome / chromedriver processes that may still be holding the profile
    try:
        import subprocess
        subprocess.run(["pkill", "-f", "chrome"], check=False, timeout=5)
        await asyncio.sleep(0.5)
    except Exception:
        pass

    context = None
    page = None
    try:
        async with async_playwright() as pw:
            # 1) Launch Chrome
            try:
                context = await pw.chromium.launch_persistent_context(
                    user_data_dir=PROFILE_DIR,
                    channel="chrome",
                    headless=False,
                    args=[
                        "--no-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-blink-features=AutomationControlled",
                        "--start-maximized",
                    ],
                    viewport=None,
                    no_viewport=True,
                )
            except Exception as e:
                logger.exception("chrome launch failed")
                return {
                    "ok": False,
                    "error": f"chrome launch failed: {type(e).__name__}: {e}",
                    "hint": "Check that /data/playwright-profile is writable and DISPLAY=:99 is set (Xvfb must be running).",
                }

            # 2) Automation
            try:
                page = context.pages[0] if context.pages else await context.new_page()
                await page.goto(S.FLOW_URL, wait_until="networkidle", timeout=60000)

                if "accounts.google.com" in page.url or "signin" in page.url.lower():
                    debug = await dump_debug(page, "login_required")
                    return {
                        "ok": False,
                        "error": "Not logged in. Open http://<vps>:6080 (noVNC) → launch google-chrome → sign in to Google Flow → close Chrome. Cookies are then persisted.",
                        "debug_screenshot": debug,
                    }

                await open_or_create_today_project(page)
                await apply_settings(page, settings.get("aspect", "16:9"), settings.get("count", "1x"))
                await paste_prompt_and_generate(page, prompt)
                path = await wait_for_and_download_image(page, scene_key)
                return {"ok": True, "path": path, "filename": Path(path).name}
            except Exception as e:
                logger.exception("automation error")
                debug = await dump_debug(page, "fatal")
                return {"ok": False, "error": f"{type(e).__name__}: {e}", "debug_screenshot": debug}
            finally:
                if context is not None:
                    try:
                        await context.close()
                    except Exception:
                        pass
    except Exception as e:
        logger.exception("outer error")
        return {"ok": False, "error": f"outer: {type(e).__name__}: {e}"}
