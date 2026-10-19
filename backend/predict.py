"""
Prediction router — clinical, ECG, and multimodal risk prediction APIs.

Sprint 2(B): Clinical DNN model inference with SHAP/XAI explanations.
Sprint 3(B): ECG prediction engine (Pan-Tompkins, Butterworth filter,
biomarker extraction, rhythm classification) and Multimodal Fusion API.
"""

import uuid
from pathlib import Path
from typing import Optional, Union

import numpy as np
from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from pymongo.database import Database

from auth import get_current_user, require_role
from database import get_db
from ml_engine import clinical_model
from models import ECGRecording, PredictionResult, UserRole, utcnow
from ecg_engine import (
    LEAD_NAMES,
    extract_ecg_biomarkers,
    parse_ecg_file,
    predict_ecg,
    predict_multimodal,
    preprocess_ecg,
)

router = APIRouter(prefix="/api/predict", tags=["Prediction"])

UPLOADS_DIR = Path(__file__).resolve().parent / "uploads"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ECG_ALLOWED_EXTENSIONS = {".csv", ".txt", ".dat", ".hea", ".npy", ".json"}


# ── Helpers ──────────────────────────────────────────────────────


def _oid(value: str) -> ObjectId:
    """Convert string to ObjectId, raise 400 on failure."""
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid ObjectId format: '{value}'",
        )


# ── Clinical Request / Response Schemas ───────────────────────────


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
    """Response returned after a successful clinical prediction."""

    risk_score: float = Field(description="Probability of CVD (0.0–1.0)")
    predicted_label: str = Field(description="'low_risk', 'moderate_risk', or 'high_risk'")
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
    ecg_engine_ready: bool = True
    ecg_leads_supported: int = 12


# ── ECG Request / Response Schemas ───────────────────────────────


class LeadContribution(BaseModel):
    lead: str
    contribution: float


class ECGBiomarkers(BaseModel):
    heart_rate_bpm: float
    mean_rr_ms: float
    hrv_sdnn_ms: float
    hrv_rmssd_ms: float
    qrs_duration_ms: float
    qt_interval_ms: float
    qtc_interval_ms: float
    rhythm_classification: str
    st_elevations_mm: dict[str, float]
    st_depressions_mm: dict[str, float]
    max_st_elevation_mm: float
    max_st_depression_mm: float
    peaks_detected: int


class ECGPredictionInput(BaseModel):
    ecg_recording_id: Optional[str] = Field(
        default=None,
        description="Optional ObjectId of an uploaded ecg_recordings document",
    )
    signal_data: Optional[list[Union[list[float], float]]] = Field(
        default=None,
        description="Optional raw ECG signal samples array (1D or 2D [samples, leads])",
    )
    sampling_rate_hz: int = Field(default=500, ge=100, le=2000, description="Sampling rate in Hz")
    patient_id: Optional[str] = Field(default=None, description="Optional target patient ID (for clinicians/doctors)")


class ECGPredictionResponse(BaseModel):
    model_name: str = "ecg_cnn_bilstm"
    model_version: str = "1.0.0"
    risk_score: float = Field(description="Probability of cardiac abnormality (0.0-1.0)")
    predicted_label: str = Field(description="'low_risk', 'moderate_risk', or 'high_risk'")
    risk_level: str = Field(description="Human-readable cardiac risk level")
    heart_rate_bpm: float
    rhythm_classification: str
    clinical_findings: list[str]
    risk_factors: list[str]
    lead_contributions: list[LeadContribution]
    metrics: ECGBiomarkers
    ecg_recording_id: Optional[str] = None
    prediction_id: Optional[str] = None


class MultimodalPredictionInput(BaseModel):
    clinical_data: dict = Field(
        description="Clinical vitals dict (e.g. age, gender, bloodPressure, cholesterol, etc. or ClinicalPredictionInput)"
    )
    ecg_recording_id: Optional[str] = Field(
        default=None,
        description="Optional ObjectId of an uploaded ecg_recordings document",
    )
    signal_data: Optional[list[Union[list[float], float]]] = Field(
        default=None,
        description="Optional raw ECG signal samples array",
    )
    sampling_rate_hz: int = Field(default=500, ge=100, le=2000)
    patient_id: Optional[str] = Field(default=None)


