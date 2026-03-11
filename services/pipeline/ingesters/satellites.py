"""
Satellite TLE ingester using CelesTrak data.
"""

import httpx
from typing import Any
from datetime import datetime

from .base import BaseIngester


CELESTRAK_GP_URL = "https://celestrak.org/NORAD/elements/gp.php"


class SatelliteIngester(BaseIngester):
    """Ingests satellite orbital data from CelesTrak."""

    def __init__(self, interval_seconds: int = 300):
        super().__init__("satellites", interval_seconds)
        self.groups = ["stations", "active", "starlink"]

    async def fetch(self) -> list[dict[str, Any]]:
        """Fetch satellite GP data from CelesTrak."""
        all_sats = []
        async with httpx.AsyncClient(timeout=30.0) as client:
            for group in self.groups:
                try:
                    response = await client.get(
                        CELESTRAK_GP_URL,
                        params={"GROUP": group, "FORMAT": "json"},
                    )
                    response.raise_for_status()
                    sats = response.json()
                    self.logger.info(f"Fetched {len(sats)} satellites from group '{group}'")
                    for sat in sats:
                        sat["_group"] = group
                    all_sats.extend(sats)
                except Exception as e:
                    self.logger.warning(f"Failed to fetch group '{group}': {e}")
        return all_sats

    async def normalize(self, raw_data: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Normalize CelesTrak GP data into GeoEvent format."""
        events = []
        for sat in raw_data:
            norad_id = sat.get("NORAD_CAT_ID")
            name = sat.get("OBJECT_NAME", "UNKNOWN")

            # Use mean motion and inclination for approximate position
            # Full SGP4 propagation should be done on the frontend
            events.append({
                "source": "celestrak",
                "entity_type": "satellite",
                "entity_id": str(norad_id),
                "label": name,
                "timestamp": datetime.utcnow().isoformat(),
                "metadata": {
                    "norad_id": norad_id,
                    "object_name": name,
                    "group": sat.get("_group"),
                    "epoch": sat.get("EPOCH"),
                    "mean_motion": sat.get("MEAN_MOTION"),
                    "eccentricity": sat.get("ECCENTRICITY"),
                    "inclination": sat.get("INCLINATION"),
                    "ra_of_asc_node": sat.get("RA_OF_ASC_NODE"),
                    "arg_of_pericenter": sat.get("ARG_OF_PERICENTER"),
                    "mean_anomaly": sat.get("MEAN_ANOMALY"),
                    "classification_type": sat.get("CLASSIFICATION_TYPE"),
                    "element_set_no": sat.get("ELEMENT_SET_NO"),
                    "rev_at_epoch": sat.get("REV_AT_EPOCH"),
                    "bstar": sat.get("BSTAR"),
                    "mean_motion_dot": sat.get("MEAN_MOTION_DOT"),
                },
            })
        return events
