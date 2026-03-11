"""
ADS-B / OpenSky Network ingester for aircraft tracking.
"""

import httpx
from typing import Any
from datetime import datetime

from .base import BaseIngester


OPENSKY_API_URL = "https://opensky-network.org/api/states/all"


class ADSBIngester(BaseIngester):
    """Ingests aircraft position data from OpenSky Network."""

    def __init__(self, interval_seconds: int = 15):
        super().__init__("adsb", interval_seconds)

    async def fetch(self) -> list[dict[str, Any]]:
        """Fetch current aircraft states from OpenSky."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(OPENSKY_API_URL)
            response.raise_for_status()
            data = response.json()

        states = data.get("states", [])
        self.logger.info(f"Fetched {len(states)} aircraft from OpenSky")
        return states

    async def normalize(self, raw_data: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Normalize OpenSky state vectors into GeoEvent format."""
        events = []
        for state in raw_data:
            if len(state) < 17:
                continue

            icao24 = state[0]
            callsign = (state[1] or "").strip()
            lon = state[5]
            lat = state[6]
            altitude = state[7]  # barometric altitude in meters
            velocity = state[9]  # ground speed in m/s
            heading = state[10]
            vertical_rate = state[11]
            on_ground = state[8]

            if lat is None or lon is None:
                continue

            events.append({
                "source": "adsb",
                "entity_type": "aircraft",
                "entity_id": icao24,
                "label": callsign or icao24.upper(),
                "latitude": lat,
                "longitude": lon,
                "altitude_m": altitude,
                "velocity_ms": velocity,
                "heading": heading,
                "vertical_rate": vertical_rate,
                "on_ground": on_ground,
                "timestamp": datetime.utcnow().isoformat(),
                "metadata": {
                    "icao24": icao24,
                    "callsign": callsign,
                    "origin_country": state[2],
                },
            })

        return events
