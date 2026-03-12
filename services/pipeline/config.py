"""
Configuration settings for the Meridian Data Pipeline.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://meridian:meridian_dev_password@localhost:5432/meridian"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    # Data Source API Keys
    ACLED_API_KEY: str = ""
    ACLED_EMAIL: str = ""

    # Social media API keys
    X_BEARER_TOKEN: str = ""
    TRUTH_SOCIAL_METHOD: str = "mastodon_api"  # "mastodon_api" | "rss_bridge" | "scraper"
    TRUTH_SOCIAL_RSS_URL: str = ""             # If using RSS bridge
    WHITEHOUSE_RSS_URL: str = "https://www.whitehouse.gov/feed/"

    # Ingestion intervals (seconds)
    ADSB_INTERVAL: int = 15
    AIS_INTERVAL: int = 60
    SATELLITE_INTERVAL: int = 300
    CONFLICT_INTERVAL: int = 600
    GPS_JAMMING_INTERVAL: int = 600
    SOCIAL_INTERVAL: int = 120  # 2 minutes
    MARKET_INTERVAL: int = 60   # 1 minute

    # Market data
    YAHOO_FINANCE_ENABLED: bool = True
    POLYGON_API_KEY: str = ""
    ALPHA_VANTAGE_API_KEY: str = ""
    MARKET_SYMBOLS_DEFAULT: str = "CL=F,BZ=F,GLD,^VIX,^GSPC,TSM,LMT,ZIM"  # comma-separated

    class Config:
        env_file = ".env"
        env_prefix = "MERIDIAN_"


settings = Settings()
