"""
NLP Geo-Enrichment Processor for social media posts.

Post-processing pipeline that enriches normalized social posts with:
- Named Entity Recognition (spaCy)
- Sentiment Analysis (VADER)
- Geocoding (Nominatim)
- Video/Media Detection
"""

import asyncio
import logging
import re
import time
from typing import Any


# Video URL patterns for media detection
VIDEO_URL_PATTERNS = [
    re.compile(r"youtube\.com/watch", re.IGNORECASE),
    re.compile(r"youtu\.be/", re.IGNORECASE),
    re.compile(r"twitter\.com/.+/video", re.IGNORECASE),
    re.compile(r"x\.com/.+/video", re.IGNORECASE),
    re.compile(r"\.mp4(\?|$)", re.IGNORECASE),
    re.compile(r"\.m3u8(\?|$)", re.IGNORECASE),
    re.compile(r"\.webm(\?|$)", re.IGNORECASE),
]

# Entity types to extract via spaCy NER
GEO_ENTITY_TYPES = {"GPE", "LOC"}
ALL_ENTITY_TYPES = {"GPE", "LOC", "ORG", "PERSON"}


class GeoEnrichmentProcessor:
    """
    Post-processing pipeline that enriches social media posts with:
    - Named Entity Recognition (spaCy)
    - Sentiment Analysis (VADER)
    - Geocoding (Nominatim)
    - Video/Media Detection
    """

    def __init__(self) -> None:
        self._nlp = None  # Lazy-loaded spaCy model
        self._nlp_loaded = False  # Track whether we've attempted loading
        self._sentiment_analyzer = None  # Lazy-loaded VADER
        self._sentiment_loaded = False
        self._geocoder = None  # Lazy-loaded Nominatim
        self._geocoder_loaded = False
        self._geocode_cache: dict[str, tuple[float, float] | None] = {}
        self._last_geocode_time: float = 0
        self.logger = logging.getLogger("processor.geo_enrichment")

    # ------------------------------------------------------------------
    # Lazy-loaded dependencies
    # ------------------------------------------------------------------

    @property
    def nlp(self):
        """Lazy-load spaCy model. Returns None if unavailable."""
        if not self._nlp_loaded:
            self._nlp_loaded = True
            try:
                import spacy

                self._nlp = spacy.load("en_core_web_sm")
                self.logger.info("spaCy model en_core_web_sm loaded")
            except ImportError:
                self.logger.warning(
                    "spaCy not installed — NER disabled. "
                    "Install with: pip install spacy"
                )
            except OSError:
                self.logger.warning(
                    "spaCy model not found — NER disabled. "
                    "Run: python -m spacy download en_core_web_sm"
                )
        return self._nlp

    @property
    def sentiment_analyzer(self):
        """Lazy-load VADER sentiment analyzer. Returns None if unavailable."""
        if not self._sentiment_loaded:
            self._sentiment_loaded = True
            try:
                from vaderSentiment.vaderSentiment import (
                    SentimentIntensityAnalyzer,
                )

                self._sentiment_analyzer = SentimentIntensityAnalyzer()
                self.logger.info("VADER sentiment analyzer loaded")
            except ImportError:
                self.logger.warning(
                    "vaderSentiment not installed — sentiment analysis disabled. "
                    "Install with: pip install vaderSentiment"
                )
        return self._sentiment_analyzer

    @property
    def geocoder(self):
        """Lazy-load Nominatim geocoder. Returns None if unavailable."""
        if not self._geocoder_loaded:
            self._geocoder_loaded = True
            try:
                from geopy.geocoders import Nominatim

                self._geocoder = Nominatim(
                    user_agent="meridian-pipeline/1.0",
                    timeout=10,
                )
                self.logger.info("Nominatim geocoder loaded")
            except ImportError:
                self.logger.warning(
                    "geopy not installed — geocoding disabled. "
                    "Install with: pip install geopy"
                )
        return self._geocoder

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def process(self, posts: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Process a batch of normalized social posts.

        Returns the same list with enrichment fields added to each post.
        Never raises — individual post failures are logged and skipped.
        """
        enriched: list[dict[str, Any]] = []
        for post in posts:
            try:
                enriched.append(await self._enrich_post(post))
            except Exception as exc:
                self.logger.error(
                    "Failed to enrich post %s: %s",
                    post.get("entity_id", "unknown"),
                    exc,
                )
                # Return the post un-enriched rather than dropping it
                enriched.append(post)
        return enriched

    # ------------------------------------------------------------------
    # Core enrichment pipeline
    # ------------------------------------------------------------------

    async def _enrich_post(self, post: dict[str, Any]) -> dict[str, Any]:
        """Enrich a single post with NER, sentiment, geocoding, and media detection."""
        content = post.get("content", "")

        # 1. Named Entity Recognition
        entities = self._extract_entities(content)
        post["entities_mentioned"] = entities.get("all", [])
        post["geo_references"] = entities.get("geo", [])

        # 2. Sentiment Analysis
        sentiment = self._analyze_sentiment(content)
        post["sentiment"] = sentiment["label"]
        post["sentiment_score"] = sentiment["score"]

        # 3. Geocoding (only when we have geo references)
        if post["geo_references"]:
            location = await self._geocode_references(post["geo_references"])
            if location:
                post["latitude"] = location[0]
                post["longitude"] = location[1]

        # 4. Media / Video detection
        media = self._detect_media(post)
        post["has_video"] = media["has_video"]
        post["media_urls"] = media["urls"]

        return post

    # ------------------------------------------------------------------
    # NER
    # ------------------------------------------------------------------

    def _extract_entities(self, text: str) -> dict[str, list[str]]:
        """Extract named entities using spaCy NER.

        Returns::
            {
                "all": ["United States", "China", "Trump", ...],
                "geo": ["United States", "China"],
            }
        """
        result: dict[str, list[str]] = {"all": [], "geo": []}

        if not text or self.nlp is None:
            return result

        try:
            doc = self.nlp(text)
            seen_all: set[str] = set()
            seen_geo: set[str] = set()

            for ent in doc.ents:
                if ent.label_ not in ALL_ENTITY_TYPES:
                    continue

                name = ent.text.strip()
                if not name:
                    continue

                if name not in seen_all:
                    seen_all.add(name)
                    result["all"].append(name)

                if ent.label_ in GEO_ENTITY_TYPES and name not in seen_geo:
                    seen_geo.add(name)
                    result["geo"].append(name)
        except Exception as exc:
            self.logger.error("NER extraction failed: %s", exc)

        return result

    # ------------------------------------------------------------------
    # Sentiment
    # ------------------------------------------------------------------

    def _analyze_sentiment(self, text: str) -> dict[str, Any]:
        """Analyze sentiment using VADER.

        Returns::
            {"label": "positive" | "neutral" | "negative" | "urgent" | "aggressive",
             "score": float}  # compound score -1.0 … 1.0

        Mapping:
            compound >= 0.5   → "positive"
            compound >= 0.05  → "neutral"
            compound >= -0.3  → "neutral"
            compound >= -0.6  → "negative"
            compound >= -0.75 → "urgent"
            compound < -0.75  → "aggressive"
        """
        default: dict[str, Any] = {"label": "neutral", "score": 0.0}

        if not text or self.sentiment_analyzer is None:
            return default

        try:
            scores = self.sentiment_analyzer.polarity_scores(text)
            compound: float = scores["compound"]

            if compound >= 0.5:
                label = "positive"
            elif compound >= 0.05:
                label = "neutral"
            elif compound >= -0.3:
                label = "neutral"
            elif compound >= -0.6:
                label = "negative"
            elif compound >= -0.75:
                label = "urgent"
            else:
                label = "aggressive"

            return {"label": label, "score": round(compound, 4)}
        except Exception as exc:
            self.logger.error("Sentiment analysis failed: %s", exc)
            return default

    # ------------------------------------------------------------------
    # Geocoding
    # ------------------------------------------------------------------

    async def _geocode_references(
        self, geo_refs: list[str]
    ) -> tuple[float, float] | None:
        """Geocode geographic references to (lat, lng).

        Tries each reference in order and returns the first successful result.
        Respects Nominatim's 1 req/sec rate limit via asyncio.sleep().
        Results are cached at the instance level.
        """
        if self.geocoder is None:
            return None

        for ref in geo_refs:
            # Deduplicate via cache
            if ref in self._geocode_cache:
                cached = self._geocode_cache[ref]
                if cached is not None:
                    return cached
                continue  # Previously failed — skip

            # Rate-limit: 1 request per second
            now = time.monotonic()
            elapsed = now - self._last_geocode_time
            if elapsed < 1.0:
                await asyncio.sleep(1.0 - elapsed)

            try:
                self._last_geocode_time = time.monotonic()
                location = await asyncio.get_event_loop().run_in_executor(
                    None, self.geocoder.geocode, ref
                )

                if location is not None:
                    coords = (location.latitude, location.longitude)
                    self._geocode_cache[ref] = coords
                    self.logger.debug(
                        "Geocoded '%s' → (%s, %s)", ref, coords[0], coords[1]
                    )
                    return coords
                else:
                    self._geocode_cache[ref] = None
                    self.logger.debug("Geocode returned no result for '%s'", ref)
            except Exception as exc:
                self._geocode_cache[ref] = None
                self.logger.warning("Geocoding failed for '%s': %s", ref, exc)

        return None

    # ------------------------------------------------------------------
    # Media / Video detection
    # ------------------------------------------------------------------

    def _detect_media(self, post: dict[str, Any]) -> dict[str, Any]:
        """Detect video and media URLs in post content and metadata.

        Returns::
            {"has_video": bool, "urls": list[str]}
        """
        has_video: bool = bool(post.get("has_video", False))
        media_urls: list[str] = list(post.get("media_urls", []))
        content: str = post.get("content", "")
        url: str = post.get("url", "")
        metadata: dict = post.get("metadata", {})

        # Collect all text candidates for URL scanning
        scan_targets = [content, url]

        # ------ Truth Social video attachments ------
        for attachment in metadata.get("media_attachments", []):
            att_url = attachment.get("url") or attachment.get("preview_url", "")
            if att_url and att_url not in media_urls:
                media_urls.append(att_url)
            if attachment.get("type") == "video":
                has_video = True

        # ------ Scan content + URL for video patterns ------
        for target in scan_targets:
            if not target:
                continue
            for pattern in VIDEO_URL_PATTERNS:
                if pattern.search(target):
                    has_video = True
                    break

        # ------ Extract inline URLs from content ------
        if content:
            inline_urls = re.findall(r"https?://[^\s<>\"']+", content)
            for found_url in inline_urls:
                if found_url not in media_urls:
                    media_urls.append(found_url)
                # Check video patterns on extracted URLs too
                for pattern in VIDEO_URL_PATTERNS:
                    if pattern.search(found_url):
                        has_video = True
                        break

        return {"has_video": has_video, "urls": media_urls}