class MultimodalPredictionResponse(BaseModel):
    model_name: str = "multimodal_fusion"
    model_version: str = "1.0.0"
    risk_score: float
    predicted_label: str
    risk_level: str
    clinical_component: dict
    ecg_component: dict
    modality_breakdown: dict
    prediction_id: Optional[str] = None
    ecg_recording_id: Optional[str] = None


# ── Internal Helpers ─────────────────────────────────────────────


def _get_or_run_ecg_prediction(rec: dict, db: Database) -> ECGPredictionResponse:
    """Helper to retrieve an existing cached prediction or run inference on an ECG recording."""
    rec_id_str = str(rec["_id"])
    existing = db["prediction_results"].find_one(
        {"ecg_recording_id": rec_id_str},
        sort=[("created_at", -1)],
    )
    if existing and existing.get("metrics"):
        return ECGPredictionResponse(
            model_name=existing.get("model_name", "ecg_cnn_bilstm"),
            model_version=existing.get("model_version", "1.0.0"),
            risk_score=existing["risk_score"],
            predicted_label=existing["predicted_label"],
            risk_level=existing.get("risk_level", "Moderate Risk"),
            heart_rate_bpm=existing.get("heart_rate_bpm", 72.0),
            rhythm_classification=existing.get("rhythm_classification", "Normal Sinus Rhythm"),
            clinical_findings=existing.get("clinical_findings", []),
            risk_factors=existing.get("risk_factors", []),
            lead_contributions=[LeadContribution(**c) for c in existing.get("lead_contributions", [])],
            metrics=ECGBiomarkers(**existing["metrics"]),
            ecg_recording_id=rec_id_str,
            prediction_id=str(existing["_id"]),
        )

    storage_path = Path(rec["storage_path"])
    if not storage_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ECG recording file is missing on disk.",
        )

    result = predict_ecg(
        storage_path,
        filename=rec.get("original_name", "ecg.csv"),
        fs=rec.get("sampling_rate_hz", 500),
    )

    prediction_id = None
    try:
        prediction = PredictionResult(
            patient_id=rec["patient_id"],
            ecg_recording_id=rec_id_str,
            model_name="ecg_cnn_bilstm",
            model_version="1.0.0",
            risk_score=result["risk_score"],
            predicted_label=result["predicted_label"],
            top_contributing_features=[
                f"{c['lead']} lead" for c in result.get("lead_contributions", [])[:5]
            ],
        )
        pred_dict = prediction.model_dump(by_alias=True, exclude={"id"})
        pred_dict["risk_level"] = result["risk_level"]
        pred_dict["clinical_findings"] = result.get("clinical_findings", [])
        pred_dict["risk_factors"] = result.get("risk_factors", [])
        pred_dict["lead_contributions"] = result.get("lead_contributions", [])
        pred_dict["metrics"] = result.get("metrics", {})
        pred_dict["heart_rate_bpm"] = result.get("heart_rate_bpm", 72.0)
        pred_dict["rhythm_classification"] = result.get("rhythm_classification", "Normal Sinus Rhythm")
        res = db["prediction_results"].insert_one(pred_dict)
        prediction_id = str(res.inserted_id)

        db["ecg_recordings"].update_one(
            {"_id": rec["_id"]},
            {
                "$set": {
                    "processing_status": "completed",
                    "processing_message": "Analysis and prediction complete",
                    "latest_prediction_id": prediction_id,
                    "risk_score": result["risk_score"],
                    "risk_level": result["risk_level"],
                }
            },
        )
    except Exception:
        pass

    return ECGPredictionResponse(
        model_name=result["model_name"],
        model_version=result["model_version"],
        risk_score=result["risk_score"],
        predicted_label=result["predicted_label"],
        risk_level=result["risk_level"],
        heart_rate_bpm=result["heart_rate_bpm"],
        rhythm_classification=result["rhythm_classification"],
        clinical_findings=result["clinical_findings"],
        risk_factors=result["risk_factors"],
        lead_contributions=[LeadContribution(**c) for c in result["lead_contributions"]],
        metrics=ECGBiomarkers(**result["metrics"]),
        ecg_recording_id=rec_id_str,
        prediction_id=prediction_id,
    )


