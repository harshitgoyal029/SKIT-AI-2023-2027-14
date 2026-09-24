"""
Patient management router — registration, retrieval, updates, and automatic risk assessment.

Sprint 2(C): Full CRUD operations for clinical patients integrated with
the DNN prediction engine and MongoDB persistence.
"""

from datetime import datetime, timezone
from typing import Any, List, Optional, Union

from bson import ObjectId
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pymongo.database import Database

from database import database as default_db, get_db, get_patient_by_identifier
from ml_engine import predict_patient
from models import Patient, PredictionResult, utcnow

router = APIRouter(prefix="/api/patients", tags=["Patients"])


# ── Schemas ──────────────────────────────────────────────────────


class PatientCreate(BaseModel):
    """Input fields when registering a patient from the frontend form."""

    patientId: str = Field(min_length=1, max_length=50, description="Unique institutional patient identifier")
    name: str = Field(min_length=1, max_length=150, description="Full name of patient")
    age: int = Field(ge=1, le=120, description="Patient age in years")
    gender: str = Field(description="'Male' or 'Female'")
    phone: Optional[str] = Field(default="", max_length=30)
    email: Optional[str] = Field(default="", max_length=100)
    bloodPressure: Optional[str] = Field(default="120/80", description="Blood pressure in 'systolic/diastolic' format")
    cholesterol: Optional[Union[float, int, str]] = Field(default=None, description="Cholesterol level or mg/dL")
    heartRate: Optional[Union[float, int, str]] = Field(default=None, description="Resting heart rate in BPM")
    diabetes: Optional[str] = Field(default="No", description="'Yes' or 'No'")
    smoking: Optional[str] = Field(default="No", description="'Yes' or 'No'")
    familyHistory: Optional[str] = Field(default="No", description="'Yes' or 'No'")
    height: Optional[float] = Field(default=170.0, ge=50, le=250, description="Height in cm")
    weight: Optional[float] = Field(default=70.0, ge=20, le=300, description="Weight in kg")
    autoAssess: Optional[bool] = Field(default=True, description="Automatically calculate CVD risk on registration")


