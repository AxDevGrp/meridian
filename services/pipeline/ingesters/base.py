"""
Base ingester class for all data sources.
"""

import logging
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any


class BaseIngester(ABC):
    """Abstract base class for data source ingesters."""

    def __init__(self, name: str, interval_seconds: int = 60):
        self.name = name
        self.interval_seconds = interval_seconds
        self.logger = logging.getLogger(f"ingester.{name}")
        self.last_fetch: datetime | None = None
        self.fetch_count: int = 0
        self.error_count: int = 0

    @abstractmethod
    async def fetch(self) -> list[dict[str, Any]]:
        """Fetch raw data from the external source."""
        ...

    @abstractmethod
    async def normalize(self, raw_data: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Normalize raw data into the unified GeoEvent schema."""
        ...

    async def ingest(self) -> list[dict[str, Any]]:
        """Full ingestion cycle: fetch, normalize, and return."""
        try:
            self.logger.info(f"Starting ingestion for {self.name}")
            raw_data = await self.fetch()
            normalized = await self.normalize(raw_data)
            self.last_fetch = datetime.utcnow()
            self.fetch_count += 1
            self.logger.info(
                f"Ingested {len(normalized)} events from {self.name}"
            )
            return normalized
        except Exception as e:
            self.error_count += 1
            self.logger.error(f"Ingestion failed for {self.name}: {e}")
            raise

    def get_stats(self) -> dict[str, Any]:
        """Get ingester statistics."""
        return {
            "name": self.name,
            "interval_seconds": self.interval_seconds,
            "last_fetch": self.last_fetch.isoformat() if self.last_fetch else None,
            "fetch_count": self.fetch_count,
            "error_count": self.error_count,
        }
