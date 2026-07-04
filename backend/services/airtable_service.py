"""Airtable integration service - fetches scenes from user's Airtable base."""
import os
import httpx
from typing import List, Dict, Any


class AirtableService:
    def __init__(self):
        self.api_key = os.environ.get("AIRTABLE_API_KEY", "")
        self.base_id = os.environ.get("AIRTABLE_BASE_ID", "")
        self.table_name = os.environ.get("AIRTABLE_TABLE_NAME", "Scenes")
        self.f_image = os.environ.get("AIRTABLE_FIELD_IMAGE_PROMPT", "image_prompt")
        self.f_video = os.environ.get("AIRTABLE_FIELD_VIDEO_PROMPT", "video_prompt")
        self.f_scene = os.environ.get("AIRTABLE_FIELD_SCENE_NUMBER", "shot_id")
        self.f_scene_id = os.environ.get("AIRTABLE_FIELD_SCENE_ID", "scene_id")
        self.f_status = os.environ.get("AIRTABLE_FIELD_STATUS", "Status")
        self.f_story = os.environ.get("AIRTABLE_FIELD_STORY_NAME", "Story_name")
        self.f_line = os.environ.get("AIRTABLE_FIELD_LINE", "full_line")
        self.f_duration = os.environ.get("AIRTABLE_FIELD_DURATION", "estimated_duration_sec")

    def is_configured(self) -> bool:
        return (
            self.api_key
            and not self.api_key.startswith("pat_placeholder")
            and self.base_id
            and not self.base_id.startswith("appXXXX")
        )

    async def fetch_scenes(self) -> List[Dict[str, Any]]:
        """Fetch all scene rows from Airtable."""
        if not self.is_configured():
            return self._demo_scenes()

        url = f"https://api.airtable.com/v0/{self.base_id}/{self.table_name}"
        headers = {"Authorization": f"Bearer {self.api_key}"}
        results = []
        offset = None
        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                params = {"pageSize": 100}
                if offset:
                    params["offset"] = offset
                resp = await client.get(url, headers=headers, params=params)
                resp.raise_for_status()
                data = resp.json()
                for r in data.get("records", []):
                    fields = r.get("fields", {})
                    results.append({
                        "airtable_id": r["id"],
                        "scene_number": fields.get(self.f_scene),
                        "scene_id": fields.get(self.f_scene_id, ""),
                        "image_prompt": fields.get(self.f_image, ""),
                        "video_prompt": fields.get(self.f_video, ""),
                        "airtable_status": fields.get(self.f_status, ""),
                        "story_name": fields.get(self.f_story, ""),
                        "line_text": fields.get(self.f_line, ""),
                        "duration_sec": fields.get(self.f_duration),
                        "raw_fields": fields,
                    })
                offset = data.get("offset")
                if not offset:
                    break
        return results

    def _demo_scenes(self) -> List[Dict[str, Any]]:
        return [
            {
                "airtable_id": f"demo-{i}",
                "scene_number": f"S01-L{i:02d}-A",
                "scene_id": "S01",
                "image_prompt": f"Scene {i}: A cinematic wide shot of a neon-lit cyberpunk alley at midnight, rain-slicked pavement.",
                "video_prompt": f"Scene {i}: Slow dolly-in with subtle rain motion, steam rising from vents.",
                "airtable_status": "pending" if i > 2 else "video_generated",
                "story_name": "Demo Story",
                "line_text": f"This is spoken line number {i}.",
                "duration_sec": 3.5 + i,
                "raw_fields": {},
            }
            for i in range(1, 7)
        ]


airtable = AirtableService()
