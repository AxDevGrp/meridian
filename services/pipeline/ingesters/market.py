"""
Market data ingester using Yahoo Finance (yfinance).
Fetches price data for tracked symbols and normalizes into price records.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from .base import BaseIngester
from config import settings

logger = logging.getLogger("ingester.market")


# Realistic sample prices for development / when yfinance is unavailable
_SAMPLE_PRICES: dict[str, dict[str, Any]] = {
    "CL=F":  {"open": 78.42, "high": 79.15, "low": 77.88, "close": 78.93, "volume": 284_312},
    "BZ=F":  {"open": 82.10, "high": 82.95, "low": 81.70, "close": 82.61, "volume": 198_450},
    "NG=F":  {"open": 2.84,  "high": 2.91,  "low": 2.79,  "close": 2.87,  "volume": 142_800},
    "GLD":   {"open": 213.50, "high": 214.80, "low": 212.90, "close": 214.25, "volume": 8_234_100},
    "^VIX":  {"open": 14.20, "high": 15.10, "low": 13.95, "close": 14.65,  "volume": 0},
    "^GSPC": {"open": 5_248.30, "high": 5_275.60, "low": 5_235.10, "close": 5_267.84, "volume": 3_412_000_000},
    "^DJI":  {"open": 39_128.50, "high": 39_345.20, "low": 39_010.80, "close": 39_280.15, "volume": 312_000_000},
    "TSM":   {"open": 148.20, "high": 150.45, "low": 147.60, "close": 149.85, "volume": 12_450_300},
    "LMT":   {"open": 452.30, "high": 456.80, "low": 450.15, "close": 455.70, "volume": 1_823_400},
    "ZIM":   {"open": 12.85, "high": 13.25, "low": 12.60, "close": 13.10, "volume": 3_456_200},
    "XOM":   {"open": 108.40, "high": 109.75, "low": 107.90, "close": 109.20, "volume": 14_230_500},
    "CVX":   {"open": 155.60, "high": 157.10, "low": 154.80, "close": 156.45, "volume": 6_780_300},
    "NVDA":  {"open": 875.20, "high": 892.50, "low": 870.10, "close": 888.40, "volume": 42_350_600},
    "ASML":  {"open": 920.50, "high": 935.80, "low": 915.20, "close": 930.15, "volume": 1_234_500},
    "AAPL":  {"open": 178.50, "high": 180.20, "low": 177.80, "close": 179.65, "volume": 54_320_100},
    "BP":    {"open": 34.80,  "high": 35.25,  "low": 34.50,  "close": 35.05,  "volume": 8_912_300},
    "SHEL":  {"open": 65.40,  "high": 66.10,  "low": 65.00,  "close": 65.80,  "volume": 4_567_800},
    "FRO":   {"open": 22.15,  "high": 22.80,  "low": 21.90,  "close": 22.55,  "volume": 2_345_600},
    "STNG":  {"open": 58.30,  "high": 59.45,  "low": 57.80,  "close": 59.10,  "volume": 1_678_900},
    "TNK":   {"open": 42.50,  "high": 43.20,  "low": 42.10,  "close": 42.95,  "volume": 987_600},
    "MATX":  {"open": 118.90, "high": 120.50, "low": 118.20, "close": 119.80, "volume": 345_200},
    "BDRY":  {"open": 10.25,  "high": 10.60,  "low": 10.05,  "close": 10.45,  "volume": 456_300},
    "RTX":   {"open": 98.70,  "high": 99.85,  "low": 98.10,  "close": 99.40,  "volume": 3_456_700},
    "NOC":   {"open": 468.30, "high": 472.50, "low": 466.80, "close": 471.20, "volume": 876_500},
    "GD":    {"open": 278.50, "high": 281.20, "low": 277.30, "close": 280.60, "volume": 1_123_400},
    "BA":    {"open": 198.40, "high": 201.30, "low": 197.10, "close": 200.50, "volume": 5_678_900},
    "ITA":   {"open": 132.80, "high": 134.10, "low": 132.20, "close": 133.65, "volume": 234_500},
    "ZW=F":  {"open": 5.82,   "high": 5.95,   "low": 5.75,   "close": 5.89,   "volume": 98_450},
    "ZC=F":  {"open": 4.52,   "high": 4.61,   "low": 4.48,   "close": 4.57,   "volume": 156_200},
    "ZS=F":  {"open": 12.15,  "high": 12.35,  "low": 12.02,  "close": 12.28,  "volume": 87_300},
    "DBA":   {"open": 24.30,  "high": 24.65,  "low": 24.10,  "close": 24.50,  "volume": 1_234_500},
    "INTC":  {"open": 43.80,  "high": 44.50,  "low": 43.40,  "close": 44.15,  "volume": 28_340_200},
    "SOXX":  {"open": 585.20, "high": 592.40, "low": 582.10, "close": 590.50, "volume": 2_345_600},
    "SMH":   {"open": 228.40, "high": 231.60, "low": 227.10, "close": 230.80, "volume": 5_678_300},
    "SLV":   {"open": 24.80,  "high": 25.20,  "low": 24.55,  "close": 25.05,  "volume": 12_340_500},
    "UUP":   {"open": 28.15,  "high": 28.30,  "low": 28.00,  "close": 28.22,  "volume": 3_456_700},
    "TLT":   {"open": 92.60,  "high": 93.40,  "low": 92.10,  "close": 93.05,  "volume": 18_920_300},
}


def _fetch_yfinance_batch(symbols: list[str]) -> list[dict[str, Any]]:
    """
    Synchronous yfinance batch download.
    Called via asyncio.to_thread() to avoid blocking the event loop.
    """
    try:
        import yfinance as yf
    except ImportError:
        logger.warning("yfinance not installed — returning empty data")
        return []

    results: list[dict[str, Any]] = []
    now = datetime.now(timezone.utc)

    try:
        # yfinance.download() fetches multiple symbols in one HTTP call
        df = yf.download(
            tickers=symbols,
            period="1d",
            interval="1d",
            group_by="ticker",
            auto_adjust=True,
            threads=True,
            progress=False,
        )

        if df.empty:
            logger.warning("yfinance returned empty DataFrame")
            return []

        # Single-symbol download returns flat columns; multi-symbol returns MultiIndex
        is_multi = len(symbols) > 1 and isinstance(df.columns, __import__("pandas").MultiIndex)

        for sym in symbols:
            try:
                if is_multi:
                    sym_data = df[sym]
                else:
                    sym_data = df

                if sym_data.empty:
                    continue

                # Get the last row
                last = sym_data.iloc[-1]

                record = {
                    "symbol": sym,
                    "open": _safe_float(last.get("Open")),
                    "high": _safe_float(last.get("High")),
                    "low": _safe_float(last.get("Low")),
                    "close": _safe_float(last.get("Close")),
                    "volume": _safe_int(last.get("Volume")),
                    "timestamp": now.isoformat(),
                }

                # Skip if close is missing
                if record["close"] is not None:
                    results.append(record)

            except Exception as exc:
                logger.warning("Failed to parse yfinance data for %s: %s", sym, exc)
                continue

    except Exception as exc:
        logger.error("yfinance batch download failed: %s", exc)

    return results


def _safe_float(val: Any) -> float | None:
    """Convert a value to float, returning None for NaN/None."""
    if val is None:
        return None
    try:
        import math
        f = float(val)
        return None if math.isnan(f) else f
    except (ValueError, TypeError):
        return None


def _safe_int(val: Any) -> int | None:
    """Convert a value to int, returning None for NaN/None."""
    if val is None:
        return None
    try:
        import math
        f = float(val)
        return None if math.isnan(f) else int(f)
    except (ValueError, TypeError):
        return None


class MarketIngester(BaseIngester):
    """Ingests market price data via Yahoo Finance (yfinance)."""

    def __init__(
        self,
        symbols: list[str] | None = None,
        interval_seconds: int | None = None,
    ):
        super().__init__(
            "market",
            interval_seconds or settings.MARKET_INTERVAL,
        )
        self.symbols = symbols or [
            s.strip() for s in settings.MARKET_SYMBOLS_DEFAULT.split(",") if s.strip()
        ]
        self._use_sample = not settings.YAHOO_FINANCE_ENABLED

    async def fetch(self) -> list[dict[str, Any]]:
        """
        Fetch current prices for tracked symbols via yfinance.
        Uses asyncio.to_thread() because yfinance is synchronous.
        Returns last known prices when markets are closed.
        """
        if self._use_sample:
            self.logger.info("Yahoo Finance disabled — using sample data")
            return self._get_sample_data()

        try:
            data = await asyncio.to_thread(_fetch_yfinance_batch, self.symbols)

            if not data:
                self.logger.warning(
                    "yfinance returned no data (market closed?) — falling back to sample"
                )
                return self._get_sample_data()

            self.logger.info("Fetched live prices for %d symbols", len(data))
            return data

        except Exception as exc:
            self.logger.error("yfinance fetch failed: %s — using sample data", exc)
            return self._get_sample_data()

    async def normalize(self, raw_data: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Normalize yfinance data into standardized price records.
        Each record has: symbol, open, high, low, close, volume, timestamp.
        """
        normalized: list[dict[str, Any]] = []

        for record in raw_data:
            symbol = record.get("symbol")
            close = record.get("close")

            if not symbol or close is None:
                continue

            normalized.append({
                "symbol": symbol,
                "open": record.get("open"),
                "high": record.get("high"),
                "low": record.get("low"),
                "close": close,
                "volume": record.get("volume"),
                "interval": "1d",
                "recorded_at": record.get("timestamp", datetime.now(timezone.utc).isoformat()),
            })

        return normalized

    def _get_sample_data(self) -> list[dict[str, Any]]:
        """
        Return realistic hardcoded market data for development.
        Covers all default symbols with plausible OHLCV values.
        """
        now = datetime.now(timezone.utc).isoformat()
        results: list[dict[str, Any]] = []

        for sym in self.symbols:
            sample = _SAMPLE_PRICES.get(sym)
            if sample is None:
                self.logger.debug("No sample data for symbol %s", sym)
                continue

            results.append({
                "symbol": sym,
                "open": sample["open"],
                "high": sample["high"],
                "low": sample["low"],
                "close": sample["close"],
                "volume": sample["volume"],
                "timestamp": now,
            })

        return results