# ── Clinical Endpoints ───────────────────────────────────────────


@router.post("/clinical", response_model=PredictionResponse)
def predict_clinical(
    body: ClinicalPredictionInput,
    user: dict = Depends(require_role(UserRole.patient, UserRole.doctor, UserRole.clinician, UserRole.lab_technician)),
    db: Database = Depends(get_db),
) -> PredictionResponse:
    """Run the clinical DNN model and return a CVD risk prediction."""
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

    # Save to database (non-blocking)
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
        pred_dict = prediction.model_dump(by_alias=True, exclude={"id"})
        pred_dict["feature_contributions"] = result.get("feature_contributions", [])
        pred_dict["risk_level"] = result.get("risk_level", "Moderate Risk")
        insert_result = db["prediction_results"].insert_one(pred_dict)
        prediction_id = str(insert_result.inserted_id)
    except Exception:
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


# ── ECG Endpoints ────────────────────────────────────────────────


@router.post("/ecg", response_model=ECGPredictionResponse)
def predict_ecg_endpoint(
    body: ECGPredictionInput,
    user: dict = Depends(require_role(UserRole.patient, UserRole.doctor, UserRole.clinician, UserRole.lab_technician)),
    db: Database = Depends(get_db),
) -> ECGPredictionResponse:
    """Predict cardiovascular abnormality risk from ECG signal data or stored ECG recording."""
    caller_role = user.get("role")
    if body.patient_id and caller_role in (UserRole.doctor, UserRole.clinician, UserRole.lab_technician, UserRole.admin):
        target_patient_id = body.patient_id
    else:
        target_patient_id = str(user["_id"])

    ecg_recording_id = None
    filename = "ecg_signal.csv"

    if body.signal_data is not None and len(body.signal_data) > 0:
        signal_arr = np.array(body.signal_data, dtype=np.float32)
        ecg_source = signal_arr
        filename = "streamed_signal.csv"
    elif body.ecg_recording_id:
        rec = db["ecg_recordings"].find_one({"_id": _oid(body.ecg_recording_id)})
        if not rec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"ECG recording '{body.ecg_recording_id}' not found.",
            )
        storage_path = Path(rec["storage_path"])
        if not storage_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ECG file is no longer available on disk.",
            )
        ecg_source = storage_path
        filename = rec.get("original_name", "ecg.csv")
        ecg_recording_id = str(rec["_id"])
    else:
        # Fall back to patient's most recent uploaded ECG recording
        rec = db["ecg_recordings"].find_one({"patient_id": target_patient_id}, sort=[("uploaded_at", -1)])
        if not rec:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No ECG data provided and no previous ECG recordings found for this patient.",
            )
        storage_path = Path(rec["storage_path"])
        if not storage_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ECG recording file is missing on disk.",
            )
        ecg_source = storage_path
        filename = rec.get("original_name", "ecg.csv")
        ecg_recording_id = str(rec["_id"])

    # Run inference
    try:
        result = predict_ecg(ecg_source, filename=filename, fs=body.sampling_rate_hz)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ECG Prediction failed: {exc}",
        )

    # Persist in DB
    prediction_id = None
    try:
        prediction = PredictionResult(
            patient_id=target_patient_id,
            ecg_recording_id=ecg_recording_id,
            model_name="ecg_cnn_bilstm",
            model_version="1.0.0",
            risk_score=result["risk_score"],
            predicted_label=result["predicted_label"],
            top_contributing_features=[
                f"{c['lead']} lead" for c in result.get("lead_contributions", [])[:5]
            ],
        )
        pred_dict = prediction.model_dump(by_alias=True, exclude={"id"})
        pred_dict["risk_level"] = result["risk_level"]
        pred_dict["clinical_findings"] = result.get("clinical_findings", [])
        pred_dict["risk_factors"] = result.get("risk_factors", [])
        pred_dict["lead_contributions"] = result.get("lead_contributions", [])
        pred_dict["metrics"] = result.get("metrics", {})
        pred_dict["heart_rate_bpm"] = result.get("heart_rate_bpm", 72.0)
        pred_dict["rhythm_classification"] = result.get("rhythm_classification", "Normal Sinus Rhythm")
        insert_result = db["prediction_results"].insert_one(pred_dict)
        prediction_id = str(insert_result.inserted_id)

        if ecg_recording_id:
            db["ecg_recordings"].update_one(
                {"_id": _oid(ecg_recording_id)},
                {
                    "$set": {
                        "processing_status": "completed",
                        "processing_message": "Analysis and prediction complete",
                        "latest_prediction_id": prediction_id,
                        "risk_score": result["risk_score"],
                        "risk_level": result["risk_level"],
                    }
                },
            )
    except Exception:
        pass

    return ECGPredictionResponse(
        model_name=result["model_name"],
        model_version=result["model_version"],
        risk_score=result["risk_score"],
        predicted_label=result["predicted_label"],
        risk_level=result["risk_level"],
        heart_rate_bpm=result["heart_rate_bpm"],
        rhythm_classification=result["rhythm_classification"],
        clinical_findings=result["clinical_findings"],
        risk_factors=result["risk_factors"],
        lead_contributions=[LeadContribution(**c) for c in result["lead_contributions"]],
        metrics=ECGBiomarkers(**result["metrics"]),
        ecg_recording_id=ecg_recording_id,
        prediction_id=prediction_id,
    )


