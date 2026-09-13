"""
MongoDB document models.

Each class represents the shape of a document in a MongoDB collection.
Pydantic handles validation; MongoDB stores the raw dicts.
"""

import enum
from datetime import datetime, timezone
from typing import Annotated, Any, Literal, Optional

from bson import ObjectId
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field


# ── ObjectId helper ──────────────────────────────────────────────


def _validate_object_id(value: Any) -> str:
    """Accept a BSON ObjectId or a valid ObjectId string → always return str."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, str) and ObjectId.is_valid(value):
        return value
    raise ValueError("Invalid ObjectId")


PyObjectId = Annotated[str, BeforeValidator(_validate_object_id)]


def utcnow() -> datetime:
    """Timezone-aware UTC timestamp."""
    return datetime.now(timezone.utc)


# ── Enums ────────────────────────────────────────────────────────


class UserRole(str, enum.Enum):
    admin = "admin"
    doctor = "doctor"
    patient = "patient"
    lab_technician = "lab_technician"


# ── User ─────────────────────────────────────────────────────────


class User(BaseModel):
    """Document shape for the `users` collection."""

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    full_name: str
    email: str
    password_hash: str
    role: UserRole
    is_active: bool = True
    created_at: datetime = Field(default_factory=utcnow)


# ── Clinical Record ─────────────────────────────────────────────


class ClinicalRecord(BaseModel):
    """Tabular clinical/lab features used for heart disease prediction.

    Stored in the `clinical_records` collection. Each document represents
    one clinical observation for a patient.
    """

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    patient_id: PyObjectId

    # Demographics & vitals
    age: Optional[int] = Field(default=None, ge=1, le=150)
    sex: Optional[Literal["M", "F"]] = None
    chest_pain_type: Optional[Literal["TA", "ATA", "NAP", "ASY"]] = None
    resting_bp: Optional[int] = Field(default=None, ge=0, le=300)
    cholesterol: Optional[int] = Field(default=None, ge=0, le=1000)
    fasting_blood_sugar: Optional[bool] = Field(default=None, description="True if > 120 mg/dl")
    resting_ecg: Optional[Literal["Normal", "ST", "LVH"]] = None
    max_heart_rate: Optional[int] = Field(default=None, ge=0, le=300)
    exercise_angina: Optional[bool] = None
    st_depression: Optional[float] = Field(default=None, ge=-10, le=10)
    st_slope: Optional[Literal["Up", "Flat", "Down"]] = None

    recorded_at: datetime = Field(default_factory=utcnow)


# ── ECG Recording ───────────────────────────────────────────────


class ECGRecording(BaseModel):
    """Metadata for an uploaded ECG signal file.

    The raw waveform is stored on disk; this document tracks file
    location and signal properties. Stored in the `ecg_recordings` collection.
    """

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    patient_id: PyObjectId

    # File info
    original_name: str
    stored_name: str
    storage_path: str
    content_type: Optional[str] = None
    size_bytes: int

    # Signal properties
    sampling_rate_hz: int = 500
    lead_count: int = 1
    duration_seconds: Optional[float] = None

    # Processing
    processing_status: str = "uploaded"
    processing_message: Optional[str] = None

    uploaded_at: datetime = Field(default_factory=utcnow)

