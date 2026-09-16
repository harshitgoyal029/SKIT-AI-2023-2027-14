"""
CardioXAI — FastAPI Backend Server

Sprint 1(A): Basic server setup and project structure.
Sprint 1(B): JWT authentication and security.
Sprint 1(C): Clinical and ECG data upload APIs.
Sprint 2(A): Database connection verification, health checks, and seed data.
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from auth import router as auth_router
from config import settings
from database import get_collection_stats, init_indexes, ping_db, verify_connection
from upload import router as upload_router

UPLOADS_DIR = Path(__file__).resolve().parent / "uploads"


# ── Lifespan (startup / shutdown) ────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs on server startup and shutdown."""
    # — Startup —
    print(f"→ Starting {settings.APP_NAME} v{settings.APP_VERSION}...")
    verify_connection()
    print("  ✓ MongoDB connection verified")
    init_indexes()
    print("  ✓ Database indexes ready")
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    print("  ✓ Uploads directory ready")
    print(f"  ✓ Database: {settings.MONGODB_DB_NAME}")
    print(f"✓ {settings.APP_NAME} is running — docs at /docs\n")
    yield
    # — Shutdown —
    print("✗ Server shutting down")


# ── App ──────────────────────────────────────────────────────────


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(upload_router)


# ── System Endpoints ─────────────────────────────────────────────


@app.get("/", tags=["System"])
def root():
    """Root endpoint — API info."""
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }


@app.get("/health", tags=["System"])
def health_check():
    """Basic health check — confirms the server is up."""
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


@app.get("/health/db", tags=["System"])
def db_health_check():
    """Database health check — pings MongoDB and returns connection status."""
    result = ping_db()
    if not result["connected"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=result,
        )
    return result


@app.get("/health/stats", tags=["System"])
def db_stats():
    """Return document counts for all collections."""
    try:
        return {
            "status": "ok",
            "collections": get_collection_stats(),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "error", "error": str(exc)},
        )