@router.post("/ecg/upload", response_model=ECGPredictionResponse, status_code=status.HTTP_201_CREATED)
async def predict_ecg_upload(
    file: UploadFile = File(...),
    sampling_rate_hz: int = Form(default=500),
    lead_count: int = Form(default=12),
    patient_id: Optional[str] = Form(default=None),
    user: dict = Depends(require_role(UserRole.patient, UserRole.doctor, UserRole.clinician, UserRole.lab_technician)),
    db: Database = Depends(get_db),
) -> ECGPredictionResponse:
    """Directly upload an ECG file, store it, run prediction, and return biomarkers & risk score."""
    original_name = Path(file.filename or "ecg_upload.csv").name
    suffix = Path(original_name).suffix.lower()

    if suffix not in ECG_ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File extension '{suffix}' not supported. Allowed: {', '.join(sorted(ECG_ALLOWED_EXTENSIONS))}",
        )

    content = await file.read(MAX_FILE_SIZE + 1)
    if not content or len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be between 1 byte and 10 MB.",
        )

    caller_role = user.get("role")
    if patient_id and caller_role in (UserRole.doctor, UserRole.clinician, UserRole.lab_technician, UserRole.admin):
        target_patient_id = patient_id
    else:
        target_patient_id = str(user["_id"])

    # Store file to disk
    stored_name = f"{uuid.uuid4()}{suffix}"
    patient_folder = UPLOADS_DIR / "ecg" / target_patient_id
    patient_folder.mkdir(parents=True, exist_ok=True)
    destination = patient_folder / stored_name
    destination.write_bytes(content)

    # Record in ecg_recordings
    ecg_doc = ECGRecording(
        patient_id=target_patient_id,
        original_name=original_name,
        stored_name=stored_name,
        storage_path=str(destination),
        content_type=file.content_type,
        size_bytes=len(content),
        sampling_rate_hz=sampling_rate_hz,
        lead_count=lead_count,
        processing_status="processing",
        processing_message="Analysis in progress",
    )
    insert_res = db["ecg_recordings"].insert_one(
        ecg_doc.model_dump(by_alias=True, exclude={"id"})
    )
    ecg_recording_id = str(insert_res.inserted_id)

    # Run inference
    try:
        result = predict_ecg(destination, filename=original_name, fs=sampling_rate_hz)
    except Exception as exc:
        db["ecg_recordings"].update_one(
            {"_id": insert_res.inserted_id},
            {"$set": {"processing_status": "failed", "processing_message": str(exc)}},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ECG Prediction failed: {exc}",
        )

    # Store prediction result
    prediction_id = None
    try:
        prediction = PredictionResult(
            patient_id=target_patient_id,
            ecg_recording_id=ecg_recording_id,
            model_name="ecg_cnn_bilstm",
            model_version="1.0.0",
            risk_score=result["risk_score"],
            predicted_label=result["predicted_label"],
            top_contributing_features=[
                f"{c['lead']} lead" for c in result.get("lead_contributions", [])[:5]
            ],
        )
        pred_dict = prediction.model_dump(by_alias=True, exclude={"id"})
        pred_dict["risk_level"] = result["risk_level"]
        pred_dict["clinical_findings"] = result.get("clinical_findings", [])
        pred_dict["risk_factors"] = result.get("risk_factors", [])
        pred_dict["lead_contributions"] = result.get("lead_contributions", [])
        pred_dict["metrics"] = result.get("metrics", {})
        pred_dict["heart_rate_bpm"] = result.get("heart_rate_bpm", 72.0)
        pred_dict["rhythm_classification"] = result.get("rhythm_classification", "Normal Sinus Rhythm")
        res = db["prediction_results"].insert_one(pred_dict)
        prediction_id = str(res.inserted_id)

        # Update ecg_recordings status
        db["ecg_recordings"].update_one(
            {"_id": insert_res.inserted_id},
            {
                "$set": {
                    "processing_status": "completed",
                    "processing_message": "Analysis and prediction complete",
                    "latest_prediction_id": prediction_id,
                    "risk_score": result["risk_score"],
                    "risk_level": result["risk_level"],
                }
            },
        )
    except Exception:
        pass

    return ECGPredictionResponse(
        model_name=result["model_name"],
        model_version=result["model_version"],
        risk_score=result["risk_score"],
        predicted_label=result["predicted_label"],
        risk_level=result["risk_level"],
        heart_rate_bpm=result["heart_rate_bpm"],
        rhythm_classification=result["rhythm_classification"],
        clinical_findings=result["clinical_findings"],
        risk_factors=result["risk_factors"],
        lead_contributions=[LeadContribution(**c) for c in result["lead_contributions"]],
        metrics=ECGBiomarkers(**result["metrics"]),
        ecg_recording_id=ecg_recording_id,
        prediction_id=prediction_id,
    )


