# Scene Studio — VPS Control Panel

A self-hostable dashboard that orchestrates your AI video pipeline **without API costs** for image/video generation. It coordinates:

- **Airtable** — pulls per-scene image + video prompts
- **Google Flow (labs.google/fx)** — generates images via your logged-in account (headed Playwright with a persistent profile so you only log in once)
- **Grok xAI** — generates videos via your subscription (same persistent-browser approach)
- **Remotion** — final render, triggered from the UI with live logs
- **n8n** — receive scenes via webhook and/or trigger n8n from the panel
- **Local disk storage** — everything lives on your VPS

## Stack
- React 19 + Tailwind + Radix (dark, Linear-inspired UI)
- FastAPI + Motor + MongoDB
- Playwright (persistent Chromium profile) + optional noVNC for one-time login
- Docker Compose for VPS deployment

## Quick start (VPS)
```bash
git clone <this-repo>
cd scene-studio
cp .env.example .env
# fill in AIRTABLE_* and REACT_APP_BACKEND_URL
docker compose up -d
```

Open `http://<your-vps>:3000`.

### First-time browser login (Google Flow + Grok)
Run the optional browser container that ships a full desktop over noVNC:
```bash
docker compose --profile browser up -d browser
```
Open `http://<your-vps>:6080` in your browser → launch Chrome inside noVNC → log in to Google Flow and Grok. Cookies persist under `./data/playwright-profile` and are reused by all future automated runs.

### Remotion
Put your Remotion project at `./remotion/` next to `docker-compose.yml`. The backend runs `npx remotion render <composition> <output>` from that directory when you click "Start Render".

### n8n webhook
n8n → HTTP Request node → `POST http://<panel>:8001/api/webhooks/n8n/scenes` with header `x-webhook-secret: <your-secret>` and JSON body:
```json
{ "scenes": [ { "scene_number": 1, "image_prompt": "...", "video_prompt": "..." } ] }
```

### Endpoints (selection)
- `POST /api/scenes/sync-airtable` — pull latest rows
- `POST /api/images/generate` `{scene_id}` — enqueue image gen
- `POST /api/videos/generate-selected` — batch-video-gen all `selected=true` images
- `POST /api/render/start` `{composition, resolution, output_name}` — kick off Remotion
- `GET  /api/files/images/{filename}` — serve generated image
- `GET  /api/files/videos/{filename}` — serve generated video

### Automation vs manual
Every generation job automatically falls back to `pending_manual` if Playwright isn't installed or the selectors have drifted. You can upload the resulting image/video via the UI to keep the pipeline moving.

**Note on selectors**: Google Flow and Grok UIs change frequently. Update the CSS selectors in `backend/services/browser_automation.py` when they break.
