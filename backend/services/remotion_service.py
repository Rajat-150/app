"""Trigger Remotion CLI renders as subprocess, stream logs."""
import os
import asyncio
import uuid
from pathlib import Path
from typing import Dict, Optional
from datetime import datetime, timezone


REMOTION_DIR = os.environ.get("REMOTION_PROJECT_DIR", "/app/remotion")


class RemotionService:
    def __init__(self):
        # In-memory log store keyed by job_id
        self.jobs: Dict[str, Dict] = {}

    async def start_render(
        self,
        composition: str = "MainVideo",
        output_name: Optional[str] = None,
        resolution: Optional[str] = None,
        props: Optional[Dict] = None,
    ) -> str:
        job_id = str(uuid.uuid4())
        out_name = output_name or f"render_{job_id[:8]}.mp4"
        out_path = Path(REMOTION_DIR) / "out" / out_name
        out_path.parent.mkdir(parents=True, exist_ok=True)

        cmd = ["npx", "remotion", "render", composition, str(out_path)]
        if resolution:
            # e.g., "1920x1080"
            try:
                w, h = resolution.lower().split("x")
                cmd += ["--width", w, "--height", h]
            except ValueError:
                pass

        self.jobs[job_id] = {
            "id": job_id,
            "status": "running",
            "composition": composition,
            "output_path": str(out_path),
            "logs": [],
            "started_at": datetime.now(timezone.utc).isoformat(),
            "finished_at": None,
        }

        asyncio.create_task(self._run(job_id, cmd))
        return job_id

    async def _run(self, job_id: str, cmd):
        job = self.jobs[job_id]
        try:
            if not Path(REMOTION_DIR).exists():
                job["logs"].append(f"[ERROR] Remotion project dir not found: {REMOTION_DIR}")
                job["status"] = "failed"
                job["finished_at"] = datetime.now(timezone.utc).isoformat()
                return

            job["logs"].append(f"$ {' '.join(cmd)}")
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=REMOTION_DIR,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
            assert proc.stdout is not None
            async for line in proc.stdout:
                job["logs"].append(line.decode(errors="replace").rstrip())
                if len(job["logs"]) > 5000:
                    job["logs"] = job["logs"][-3000:]
            rc = await proc.wait()
            job["status"] = "done" if rc == 0 else "failed"
            job["logs"].append(f"[exit code: {rc}]")
        except Exception as e:
            job["status"] = "failed"
            job["logs"].append(f"[EXCEPTION] {e}")
        finally:
            job["finished_at"] = datetime.now(timezone.utc).isoformat()

    def get_job(self, job_id: str) -> Optional[Dict]:
        return self.jobs.get(job_id)

    def list_jobs(self):
        return sorted(self.jobs.values(), key=lambda j: j["started_at"], reverse=True)


remotion = RemotionService()