@router.post("/multimodal", response_model=MultimodalPredictionResponse)
def predict_multimodal_endpoint(
    body: MultimodalPredictionInput,
    user: dict = Depends(require_role(UserRole.patient, UserRole.doctor, UserRole.clinician, UserRole.lab_technician)),
    db: Database = Depends(get_db),
) -> MultimodalPredictionResponse:
    """Multimodal prediction combining clinical measurements and ECG electrophysiology."""
    caller_role = user.get("role")
    if body.patient_id and caller_role in (UserRole.doctor, UserRole.clinician, UserRole.lab_technician, UserRole.admin):
        target_patient_id = body.patient_id
    else:
        target_patient_id = str(user["_id"])

    ecg_recording_id = None
    filename = "ecg_signal.csv"

    if body.signal_data is not None and len(body.signal_data) > 0:
        signal_arr = np.array(body.signal_data, dtype=np.float32)
        ecg_source = signal_arr
        filename = "streamed_signal.csv"
    elif body.ecg_recording_id:
        rec = db["ecg_recordings"].find_one({"_id": _oid(body.ecg_recording_id)})
        if not rec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"ECG recording '{body.ecg_recording_id}' not found.",
            )
        storage_path = Path(rec["storage_path"])
        if not storage_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ECG recording file is missing on disk.",
            )
        ecg_source = storage_path
        filename = rec.get("original_name", "ecg.csv")
        ecg_recording_id = str(rec["_id"])
    else:
        rec = db["ecg_recordings"].find_one({"patient_id": target_patient_id}, sort=[("uploaded_at", -1)])
        if not rec:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No ECG data provided and no previous ECG recordings found for this patient.",
            )
        storage_path = Path(rec["storage_path"])
        if not storage_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ECG recording file is missing on disk.",
            )
        ecg_source = storage_path
        filename = rec.get("original_name", "ecg.csv")
        ecg_recording_id = str(rec["_id"])

    try:
        result = predict_multimodal(
            clinical_data=body.clinical_data,
            ecg_source=ecg_source,
            filename=filename,
            fs=body.sampling_rate_hz,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Multimodal prediction failed: {exc}",
        )

    prediction_id = None
    try:
        prediction = PredictionResult(
            patient_id=target_patient_id,
            ecg_recording_id=ecg_recording_id,
            model_name="multimodal_fusion",
            model_version="1.0.0",
            risk_score=result["risk_score"],
            predicted_label=result["predicted_label"],
            top_contributing_features=result.get("clinical_component", {}).get("top_features", []),
        )
        pred_dict = prediction.model_dump(by_alias=True, exclude={"id"})
        pred_dict["risk_level"] = result["risk_level"]
        pred_dict["clinical_component"] = result.get("clinical_component", {})
        pred_dict["ecg_component"] = result.get("ecg_component", {})
        pred_dict["modality_breakdown"] = result.get("modality_breakdown", {})
        res = db["prediction_results"].insert_one(pred_dict)
        prediction_id = str(res.inserted_id)
    except Exception:
        pass

    return MultimodalPredictionResponse(
        model_name=result["model_name"],
        model_version=result["model_version"],
        risk_score=result["risk_score"],
        predicted_label=result["predicted_label"],
        risk_level=result["risk_level"],
        clinical_component=result["clinical_component"],
        ecg_component=result["ecg_component"],
        modality_breakdown=result["modality_breakdown"],
        prediction_id=prediction_id,
        ecg_recording_id=ecg_recording_id,
    )


