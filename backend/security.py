"""
Security utilities — password hashing and JWT token management.
"""

from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash

from config import settings

# ── Password hashing (Argon2) ────────────────────────────────────

_hasher = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Hash a plain-text password with Argon2."""
    return _hasher.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Check a plain-text password against its Argon2 hash."""
    return _hasher.verify(plain, hashed)


# ── JWT tokens ───────────────────────────────────────────────────


def create_access_token(user_id: str, role: str) -> tuple[str, datetime]:
    """Create a signed JWT. Returns (token_string, expiry_datetime)."""
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRY_MINUTES)
    token = jwt.encode(
        {"sub": user_id, "role": role, "exp": expires_at},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    return token, expires_at


def decode_access_token(token: str) -> dict:
    """Decode and verify a JWT. Raises jwt.PyJWTError on failure."""
    return jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM],
    )
