"""
AIS vessel tracking ingester.
Uses sample data as AIS data requires paid subscriptions.
"""

import random
from typing import Any
from datetime import datetime

from .base import BaseIngester


# Major shipping lanes with sample vessel positions
SAMPLE_VESSELS = [
    {"mmsi": "211234567", "name": "ATLANTIC SPIRIT", "type": "cargo", "lat": 51.35, "lon": 1.86, "heading": 225, "speed": 12.5},
    {"mmsi": "244123456", "name": "NORTH SEA TRADER", "type": "tanker", "lat": 52.10, "lon": 3.45, "heading": 180, "speed": 10.2},
    {"mmsi": "636012345", "name": "PACIFIC VOYAGER", "type": "container", "lat": 34.05, "lon": -118.25, "heading": 270, "speed": 18.0},
    {"mmsi": "538001234", "name": "STRAIT RUNNER", "type": "cargo", "lat": 1.27, "lon": 103.85, "heading": 45, "speed": 8.5},
    {"mmsi": "371234567", "name": "PANAMA EXPRESS", "type": "container", "lat": 9.00, "lon": -79.50, "heading": 350, "speed": 14.0},
    {"mmsi": "412345678", "name": "SHANGHAI STAR", "type": "container", "lat": 31.23, "lon": 121.47, "heading": 120, "speed": 16.0},
    {"mmsi": "259123456", "name": "NORDIC FJORD", "type": "tanker", "lat": 60.39, "lon": 5.32, "heading": 200, "speed": 11.0},
    {"mmsi": "338123456", "name": "GULF STREAM", "type": "tanker", "lat": 29.76, "lon": -95.36, "heading": 155, "speed": 9.0},
    {"mmsi": "477123456", "name": "HONG KONG PEARL", "type": "cargo", "lat": 22.28, "lon": 114.17, "heading": 90, "speed": 7.5},
    {"mmsi": "563123456", "name": "SUEZ NAVIGATOR", "type": "container", "lat": 30.00, "lon": 32.57, "heading": 165, "speed": 13.0},
]


class AISIngester(BaseIngester):
    """Ingests vessel position data (currently using sample data)."""

    def __init__(self, interval_seconds: int = 60):
        super().__init__("ais", interval_seconds)

    async def fetch(self) -> list[dict[str, Any]]:
        """Return sample vessel data with slight position variations."""
        vessels = []
        for v in SAMPLE_VESSELS:
            vessel = v.copy()
            # Add slight drift to simulate movement
            vessel["lat"] += random.uniform(-0.01, 0.01)
            vessel["lon"] += random.uniform(-0.01, 0.01)
            vessel["speed"] += random.uniform(-1.0, 1.0)
            vessels.append(vessel)
        return vessels

    async def normalize(self, raw_data: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Normalize vessel data into GeoEvent format."""
        events = []
        for vessel in raw_data:
            events.append({
                "source": "ais",
                "entity_type": "vessel",
                "entity_id": vessel["mmsi"],
                "label": vessel["name"],
                "latitude": vessel["lat"],
                "longitude": vessel["lon"],
                "heading": vessel["heading"],
                "velocity_knots": vessel["speed"],
                "timestamp": datetime.utcnow().isoformat(),
                "metadata": {
                    "mmsi": vessel["mmsi"],
                    "vessel_type": vessel["type"],
                },
            })
        return events