@router.get("/ecg/latest", response_model=ECGPredictionResponse)
def get_latest_ecg_prediction(
    user: dict = Depends(require_role(UserRole.patient, UserRole.doctor, UserRole.clinician, UserRole.lab_technician)),
    db: Database = Depends(get_db),
) -> ECGPredictionResponse:
    """Retrieve the prediction for the current user's most recent ECG recording."""
    patient_id = str(user["_id"])
    rec = db["ecg_recordings"].find_one({"patient_id": patient_id}, sort=[("uploaded_at", -1)])
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No ECG recordings found for current user.",
        )
    return _get_or_run_ecg_prediction(rec, db)


@router.get("/ecg/{ecg_id}", response_model=ECGPredictionResponse)
def get_ecg_prediction_by_id(
    ecg_id: str,
    user: dict = Depends(require_role(UserRole.patient, UserRole.doctor, UserRole.clinician, UserRole.lab_technician)),
    db: Database = Depends(get_db),
) -> ECGPredictionResponse:
    """Retrieve or compute ECG prediction for a specific ECG recording ID."""
    rec = db["ecg_recordings"].find_one({"_id": _oid(ecg_id)})
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ECG recording '{ecg_id}' not found.",
        )
    if user.get("role") == UserRole.patient and rec["patient_id"] != str(user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this ECG recording.",
        )
    return _get_or_run_ecg_prediction(rec, db)


# ── System / History / Registered Patient Endpoints ───────────────


@router.get("/health", response_model=ModelHealthResponse)
def model_health() -> ModelHealthResponse:
    """Check whether the prediction models and inference engines are loaded and ready."""
    return ModelHealthResponse(
        status="ok" if clinical_model.is_loaded else "model_not_loaded",
        model_loaded=clinical_model.is_loaded,
        model_name="clinical_dnn + ecg_cnn_bilstm",
        feature_count=len(clinical_model.feature_names) if clinical_model.is_loaded else 0,
        ecg_engine_ready=True,
        ecg_leads_supported=12,
    )


