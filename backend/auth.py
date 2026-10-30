"""
Authentication router — register, login, and auth dependencies.
"""

from datetime import datetime
from typing import Literal, Optional

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
Role = Literal["admin", "doctor", "clinician", "patient", "lab_technician"]


# ── Schemas ──────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=150)
    name: Optional[str] = Field(default=None, max_length=150)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    role: Role = "patient"

    def get_display_name(self) -> str:
        val = self.full_name or self.name or ""
        val = val.strip()
        if len(val) < 2:
            raise ValueError("Full name must be at least 2 characters.")
        return val


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)
    role: Optional[Role] = None


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


class DemoAccount(BaseModel):
    role: str
    email: str
    password: str
    name: str
    description: str


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


DEMO_USERS = [
    {
        "role": "patient",
        "email": "patient@cardioxai.org",
        "password": "Patient@123",
        "name": "Jane Doe (Patient)",
        "description": "Patient portal — check personal risk prediction, review ECG reports, track cardiac health.",
    },
    {
        "role": "doctor",
        "email": "doctor@cardioxai.org",
        "password": "Doctor@123",
        "name": "Dr. Sarah Johnson, MD",
        "description": "Doctor portal — diagnostic decision support, SHAP explainability insights, patient evaluations.",
    },
    {
        "role": "clinician",
        "email": "clinician@cardioxai.org",
        "password": "Clinician@123",
        "name": "Dr. Alex Mercer, Clinician",
        "description": "Clinician portal — register new patients, input clinical vitals, manage cohort assessments.",
    },
]


def ensure_demo_users_in_db(db: Database) -> None:
    """Pre-seeds standard demo accounts if they do not exist."""
    for demo in DEMO_USERS:
        existing = db["users"].find_one({"email": demo["email"]})
        if not existing:
            u = User(
                full_name=demo["name"],
                email=demo["email"],
                password_hash=hash_password(demo["password"]),
                role=UserRole(demo["role"]),
            )
            db["users"].insert_one(u.model_dump(by_alias=True, exclude={"id"}))


@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Database = Depends(get_db)) -> MessageResponse:
    """Create a new account with the requested role (patient, doctor, clinician)."""
    email = body.email.lower()

    if db["users"].find_one({"email": email}):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account already exists with this email.",
        )

    try:
        display_name = body.get_display_name()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    user_role = UserRole(body.role)

    user = User(
        full_name=display_name,
        email=email,
        password_hash=hash_password(body.password),
        role=user_role,
    )
    db["users"].insert_one(user.model_dump(by_alias=True, exclude={"id"}))

    return MessageResponse(
        message=f"Account created successfully for {display_name} as {user_role.value.title()}. You can now sign in."
    )


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Database = Depends(get_db)) -> LoginResponse:
    """Authenticate with email & password, and verify role matching."""
    # Ensure demo accounts exist on first login attempt
    try:
        ensure_demo_users_in_db(db)
    except Exception:
        pass

    user = db["users"].find_one({"email": body.email.lower()})

    if not user or not user.get("is_active", True) or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # Check role alignment if caller specified a portal role
    stored_role = user.get("role")
    stored_role_val = stored_role.value if hasattr(stored_role, "value") else str(stored_role)
    if "." in stored_role_val:
        stored_role_val = stored_role_val.split(".")[-1]

    if body.role and stored_role_val != body.role:
        actual_role = stored_role_val.title()
        requested_role = str(body.role).title()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This account is registered as '{actual_role}' (not {requested_role}). Please switch to the {actual_role} Portal to sign in.",
        )

    access_token, expires_at = create_access_token(str(user["_id"]), stored_role_val)

    return LoginResponse(
        access_token=access_token,
        expires_at=expires_at,
        user=UserResponse(
            id=str(user["_id"]),
            name=user["full_name"],
            email=user["email"],
            role=stored_role_val,
        ),
    )


@router.get("/demo-accounts", response_model=list[DemoAccount])
def get_demo_accounts(db: Database = Depends(get_db)) -> list[DemoAccount]:
    """Retrieve pre-seeded credentials for rapid role testing in UI."""
    try:
        ensure_demo_users_in_db(db)
    except Exception:
        pass
    return [DemoAccount(**d) for d in DEMO_USERS]


@router.get("/me", response_model=UserResponse)
def get_me(user: dict = Depends(get_current_user)) -> UserResponse:
    """Return the currently authenticated user's info."""
    return UserResponse(
        id=str(user["_id"]),
        name=user["full_name"],
        email=user["email"],
        role=user["role"],
    )
