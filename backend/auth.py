"""
Authentication router — register, login, and auth dependencies.
"""

from datetime import datetime
from typing import Literal

import jwt
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from pymongo.database import Database

from database import get_db
from models import User, UserRole
from security import create_access_token, decode_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

bearer_scheme = HTTPBearer()
Role = Literal["admin", "doctor", "patient", "lab_technician"]


# ── Schemas ──────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: Role


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: UserResponse


class MessageResponse(BaseModel):
    message: str


# ── Auth dependencies ────────────────────────────────────────────


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Database = Depends(get_db),
) -> dict:
    """Decode the Bearer token and return the user document from MongoDB."""
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = ObjectId(payload["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )

    user = db["users"].find_one({"_id": user_id})
    if not user or not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not found or inactive.",
        )
    return user


def require_role(*allowed_roles: UserRole):
    """Factory that returns a dependency enforcing one or more roles.

    Usage in a route:
        patient = Depends(require_role(UserRole.patient))
    """

    def _check(user: dict = Depends(get_current_user)) -> dict:
        user_role = user.get("role")
        if user_role not in [r.value for r in allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource.",
            )
        return user

    return _check


# ── Routes ───────────────────────────────────────────────────────


@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Database = Depends(get_db)) -> MessageResponse:
    """Create a new patient account."""
    email = body.email.lower()

    if db["users"].find_one({"email": email}):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account already exists with this email.",
        )

    user = User(
        full_name=body.full_name.strip(),
        email=email,
        password_hash=hash_password(body.password),
        role=UserRole.patient,
    )
    db["users"].insert_one(user.model_dump(by_alias=True, exclude={"id"}))

    return MessageResponse(message="Account created. You can now sign in.")


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Database = Depends(get_db)) -> LoginResponse:
    """Authenticate with email & password, receive a JWT."""
    user = db["users"].find_one({"email": body.email.lower()})

    if not user or not user.get("is_active", True) or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    access_token, expires_at = create_access_token(str(user["_id"]), user["role"])

    return LoginResponse(
        access_token=access_token,
        expires_at=expires_at,
        user=UserResponse(
            id=str(user["_id"]),
            name=user["full_name"],
            email=user["email"],
            role=user["role"],
        ),
    )


@router.get("/me", response_model=UserResponse)
def get_me(user: dict = Depends(get_current_user)) -> UserResponse:
    """Return the currently authenticated user's info."""
    return UserResponse(
        id=str(user["_id"]),
        name=user["full_name"],
        email=user["email"],
        role=user["role"],
    )