class PatientUpdate(BaseModel):
    """Fields that can be updated for an existing patient."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    age: Optional[int] = Field(default=None, ge=1, le=120)
    gender: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    bloodPressure: Optional[str] = None
    cholesterol: Optional[Union[float, int, str]] = None
    heartRate: Optional[Union[float, int, str]] = None
    diabetes: Optional[str] = None
    smoking: Optional[str] = None
    familyHistory: Optional[str] = None
    height: Optional[float] = None
    weight: Optional[float] = None


class MessageResponse(BaseModel):
    message: str


# ── Helper functions ─────────────────────────────────────────────


def _serialize_patient(doc: dict) -> dict:
    """Format a patient document for API consumers and frontend compatibility."""
    if not doc:
        return {}
    res = dict(doc)
    if "_id" in res:
        res["_id"] = str(res["_id"])
        res["id"] = res["_id"]
    if "createdAt" in res and isinstance(res["createdAt"], datetime):
        res["createdAt"] = res["createdAt"].isoformat()
    if "updatedAt" in res and isinstance(res["updatedAt"], datetime):
        res["updatedAt"] = res["updatedAt"].isoformat()
    return res


# ── Endpoints ────────────────────────────────────────────────────


@router.post("", status_code=status.HTTP_201_CREATED)
def create_patient(
    patient: PatientCreate,
    db: Database = Depends(get_db),
) -> dict:
    """Register a new patient and optionally run automatic cardiovascular risk assessment.

    When autoAssess is true (default), this endpoint leverages the clinical DNN
    model to estimate risk score, risk level ('Low Risk', 'Moderate Risk', 'High Risk'),
    and the top contributing XAI factors.
    """
    patient_id_clean = patient.patientId.strip()

    # Check for existing patient ID
    existing = db["patients"].find_one({"patientId": patient_id_clean})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Patient ID '{patient_id_clean}' already exists in the system.",
        )

    patient_dict = patient.model_dump()
    patient_dict["patientId"] = patient_id_clean
    patient_dict["createdAt"] = utcnow()
    patient_dict["updatedAt"] = utcnow()

    # Calculate cardiovascular risk assessment
    assessment = None
    if patient.autoAssess:
        try:
            assessment = predict_patient(patient_dict)
            patient_dict["risk_score"] = assessment["risk_score"]
            patient_dict["riskLevel"] = assessment["risk_level"]
            patient_dict["risk_level"] = assessment["risk_level"]
            patient_dict["predicted_label"] = assessment["predicted_label"]
            patient_dict["top_contributing_features"] = assessment["top_contributing_features"]
            patient_dict["feature_contributions"] = assessment["feature_contributions"]
            patient_dict["explanations"] = assessment.get("explanations", [])
        except Exception as exc:
            # Prediction failure should not block patient creation
            patient_dict["risk_score"] = None
            patient_dict["riskLevel"] = "Pending"
            patient_dict["risk_level"] = "Pending"
            patient_dict["prediction_note"] = f"Assessment deferred: {exc}"

    # Insert into MongoDB
    insert_result = db["patients"].insert_one(patient_dict)
    patient_dict["_id"] = str(insert_result.inserted_id)
    patient_dict["id"] = patient_dict["_id"]

    # Also log prediction in prediction_results collection if assessment succeeded
    if assessment and assessment.get("risk_score") is not None:
        try:
            pred_record = PredictionResult(
                patient_id=str(insert_result.inserted_id),
                model_name="clinical_dnn",
                model_version="1.0.0",
                risk_score=assessment["risk_score"],
                predicted_label=assessment["predicted_label"],
                top_contributing_features=assessment.get("top_contributing_features", []),
            )
            db["prediction_results"].insert_one(
                pred_record.model_dump(by_alias=True, exclude={"id"})
            )
        except Exception:
            pass

    return _serialize_patient(patient_dict)


@router.get("")
def list_patients(
    search: Optional[str] = Query(default=None, description="Search by patient name or patientId"),
    risk_level: Optional[str] = Query(default=None, description="Filter by risk level (e.g. 'High Risk')"),
    limit: int = Query(default=50, ge=1, le=200),
    skip: int = Query(default=0, ge=0),
    db: Database = Depends(get_db),
) -> dict:
    """Retrieve all registered patients with optional filtering, search, and pagination."""
    query = {}
    if search:
        s = search.strip()
        query["$or"] = [
            {"name": {"$regex": s, "$options": "i"}},
            {"patientId": {"$regex": s, "$options": "i"}},
        ]
    if risk_level:
        query["$or"] = [
            {"riskLevel": risk_level},
            {"risk_level": risk_level},
        ]

    total = db["patients"].count_documents(query)
    cursor = db["patients"].find(query).sort("createdAt", -1).skip(skip).limit(limit)
    patients = [_serialize_patient(doc) for doc in cursor]

    return {
        "total": total,
        "limit": limit,
        "skip": skip,
        "patients": patients,
    }


@router.get("/{identifier}")
def get_patient(
    identifier: str,
    db: Database = Depends(get_db),
) -> dict:
    """Fetch an individual patient by their MongoDB ObjectId or institutional patientId."""
    patient = get_patient_by_identifier(identifier, db=db)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient '{identifier}' was not found.",
        )
    return _serialize_patient(patient)


@router.put("/{identifier}")
def update_patient(
    identifier: str,
    update_data: PatientUpdate,
    db: Database = Depends(get_db),
) -> dict:
    """Update patient vitals or demographics, and recalculate risk score if vitals changed."""
    patient = get_patient_by_identifier(identifier, db=db)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient '{identifier}' was not found.",
        )

    updates = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if not updates:
        return _serialize_patient(patient)

    updates["updatedAt"] = utcnow()
    merged = {**patient, **updates}

    # If key cardiovascular indicators changed, re-run risk assessment
    vitals_changed = any(
        k in updates for k in ("bloodPressure", "age", "cholesterol", "diabetes", "smoking", "gender", "height", "weight")
    )
    if vitals_changed:
        try:
            assessment = predict_patient(merged)
            updates["risk_score"] = assessment["risk_score"]
            updates["riskLevel"] = assessment["risk_level"]
            updates["risk_level"] = assessment["risk_level"]
            updates["predicted_label"] = assessment["predicted_label"]
            updates["top_contributing_features"] = assessment["top_contributing_features"]
            updates["feature_contributions"] = assessment["feature_contributions"]
            updates["explanations"] = assessment.get("explanations", [])
        except Exception:
            pass

    db["patients"].update_one({"_id": patient["_id"]}, {"$set": updates})
    updated_doc = db["patients"].find_one({"_id": patient["_id"]})
    return _serialize_patient(updated_doc)


@router.delete("/{identifier}", response_model=MessageResponse)
def delete_patient(
    identifier: str,
    db: Database = Depends(get_db),
) -> MessageResponse:
    """Delete a patient record and their related predictions."""
    patient = get_patient_by_identifier(identifier, db=db)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient '{identifier}' was not found.",
        )

    db["patients"].delete_one({"_id": patient["_id"]})
    db["prediction_results"].delete_many({"patient_id": str(patient["_id"])})
    return MessageResponse(message=f"Patient '{patient.get('patientId', identifier)}' deleted successfully.")


@router.post("/{identifier}/assess")
def assess_patient(
    identifier: str,
    db: Database = Depends(get_db),
) -> dict:
    """Manually trigger or refresh cardiovascular risk assessment for an existing patient."""
    patient = get_patient_by_identifier(identifier, db=db)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient '{identifier}' was not found.",
        )

    assessment = predict_patient(patient)
    updates = {
        "risk_score": assessment["risk_score"],
        "riskLevel": assessment["risk_level"],
        "risk_level": assessment["risk_level"],
        "predicted_label": assessment["predicted_label"],
        "top_contributing_features": assessment["top_contributing_features"],
        "feature_contributions": assessment["feature_contributions"],
        "explanations": assessment.get("explanations", []),
        "updatedAt": utcnow(),
    }

    db["patients"].update_one({"_id": patient["_id"]}, {"$set": updates})

    # Save to prediction_results
    try:
        pred_record = PredictionResult(
            patient_id=str(patient["_id"]),
            model_name="clinical_dnn",
            model_version="1.0.0",
            risk_score=assessment["risk_score"],
            predicted_label=assessment["predicted_label"],
            top_contributing_features=assessment.get("top_contributing_features", []),
        )
        db["prediction_results"].insert_one(
            pred_record.model_dump(by_alias=True, exclude={"id"})
        )
    except Exception:
        pass

    return {
        "patientId": patient.get("patientId"),
        "name": patient.get("name"),
        "risk_score": assessment["risk_score"],
        "risk_level": assessment["risk_level"],
        "predicted_label": assessment["predicted_label"],
        "feature_contributions": assessment["feature_contributions"],
        "top_contributing_features": assessment["top_contributing_features"],
        "explanations": assessment.get("explanations", []),
    }


# ── Standalone App Fallback ──────────────────────────────────────
# Allows running directly via `uvicorn patient_api:app` if started independently.
app = FastAPI(title="CVD-XAI Patient API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)