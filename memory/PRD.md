# Scene Studio — PRD (updated 2026-01-15)

## Original ask
Solo creator on VPS: n8n generates script → scenes in Airtable → images via Google Flow (user's paid account) → user selects → videos via Grok → Remotion final render.

## Current implementation
- **Backend**: FastAPI + Motor + MongoDB. 25+ endpoints (scenes/images/videos/render/jobs/veo).
- **Frontend**: React + Tailwind. Pages: Dashboard, Scenes (story-grouped, collapsible, checkboxes, Scene_key column), Images, Videos, Render, VEO Batches, Browser Login, Jobs, Settings.
- **Worker container**: Xvfb + noVNC + Chrome + Playwright — used ONLY for one-time Google login. Extension does the actual automation.
- **Extension integration** (Path B - chosen 2026-01-15): user installs VEO Automation extension inside noVNC Chrome ($3/mo). Scene Studio exports prompt batches as .txt. Extension consumes them. Chrome downloads land in `/data/downloads`. Backend watcher (poll every 3s) matches new files to open batches FIFO and links to scenes.
- **Deploy**: docker-compose (mongo + backend + frontend + optional worker).

## Backlog
- **P0**: Same VEO integration for Grok video generation (image + prompt → video)
- **P1**: Progress notifications in frontend (SSE/WebSocket instead of 3s polling)
- **P2**: Delete/regenerate batch item, retry failed
