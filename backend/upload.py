"""
Data upload router — clinical data submission and ECG file uploads.

Sprint 1(C): APIs for patients to upload clinical and ECG data.
"""

import uuid
from pathlib import Path
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from pymongo.database import Database

from auth import get_current_user, require_role
from database import get_db
from models import ClinicalRecord, ECGRecording, UserRole, utcnow

router = APIRouter(prefix="/api/data", tags=["Data Upload"])

UPLOADS_DIR = Path(__file__).resolve().parent / "uploads"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ECG_ALLOWED_EXTENSIONS = {".csv", ".txt", ".dat", ".hea", ".pdf", ".png", ".jpg", ".jpeg"}


# ── Schemas ──────────────────────────────────────────────────────


class ClinicalDataInput(BaseModel):
    """Request body for submitting clinical measurements."""

    age: Optional[int] = Field(default=None, ge=1, le=150)
    sex: Optional[str] = Field(default=None, max_length=10)
    chest_pain_type: Optional[str] = Field(default=None, max_length=10)
    resting_bp: Optional[int] = Field(default=None, ge=0, le=300)
    cholesterol: Optional[int] = Field(default=None, ge=0, le=1000)
    fasting_blood_sugar: Optional[bool] = None
    resting_ecg: Optional[str] = Field(default=None, max_length=20)
    max_heart_rate: Optional[int] = Field(default=None, ge=0, le=300)
    exercise_angina: Optional[bool] = None
    st_depression: Optional[float] = Field(default=None, ge=-10, le=10)
    st_slope: Optional[str] = Field(default=None, max_length=10)


class MessageResponse(BaseModel):
    message: str


# ── Helpers ──────────────────────────────────────────────────────


def _oid(value: str) -> ObjectId:
    """Convert string to ObjectId, raise 400 on failure."""
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ID format.")


def _clinical_payload(doc: dict) -> dict:
    """Format a clinical_records document for API response."""
    return {
        "id": str(doc["_id"]),
        "age": doc.get("age"),
        "sex": doc.get("sex"),
        "chest_pain_type": doc.get("chest_pain_type"),
        "resting_bp": doc.get("resting_bp"),
        "cholesterol": doc.get("cholesterol"),
        "fasting_blood_sugar": doc.get("fasting_blood_sugar"),
        "resting_ecg": doc.get("resting_ecg"),
        "max_heart_rate": doc.get("max_heart_rate"),
        "exercise_angina": doc.get("exercise_angina"),
        "st_depression": doc.get("st_depression"),
        "st_slope": doc.get("st_slope"),
        "recorded_at": doc.get("recorded_at"),
    }


def _ecg_payload(doc: dict) -> dict:
    """Format an ecg_recordings document for API response."""
    return {
        "id": str(doc["_id"]),
        "original_name": doc["original_name"],
        "content_type": doc.get("content_type"),
        "size_bytes": doc["size_bytes"],
        "sampling_rate_hz": doc.get("sampling_rate_hz", 500),
        "lead_count": doc.get("lead_count", 1),
        "duration_seconds": doc.get("duration_seconds"),
        "processing_status": doc.get("processing_status", "uploaded"),
        "processing_message": doc.get("processing_message"),
        "uploaded_at": doc.get("uploaded_at"),
    }


# ══════════════════════════════════════════════════════════════════
#  CLINICAL DATA ROUTES
# ══════════════════════════════════════════════════════════════════


@router.post("/clinical", status_code=status.HTTP_201_CREATED)
def submit_clinical_data(
    body: ClinicalDataInput,
    user: dict = Depends(require_role(UserRole.patient, UserRole.doctor, UserRole.lab_technician)),
    db: Database = Depends(get_db),
) -> dict:
    """Submit a clinical observation (vitals, lab results)."""
    patient_id = str(user["_id"])

    record = ClinicalRecord(
        patient_id=patient_id,
        **body.model_dump(),
    )
    result = db["clinical_records"].insert_one(
        record.model_dump(by_alias=True, exclude={"id"})
    )
    inserted = db["clinical_records"].find_one({"_id": result.inserted_id})
    return _clinical_payload(inserted)


@router.get("/clinical")
def list_clinical_data(
    user: dict = Depends(require_role(UserRole.patient, UserRole.doctor)),
    db: Database = Depends(get_db),
) -> list[dict]:
    """Get all clinical records for the current user."""
    patient_id = str(user["_id"])
    records = db["clinical_records"].find({"patient_id": patient_id}).sort("recorded_at", -1)
    return [_clinical_payload(r) for r in records]


