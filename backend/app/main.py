"""
VectorSurfer 0.0.1 Backend - FastAPI Application

This backend serves the VectorWave monitoring dashboard.
All endpoints return JSON-serializable data from the Dashboard Service Layer.

[수정사항]
- [BYOD] PostgreSQL 초기화, initialize_database 제거 (per-user)
- Per-user OpenAI API key (global key removed)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.api.v1.api import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan events for startup and shutdown.
    """
    print("🚀 Starting VectorSurfer 0.0.1 Backend...")
    print("ℹ️  OpenAI API key is now per-user (Settings page)")

    # [BYOD] Initialize PostgreSQL tables
    from app.core.database import init_db
    try:
        await init_db()
        print("✅ PostgreSQL tables initialized")
    except Exception as e:
        print(f"⚠️ PostgreSQL initialization error: {e}")
        print("   └─ Make sure PostgreSQL is running (docker compose -f vw_docker.yml up -d)")

    yield

    # Shutdown: Cleanup
    print("👋 Shutting down VectorSurfer 0.0.1 Backend...")
    from app.core.database import engine
    await engine.dispose()


app = FastAPI(
    title="VectorSurfer 0.0.1",
    description="VectorWave Monitoring Dashboard API",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "name": "VectorSurfer 0.0.1",
        "status": "running",
        "version": "2.0.0"
    }


@app.get("/health")
async def health():
    """Detailed health check."""
    healer_available = True  # per-user key check at request time

    return {
        "status": "healthy",
        "healer_available": healer_available,
        "version": "2.0.0"
    }
