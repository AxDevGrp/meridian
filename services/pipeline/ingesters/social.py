"""
Social media and news ingester for X, Truth Social, and WhiteHouse RSS.
"""

import httpx
import feedparser
import logging
from typing import Any
from datetime import datetime, timezone
from html import unescape
import re

from .base import BaseIngester
from config import settings


X_API_BASE = "https://api.twitter.com/2"
X_USER_ID = "25073877"  # @realDonaldTrump

TRUTH_SOCIAL_API_BASE = "https://truthsocial.com/api/v1"
TRUTH_SOCIAL_ACCT = "realDonaldTrump"


def _strip_html(text: str) -> str:
    """Remove HTML tags and unescape entities."""
    clean = re.sub(r"<[^>]+>", "", text)
    return unescape(clean).strip()


class SocialIngester(BaseIngester):
    """Ingests social media posts from X, Truth Social, and WhiteHouse RSS."""

    def __init__(self, interval_seconds: int = 120):
        super().__init__("social", interval_seconds)

        # Optional NLP geo-enrichment processor
        self._processor = None
        try:
            from processors.geo_enrichment import GeoEnrichmentProcessor

            self._processor = GeoEnrichmentProcessor()
            self.logger.info("GeoEnrichmentProcessor loaded")
        except Exception as exc:
            self.logger.warning(
                "GeoEnrichmentProcessor unavailable — posts will not be enriched: %s",
                exc,
            )

    async def ingest(self) -> list[dict[str, Any]]:
        """Full ingestion cycle: fetch → normalize → enrich → return."""
        try:
            self.logger.info(f"Starting ingestion for {self.name}")
            raw_data = await self.fetch()
            normalized = await self.normalize(raw_data)

            # Post-process with NLP enrichment (optional)
            if self._processor is not None:
                try:
                    normalized = await self._processor.process(normalized)
                    self.logger.info(
                        f"Enriched {len(normalized)} posts via GeoEnrichmentProcessor"
                    )
                except Exception as exc:
                    self.logger.error(
                        "GeoEnrichmentProcessor failed — returning un-enriched posts: %s",
                        exc,
                    )

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

    async def fetch(self) -> list[dict[str, Any]]:
        """Fetch posts from all social sources independently."""
        all_posts: list[dict[str, Any]] = []
        source_errors: list[str] = []

        # Fetch from each source independently — one failure doesn't block others
        for fetch_fn, name in [
            (self._fetch_whitehouse, "whitehouse"),
            (self._fetch_x, "x"),
            (self._fetch_truth_social, "truth_social"),
        ]:
            try:
                posts = await fetch_fn()
                all_posts.extend(posts)
                if posts:
                    self.logger.info(f"Fetched {len(posts)} posts from {name}")
            except Exception as e:
                source_errors.append(name)
                self.logger.error(f"Failed to fetch from {name}: {e}")

        # If all sources failed and no API keys configured, use sample data
        if not all_posts and len(source_errors) == 3:
            self.logger.warning("All social sources failed, using sample data")
            return self._get_sample_data()

        return all_posts

    async def _fetch_whitehouse(self) -> list[dict[str, Any]]:
        """Fetch posts from WhiteHouse RSS feed."""
        feed_url = settings.WHITEHOUSE_RSS_URL
        if not feed_url:
            self.logger.warning("WHITEHOUSE_RSS_URL not configured")
            return []

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(feed_url)
            response.raise_for_status()

        feed = feedparser.parse(response.text)
        posts: list[dict[str, Any]] = []

        for entry in feed.entries[:20]:
            content = ""
            if hasattr(entry, "summary"):
                content = _strip_html(entry.summary)
            elif hasattr(entry, "content") and entry.content:
                content = _strip_html(entry.content[0].get("value", ""))

            published = entry.get("published", "")
            try:
                published_dt = datetime(
                    *entry.published_parsed[:6], tzinfo=timezone.utc
                ) if hasattr(entry, "published_parsed") and entry.published_parsed else datetime.now(timezone.utc)
            except Exception:
                published_dt = datetime.now(timezone.utc)

            posts.append({
                "platform": "whitehouse",
                "post_id": entry.get("id", entry.get("link", "")),
                "author": "The White House",
                "content": entry.get("title", "") + ("\n\n" + content if content else ""),
                "url": entry.get("link", ""),
                "posted_at": published_dt.isoformat(),
                "engagement_likes": 0,
                "engagement_reposts": 0,
                "engagement_replies": 0,
                "media_urls": [],
                "has_video": False,
                "metadata": {
                    "title": entry.get("title", ""),
                    "categories": [tag.term for tag in getattr(entry, "tags", [])],
                },
            })

        return posts

    async def _fetch_x(self) -> list[dict[str, Any]]:
        """Fetch recent tweets from X API v2."""
        if not settings.X_BEARER_TOKEN:
            self.logger.warning("X_BEARER_TOKEN not configured, skipping X fetch")
            return []

        headers = {"Authorization": f"Bearer {settings.X_BEARER_TOKEN}"}
        params = {
            "max_results": 20,
            "tweet.fields": "created_at,public_metrics,entities,attachments",
            "expansions": "attachments.media_keys",
            "media.fields": "type,url,preview_image_url",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{X_API_BASE}/users/{X_USER_ID}/tweets",
                headers=headers,
                params=params,
            )
            response.raise_for_status()
            data = response.json()

        # Build media lookup from includes
        media_lookup: dict[str, dict] = {}
        for media in data.get("includes", {}).get("media", []):
            media_lookup[media["media_key"]] = media

        posts: list[dict[str, Any]] = []
        for tweet in data.get("data", []):
            metrics = tweet.get("public_metrics", {})

            # Resolve media URLs
            media_urls: list[str] = []
            has_video = False
            attachment_keys = tweet.get("attachments", {}).get("media_keys", [])
            for key in attachment_keys:
                media = media_lookup.get(key, {})
                url = media.get("url") or media.get("preview_image_url", "")
                if url:
                    media_urls.append(url)
                if media.get("type") == "video":
                    has_video = True

            posts.append({
                "platform": "x",
                "post_id": tweet["id"],
                "author": "realDonaldTrump",
                "content": tweet.get("text", ""),
                "url": f"https://x.com/realDonaldTrump/status/{tweet['id']}",
                "posted_at": tweet.get("created_at", datetime.now(timezone.utc).isoformat()),
                "engagement_likes": metrics.get("like_count", 0),
                "engagement_reposts": metrics.get("retweet_count", 0),
                "engagement_replies": metrics.get("reply_count", 0),
                "media_urls": media_urls,
                "has_video": has_video,
                "metadata": {
                    "entities": tweet.get("entities", {}),
                    "impression_count": metrics.get("impression_count", 0),
                    "quote_count": metrics.get("quote_count", 0),
                },
            })

        return posts

    async def _fetch_truth_social(self) -> list[dict[str, Any]]:
        """Fetch posts from Truth Social via Mastodon-compatible API or RSS bridge."""
        # Attempt 1: Mastodon-compatible API
        if settings.TRUTH_SOCIAL_METHOD in ("mastodon_api", ""):
            try:
                return await self._fetch_truth_social_mastodon()
            except Exception as e:
                self.logger.warning(f"Truth Social Mastodon API failed: {e}")

        # Attempt 2: RSS bridge fallback
        if settings.TRUTH_SOCIAL_RSS_URL:
            try:
                return await self._fetch_truth_social_rss()
            except Exception as e:
                self.logger.warning(f"Truth Social RSS bridge failed: {e}")

        self.logger.warning("All Truth Social fetch methods exhausted")
        return []

    async def _fetch_truth_social_mastodon(self) -> list[dict[str, Any]]:
        """Fetch via Truth Social's Mastodon-compatible API."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Look up account ID
            lookup_resp = await client.get(
                f"{TRUTH_SOCIAL_API_BASE}/accounts/lookup",
                params={"acct": TRUTH_SOCIAL_ACCT},
            )
            lookup_resp.raise_for_status()
            account = lookup_resp.json()
            account_id = account["id"]

            # Fetch statuses
            statuses_resp = await client.get(
                f"{TRUTH_SOCIAL_API_BASE}/accounts/{account_id}/statuses",
                params={"limit": 20},
            )
            statuses_resp.raise_for_status()
            statuses = statuses_resp.json()

        posts: list[dict[str, Any]] = []
        for status in statuses:
            content = _strip_html(status.get("content", ""))

            media_urls: list[str] = []
            has_video = False
            for attachment in status.get("media_attachments", []):
                url = attachment.get("url") or attachment.get("preview_url", "")
                if url:
                    media_urls.append(url)
                if attachment.get("type") == "video":
                    has_video = True

            posts.append({
                "platform": "truth_social",
                "post_id": str(status["id"]),
                "author": TRUTH_SOCIAL_ACCT,
                "content": content,
                "url": status.get("url", ""),
                "posted_at": status.get("created_at", datetime.now(timezone.utc).isoformat()),
                "engagement_likes": status.get("favourites_count", 0),
                "engagement_reposts": status.get("reblogs_count", 0),
                "engagement_replies": status.get("replies_count", 0),
                "media_urls": media_urls,
                "has_video": has_video,
                "metadata": {
                    "visibility": status.get("visibility", ""),
                    "language": status.get("language", ""),
                    "tags": [tag.get("name", "") for tag in status.get("tags", [])],
                },
            })

        return posts

    async def _fetch_truth_social_rss(self) -> list[dict[str, Any]]:
        """Fetch Truth Social posts via RSS bridge."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(settings.TRUTH_SOCIAL_RSS_URL)
            response.raise_for_status()

        feed = feedparser.parse(response.text)
        posts: list[dict[str, Any]] = []

        for entry in feed.entries[:20]:
            content = _strip_html(entry.get("summary", ""))

            try:
                published_dt = datetime(
                    *entry.published_parsed[:6], tzinfo=timezone.utc
                ) if hasattr(entry, "published_parsed") and entry.published_parsed else datetime.now(timezone.utc)
            except Exception:
                published_dt = datetime.now(timezone.utc)

            posts.append({
                "platform": "truth_social",
                "post_id": entry.get("id", entry.get("link", "")),
                "author": TRUTH_SOCIAL_ACCT,
                "content": content,
                "url": entry.get("link", ""),
                "posted_at": published_dt.isoformat(),
                "engagement_likes": 0,
                "engagement_reposts": 0,
                "engagement_replies": 0,
                "media_urls": [],
                "has_video": False,
                "metadata": {"source": "rss_bridge"},
            })

        return posts

    async def normalize(self, raw_data: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Normalize raw social posts into the unified format."""
        events: list[dict[str, Any]] = []

        for post in raw_data:
            events.append({
                "source": "social",
                "entity_type": "social_post",
                "entity_id": str(post.get("post_id", "")),
                "platform": post.get("platform", ""),
                "author": post.get("author", ""),
                "content": post.get("content", ""),
                "url": post.get("url", ""),
                "timestamp": post.get("posted_at", datetime.now(timezone.utc).isoformat()),
                "engagement": {
                    "likes": int(post.get("engagement_likes", 0)),
                    "reposts": int(post.get("engagement_reposts", 0)),
                    "replies": int(post.get("engagement_replies", 0)),
                },
                "media_urls": post.get("media_urls", []),
                "has_video": bool(post.get("has_video", False)),
                "metadata": post.get("metadata", {}),
            })

        return events

    @staticmethod
    def _get_sample_data() -> list[dict[str, Any]]:
        """Return sample social posts for development."""
        return [
            {
                "platform": "whitehouse",
                "post_id": "wh_sample_1",
                "author": "The White House",
                "content": "Executive Order on Strengthening Trade Policy and Protecting American Industry\n\nToday, the President signed an executive order to establish new reciprocal tariff frameworks to protect American workers and manufacturers.",
                "url": "https://www.whitehouse.gov/presidential-actions/executive-order-trade-policy/",
                "posted_at": "2026-03-11T14:00:00+00:00",
                "engagement_likes": 0,
                "engagement_reposts": 0,
                "engagement_replies": 0,
                "media_urls": [],
                "has_video": False,
                "metadata": {
                    "title": "Executive Order on Strengthening Trade Policy and Protecting American Industry",
                    "categories": ["Presidential Actions", "Economy"],
                },
            },
            {
                "platform": "x",
                "post_id": "x_sample_1",
                "author": "realDonaldTrump",
                "content": "Just signed a MAJOR Executive Order on Tariffs. Other countries have been taking advantage of the United States for decades. Those days are OVER. America First! 🇺🇸",
                "url": "https://x.com/realDonaldTrump/status/sample_1",
                "posted_at": "2026-03-11T15:30:00+00:00",
                "engagement_likes": 245000,
                "engagement_reposts": 58000,
                "engagement_replies": 32000,
                "media_urls": [],
                "has_video": False,
                "metadata": {
                    "entities": {},
                    "impression_count": 12500000,
                    "quote_count": 15000,
                },
            },
            {
                "platform": "truth_social",
                "post_id": "ts_sample_1",
                "author": "realDonaldTrump",
                "content": "Had a very productive call with President Xi of China. We talked about FAIR TRADE and stopping the massive trade deficit. China knows we mean business. Great things ahead!",
                "url": "https://truthsocial.com/@realDonaldTrump/posts/sample_1",
                "posted_at": "2026-03-11T16:00:00+00:00",
                "engagement_likes": 89000,
                "engagement_reposts": 21000,
                "engagement_replies": 8500,
                "media_urls": [],
                "has_video": False,
                "metadata": {
                    "visibility": "public",
                    "language": "en",
                    "tags": [],
                },
            },
            {
                "platform": "whitehouse",
                "post_id": "wh_sample_2",
                "author": "The White House",
                "content": "Press Briefing by Press Secretary on International Trade Agreements\n\nThe administration is committed to ensuring fair and reciprocal trade with all nations. Today's briefing covered new bilateral agreements under negotiation with key partners in Europe and Asia.",
                "url": "https://www.whitehouse.gov/briefings-statements/press-briefing-trade-agreements/",
                "posted_at": "2026-03-11T18:00:00+00:00",
                "engagement_likes": 0,
                "engagement_reposts": 0,
                "engagement_replies": 0,
                "media_urls": [],
                "has_video": True,
                "metadata": {
                    "title": "Press Briefing by Press Secretary on International Trade Agreements",
                    "categories": ["Briefings & Statements"],
                },
            },
            {
                "platform": "x",
                "post_id": "x_sample_2",
                "author": "realDonaldTrump",
                "content": "The European Union must treat the United States fairly on trade. We are their biggest customer and they charge us MASSIVE tariffs while we charge them almost NOTHING. That changes NOW!",
                "url": "https://x.com/realDonaldTrump/status/sample_2",
                "posted_at": "2026-03-11T17:15:00+00:00",
                "engagement_likes": 198000,
                "engagement_reposts": 42000,
                "engagement_replies": 27000,
                "media_urls": [],
                "has_video": False,
                "metadata": {
                    "entities": {},
                    "impression_count": 9800000,
                    "quote_count": 11000,
                },
            },
        ]