@router.get("/clinical/{record_id}")
def get_clinical_record(
    record_id: str,
    user: dict = Depends(require_role(UserRole.patient, UserRole.doctor)),
    db: Database = Depends(get_db),
) -> dict:
    """Get a single clinical record by ID."""
    doc = db["clinical_records"].find_one({"_id": _oid(record_id)})
    if not doc or doc["patient_id"] != str(user["_id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clinical record not found.")
    return _clinical_payload(doc)


@router.delete("/clinical/{record_id}", response_model=MessageResponse)
def delete_clinical_record(
    record_id: str,
    user: dict = Depends(require_role(UserRole.patient)),
    db: Database = Depends(get_db),
) -> MessageResponse:
    """Delete a clinical record."""
    result = db["clinical_records"].delete_one({
        "_id": _oid(record_id),
        "patient_id": str(user["_id"]),
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clinical record not found.")
    return MessageResponse(message="Clinical record deleted.")


# ══════════════════════════════════════════════════════════════════
#  ECG UPLOAD ROUTES
# ══════════════════════════════════════════════════════════════════


@router.post("/ecg", status_code=status.HTTP_201_CREATED)
async def upload_ecg(
    file: UploadFile = File(...),
    sampling_rate_hz: int = Form(default=500),
    lead_count: int = Form(default=1),
    duration_seconds: Optional[float] = Form(default=None),
    user: dict = Depends(require_role(UserRole.patient, UserRole.lab_technician)),
    db: Database = Depends(get_db),
) -> dict:
    """Upload an ECG signal file (CSV, TXT, DAT, HEA, PDF, or image)."""
    original_name = Path(file.filename or "ecg_upload").name
    suffix = Path(original_name).suffix.lower()

    if suffix not in ECG_ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{suffix}' is not supported. Allowed: {', '.join(sorted(ECG_ALLOWED_EXTENSIONS))}",
        )

    content = await file.read(MAX_FILE_SIZE + 1)
    if not content or len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be between 1 byte and 10 MB.",
        )

    # Save file to disk
    patient_id = str(user["_id"])
    stored_name = f"{uuid.uuid4()}{suffix}"
    patient_folder = UPLOADS_DIR / "ecg" / patient_id
    patient_folder.mkdir(parents=True, exist_ok=True)
    destination = patient_folder / stored_name
    destination.write_bytes(content)

    # Save metadata to MongoDB
    ecg = ECGRecording(
        patient_id=patient_id,
        original_name=original_name,
        stored_name=stored_name,
        storage_path=str(destination),
        content_type=file.content_type,
        size_bytes=len(content),
        sampling_rate_hz=sampling_rate_hz,
        lead_count=lead_count,
        duration_seconds=duration_seconds,
        processing_status="uploaded",
        processing_message="ECG file received and stored.",
    )
    result = db["ecg_recordings"].insert_one(
        ecg.model_dump(by_alias=True, exclude={"id"})
    )
    inserted = db["ecg_recordings"].find_one({"_id": result.inserted_id})
    return _ecg_payload(inserted)


@router.get("/ecg")
def list_ecg_recordings(
    user: dict = Depends(require_role(UserRole.patient, UserRole.doctor)),
    db: Database = Depends(get_db),
) -> list[dict]:
    """List all ECG recordings for the current user."""
    patient_id = str(user["_id"])
    recordings = db["ecg_recordings"].find({"patient_id": patient_id}).sort("uploaded_at", -1)
    return [_ecg_payload(r) for r in recordings]


@router.get("/ecg/{ecg_id}")
def get_ecg_recording(
    ecg_id: str,
    user: dict = Depends(require_role(UserRole.patient, UserRole.doctor)),
    db: Database = Depends(get_db),
) -> dict:
    """Get metadata for a single ECG recording."""
    doc = db["ecg_recordings"].find_one({"_id": _oid(ecg_id)})
    if not doc or doc["patient_id"] != str(user["_id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ECG recording not found.")
    return _ecg_payload(doc)


@router.get("/ecg/{ecg_id}/download")
def download_ecg(
    ecg_id: str,
    user: dict = Depends(require_role(UserRole.patient, UserRole.doctor)),
    db: Database = Depends(get_db),
) -> FileResponse:
    """Download an ECG signal file."""
    doc = db["ecg_recordings"].find_one({"_id": _oid(ecg_id)})
    if not doc or doc["patient_id"] != str(user["_id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ECG recording not found.")
    path = Path(doc["storage_path"])
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File is no longer available on disk.")
    return FileResponse(path, media_type=doc.get("content_type") or "application/octet-stream", filename=doc["original_name"])


@router.delete("/ecg/{ecg_id}", response_model=MessageResponse)
def delete_ecg(
    ecg_id: str,
    user: dict = Depends(require_role(UserRole.patient)),
    db: Database = Depends(get_db),
) -> MessageResponse:
    """Delete an ECG recording and its file from disk."""
    doc = db["ecg_recordings"].find_one({
        "_id": _oid(ecg_id),
        "patient_id": str(user["_id"]),
    })
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ECG recording not found.")

    # Remove file from disk
    path = Path(doc["storage_path"])
    if path.is_file():
        path.unlink()

    # Remove from database
    db["ecg_recordings"].delete_one({"_id": doc["_id"]})
    return MessageResponse(message="ECG recording deleted.")
