"""
Meridian Data Pipeline - FastAPI Service
Ingests, normalizes, and serves geospatial data from multiple OSINT sources.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router as api_router
from config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management."""
    logger.info("Starting Meridian Data Pipeline...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")

    # TODO: Initialize database connection pool
    # TODO: Initialize Redis connection
    # TODO: Start background ingestion schedulers

    yield

    # Cleanup
    logger.info("Shutting down Meridian Data Pipeline...")
    # TODO: Close database connections
    # TODO: Close Redis connections
    # TODO: Stop schedulers


app = FastAPI(
    title="Meridian Data Pipeline",
    description="Geospatial data ingestion and normalization service",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "0.2.0",
        "service": "meridian-pipeline",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.ENVIRONMENT == "development",
    )
