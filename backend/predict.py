"""
Prediction router — clinical risk prediction API.

Sprint 2(B): Accepts patient clinical data, runs it through the
trained DNN model, and returns a CVD risk prediction with feature
contributions.
"""

from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from pymongo.database import Database

from auth import get_current_user, require_role
from database import get_db
from ml_engine import clinical_model
from models import PredictionResult, UserRole, utcnow

router = APIRouter(prefix="/api/predict", tags=["Prediction"])


# ── Request / Response Schemas ───────────────────────────────────


class ClinicalPredictionInput(BaseModel):
    """Input fields for a clinical CVD risk prediction."""

    gender: int = Field(ge=0, le=1, description="0 = Female, 1 = Male")
    height: float = Field(gt=0, le=300, description="Height in cm")
    weight: float = Field(gt=0, le=500, description="Weight in kg")
    ap_hi: int = Field(gt=0, le=300, description="Systolic blood pressure (mmHg)")
    ap_lo: int = Field(gt=0, le=200, description="Diastolic blood pressure (mmHg)")
    cholesterol: int = Field(ge=1, le=3, description="1 = Normal, 2 = Above normal, 3 = Well above normal")
    gluc: int = Field(ge=1, le=3, description="1 = Normal, 2 = Above normal, 3 = Well above normal")
    smoke: int = Field(ge=0, le=1, description="0 = No, 1 = Yes")
    alco: int = Field(ge=0, le=1, description="0 = No, 1 = Yes")
    active: int = Field(ge=0, le=1, description="0 = No, 1 = Yes (physically active)")
    age_years: float = Field(gt=0, le=150, description="Age in years")

    # Optional: link prediction to an existing clinical record
    clinical_record_id: Optional[str] = Field(
        default=None,
        description="Optional ObjectId of an existing clinical_records document",
    )


class FeatureContribution(BaseModel):
    feature: str
    importance: float


class PredictionResponse(BaseModel):
    """Response returned after a successful prediction."""

    risk_score: float = Field(description="Probability of CVD (0.0–1.0)")
    predicted_label: str = Field(description="'low_risk' or 'high_risk'")
    risk_level: str = Field(description="Human-readable risk level")
    feature_contributions: list[FeatureContribution]
    prediction_id: Optional[str] = Field(
        default=None,
        description="MongoDB ObjectId of the stored prediction (if DB is available)",
    )


class ModelHealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_name: str
    feature_count: int


# ── Endpoints ────────────────────────────────────────────────────


@router.post("/clinical", response_model=PredictionResponse)
def predict_clinical(
    body: ClinicalPredictionInput,
    user: dict = Depends(require_role(UserRole.patient, UserRole.doctor, UserRole.lab_technician)),
    db: Database = Depends(get_db),
) -> PredictionResponse:
    """Run the clinical DNN model and return a CVD risk prediction.

    The model expects 11 raw input features, from which it derives
    BMI, pulse pressure, MAP, and one-hot encoded cholesterol/glucose
    to produce a 16-feature vector.
    """
    if not clinical_model.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Prediction model is not loaded. Please try again later.",
        )

    # Validate blood pressure consistency
    if body.ap_hi <= body.ap_lo:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Systolic BP (ap_hi) must be greater than diastolic BP (ap_lo).",
        )

    # Run prediction
    try:
        result = clinical_model.predict(body.model_dump())
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction failed: {exc}",
        )

    # Save to database (non-blocking — prediction still returns on failure)
    prediction_id = None
    try:
        prediction = PredictionResult(
            patient_id=str(user["_id"]),
            clinical_record_id=body.clinical_record_id,
            model_name="clinical_dnn",
            model_version="1.0.0",
            risk_score=result["risk_score"],
            predicted_label=result["predicted_label"],
            top_contributing_features=[
                c["feature"] for c in result["feature_contributions"][:5]
            ],
        )
        insert_result = db["prediction_results"].insert_one(
            prediction.model_dump(by_alias=True, exclude={"id"})
        )
        prediction_id = str(insert_result.inserted_id)
    except Exception:
        # DB save is optional — don't fail the prediction
        pass

    return PredictionResponse(
        risk_score=result["risk_score"],
        predicted_label=result["predicted_label"],
        risk_level=result["risk_level"],
        feature_contributions=[
            FeatureContribution(**c) for c in result["feature_contributions"]
        ],
        prediction_id=prediction_id,
    )


@router.get("/health", response_model=ModelHealthResponse)
def model_health() -> ModelHealthResponse:
    """Check whether the prediction model is loaded and ready."""
    return ModelHealthResponse(
        status="ok" if clinical_model.is_loaded else "model_not_loaded",
        model_loaded=clinical_model.is_loaded,
        model_name="clinical_dnn",
        feature_count=len(clinical_model.feature_names) if clinical_model.is_loaded else 0,
    )


@router.get("/history")
def prediction_history(
    user: dict = Depends(require_role(UserRole.patient, UserRole.doctor)),
    db: Database = Depends(get_db),
) -> list[dict]:
    """Get prediction history for the current user (most recent first)."""
    patient_id = str(user["_id"])
    results = (
        db["prediction_results"]
        .find({"patient_id": patient_id})
        .sort("created_at", -1)
        .limit(50)
    )
    return [
        {
            "id": str(doc["_id"]),
            "risk_score": doc["risk_score"],
            "predicted_label": doc["predicted_label"],
            "model_name": doc.get("model_name"),
            "top_contributing_features": doc.get("top_contributing_features", []),
            "created_at": doc.get("created_at"),
        }
        for doc in results
    ]