@router.get("/history")
def prediction_history(
    user: dict = Depends(require_role(UserRole.patient, UserRole.doctor, UserRole.clinician)),
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
            "risk_level": doc.get("risk_level") or ("High Risk" if doc["risk_score"] >= 0.6 else ("Moderate Risk" if doc["risk_score"] >= 0.3 else "Low Risk")),
            "predicted_label": doc["predicted_label"],
            "model_name": doc.get("model_name"),
            "top_contributing_features": doc.get("top_contributing_features", []),
            "feature_contributions": doc.get("feature_contributions", []),
            "clinical_record_id": doc.get("clinical_record_id"),
            "ecg_recording_id": doc.get("ecg_recording_id"),
            "clinical_findings": doc.get("clinical_findings", []),
            "lead_contributions": doc.get("lead_contributions", []),
            "metrics": doc.get("metrics"),
            "modality_breakdown": doc.get("modality_breakdown"),
            "created_at": doc.get("created_at"),
        }
        for doc in results
    ]


@router.post("/patient/{identifier}")
def predict_registered_patient(
    identifier: str,
    db: Database = Depends(get_db),
) -> dict:
    """Run cardiovascular risk prediction and XAI analysis for a registered patient."""
    from database import get_patient_by_identifier
    from ml_engine import predict_patient

    patient = get_patient_by_identifier(identifier, db=db)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient '{identifier}' was not found.",
        )

    result = predict_patient(patient)

    # Persist prediction in DB
    prediction_id = None
    try:
        pred_record = PredictionResult(
            patient_id=str(patient["_id"]),
            model_name="clinical_dnn",
            model_version="1.0.0",
            risk_score=result["risk_score"],
            predicted_label=result["predicted_label"],
            top_contributing_features=result.get("top_contributing_features", []),
        )
        insert_res = db["prediction_results"].insert_one(
            pred_record.model_dump(by_alias=True, exclude={"id"})
        )
        prediction_id = str(insert_res.inserted_id)

        # Update patient document with latest assessment
        db["patients"].update_one(
            {"_id": patient["_id"]},
            {
                "$set": {
                    "risk_score": result["risk_score"],
                    "riskLevel": result["risk_level"],
                    "risk_level": result["risk_level"],
                    "predicted_label": result["predicted_label"],
                    "top_contributing_features": result["top_contributing_features"],
                    "feature_contributions": result["feature_contributions"],
                    "explanations": result.get("explanations", []),
                    "updatedAt": utcnow(),
                }
            },
        )
    except Exception:
        pass

    return {
        "patientId": patient.get("patientId"),
        "name": patient.get("name"),
        "prediction_id": prediction_id,
        "risk_score": result["risk_score"],
        "predicted_label": result["predicted_label"],
        "risk_level": result["risk_level"],
        "feature_contributions": result["feature_contributions"],
        "top_contributing_features": result["top_contributing_features"],
        "explanations": result.get("explanations", []),
    }


@router.post("/explain")
def explain_clinical_risk(
    body: dict,
) -> dict:
    """Explainable AI (XAI) endpoint — produces feature-by-feature clinical interpretations."""
    from ml_engine import predict_patient

    result = predict_patient(body)
    return {
        "risk_score": result["risk_score"],
        "risk_level": result["risk_level"],
        "predicted_label": result["predicted_label"],
        "feature_contributions": result["feature_contributions"],
        "explanations": result.get("explanations", []),
        "clinical_summary": (
            f"Patient is assessed as {result['risk_level']} (risk score: {result['risk_score'] * 100:.1f}%). "
            f"The primary contributing factor is {result['top_contributing_features'][0] if result['top_contributing_features'] else 'multiple vitals'}."
        ),
    }
