"""
Centralized application settings.

All environment variables are loaded here via pydantic-settings.
Import `settings` anywhere you need configuration values.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """CardioXAI backend configuration — values come from .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    # ── Application ──────────────────────────────────────────────
    APP_NAME: str = "CardioXAI API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # ── MongoDB ──────────────────────────────────────────────────
    MONGODB_URI: str
    MONGODB_DB_NAME: str = "cardioxai"

    # ── JWT (will be used in later sprints) ──────────────────────
    JWT_SECRET: str = "change-me-before-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_MINUTES: int = 60

    # ── CORS ─────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]


settings = Settings()
