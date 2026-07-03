"""Airtable integration service - fetches scenes from user's Airtable base."""
import os
import httpx
from typing import List, Dict, Any


class AirtableService:
    def __init__(self):
        self.api_key = os.environ.get("AIRTABLE_API_KEY", "")
        self.base_id = os.environ.get("AIRTABLE_BASE_ID", "")
        self.table_name = os.environ.get("AIRTABLE_TABLE_NAME", "Scenes")
        self.f_image = os.environ.get("AIRTABLE_FIELD_IMAGE_PROMPT", "Image Prompt")
        self.f_video = os.environ.get("AIRTABLE_FIELD_VIDEO_PROMPT", "Video Prompt")
        self.f_scene = os.environ.get("AIRTABLE_FIELD_SCENE_NUMBER", "Scene Number")

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
            # Return placeholder demo data so UI is usable before user adds real creds
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
                        "image_prompt": fields.get(self.f_image, ""),
                        "video_prompt": fields.get(self.f_video, ""),
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
                "scene_number": i,
                "image_prompt": f"Scene {i}: A cinematic wide shot of a neon-lit cyberpunk alley at midnight, rain-slicked pavement reflecting purple and red signs.",
                "video_prompt": f"Scene {i}: Slow dolly-in with subtle rain motion, steam rising from vents.",
                "raw_fields": {},
            }
            for i in range(1, 7)
        ]


airtable = AirtableService()
