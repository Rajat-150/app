# Scene Studio — PRD

## Original problem statement
User has a VPS running n8n. n8n already generates a script, splits into scenes, and writes image/video prompts to Airtable. User wants a web-hostable control panel that:
- Reads scenes from Airtable
- Generates images via Google Flow using their **logged-in account** (no paid API)
- Lets them review/select images locally on the VPS
- Sends selected images to **Grok xAI** (paid subscription) for video generation
- Saves images/videos to VPS disk
- Triggers Remotion final render from the panel
- Integrates with n8n

## User personas
- Solo content creator running an automated video pipeline on a self-managed VPS.

## Core requirements (static)
1. VPS-first: single-command deploy via Docker Compose.
2. Cost-free generation: use user's Google Flow + Grok logins via headed Playwright with a persistent Chromium profile.
3. Manual-upload fallback for every generation step (in case selectors drift).
4. Airtable + n8n webhook ingestion for scenes.
5. Trigger `npx remotion render` from the UI with a live streaming log terminal.
6. Local disk storage for all image/video assets.

## Architecture
- **Frontend**: React 19 + Tailwind + Radix (dark Linear-inspired UI, Outfit/IBM Plex Sans/JetBrains Mono fonts).
- **Backend**: FastAPI + Motor async MongoDB. Prefixed `/api`. Async job runner via `asyncio.create_task`.
- **Automation**: Playwright chromium (`services/browser_automation.py`) with persistent user-data-dir. Placeholder selectors that need tweaking on VPS when UIs change.
- **Storage**: `/data/images`, `/data/videos`, `/data/playwright-profile` on VPS.
- **Remotion**: subprocess to `/data/remotion`, log streaming captured in-memory per job.
- **Deploy**: `docker-compose.yml` with mongo + backend + frontend + optional `browser` (dorowu ubuntu-desktop-lxde-vnc) service for one-time login via noVNC.

## What's been implemented (2026-01-15)
- Full backend with 20+ endpoints:
  - Scenes CRUD + Airtable sync + n8n webhook (secret-protected)
  - Image generation queue with pending_manual fallback + manual upload
  - Video generation (per-image and batch "generate-selected") + manual upload
  - Video review (approve/reject)
  - Remotion render trigger + job list + live log fetch
  - File serving for images/videos
  - Config endpoint reporting environment status
- Full frontend with pages: Dashboard, Scenes, Images (masonry gallery + select checkboxes), Videos (playback + approve/reject), Render (config + terminal log), Jobs, Settings.
- Sidebar navigation with active state, dark theme, mono badges.
- Docker Compose deployment: `backend/Dockerfile` (Python + Node + ffmpeg + Playwright), `frontend/Dockerfile` (Node build + nginx), optional noVNC browser service.
- Starter Remotion project at `/app/remotion/` (Root.tsx + MainVideo.tsx).
- `.env.example`, comprehensive `README.md` with VPS deploy steps.
- Backend testing 18/18 endpoints passing.

## Backlog / Next steps
- **P0** — On VPS: verify Google Flow / Grok selectors and adjust `browser_automation.py`. UIs change frequently.
- **P1** — SSE endpoint for render logs (currently polled every 2s).
- **P1** — WebSocket for live job status.
- **P2** — Multi-user auth (currently open — assumes VPS is behind auth proxy or Tailscale).
- **P2** — Auto-cleanup of old renders/images.
- **P2** — Bulk delete + timeline preview across scenes.
- **P2** — Automatic n8n trigger from panel (Start Pipeline button).

## Deployment (VPS)
```
git clone <repo> && cd scene-studio
cp .env.example .env  # fill AIRTABLE_* and secrets
docker compose up -d
docker compose --profile browser up -d browser   # for one-time login
```
