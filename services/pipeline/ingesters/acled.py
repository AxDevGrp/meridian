"""
ACLED conflict event ingester.
"""

import httpx
from typing import Any
from datetime import datetime

from .base import BaseIngester
from config import settings


ACLED_API_URL = "https://api.acleddata.com/acled/read"


class ACLEDIngester(BaseIngester):
    """Ingests conflict event data from ACLED."""

    def __init__(self, interval_seconds: int = 600):
        super().__init__("acled", interval_seconds)

    async def fetch(self) -> list[dict[str, Any]]:
        """Fetch recent conflict events from ACLED API."""
        if not settings.ACLED_API_KEY or not settings.ACLED_EMAIL:
            self.logger.warning("ACLED credentials not configured, using sample data")
            return self._get_sample_data()

        params = {
            "key": settings.ACLED_API_KEY,
            "email": settings.ACLED_EMAIL,
            "limit": 200,
            "page": 1,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(ACLED_API_URL, params=params)
            response.raise_for_status()
            data = response.json()

        events = data.get("data", [])
        self.logger.info(f"Fetched {len(events)} conflict events from ACLED")
        return events

    async def normalize(self, raw_data: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Normalize ACLED data into GeoEvent format."""
        events = []
        for event in raw_data:
            lat = event.get("latitude")
            lon = event.get("longitude")
            if lat is None or lon is None:
                continue

            try:
                lat = float(lat)
                lon = float(lon)
            except (ValueError, TypeError):
                continue

            fatalities = int(event.get("fatalities", 0))
            severity = "critical" if fatalities > 10 else "high" if fatalities > 0 else "medium"

            events.append({
                "source": "acled",
                "entity_type": "conflict",
                "entity_id": str(event.get("data_id", "")),
                "label": event.get("event_type", "Unknown Event"),
                "latitude": lat,
                "longitude": lon,
                "timestamp": event.get("event_date", datetime.utcnow().isoformat()),
                "severity": severity,
                "metadata": {
                    "event_type": event.get("event_type"),
                    "sub_event_type": event.get("sub_event_type"),
                    "actor1": event.get("actor1"),
                    "actor2": event.get("actor2"),
                    "country": event.get("country"),
                    "admin1": event.get("admin1"),
                    "fatalities": fatalities,
                    "notes": event.get("notes"),
                },
            })
        return events

    @staticmethod
    def _get_sample_data() -> list[dict[str, Any]]:
        """Return sample conflict data for development."""
        return [
            {
                "data_id": "sample_1",
                "event_type": "Battles",
                "sub_event_type": "Armed clash",
                "event_date": "2024-01-15",
                "latitude": "15.5",
                "longitude": "32.5",
                "country": "Sudan",
                "admin1": "Khartoum",
                "actor1": "Military Forces",
                "actor2": "Rebel Group",
                "fatalities": "5",
                "notes": "Sample conflict event for development",
            },
            {
                "data_id": "sample_2",
                "event_type": "Violence against civilians",
                "sub_event_type": "Attack",
                "event_date": "2024-01-14",
                "latitude": "6.5",
                "longitude": "3.4",
                "country": "Nigeria",
                "admin1": "Lagos",
                "actor1": "Unknown Armed Group",
                "actor2": "Civilians",
                "fatalities": "2",
                "notes": "Sample violence event for development",
            },
        ]
