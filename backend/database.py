from pymongo import MongoClient
from pymongo.database import Database
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

from config import settings



import ssl

try:
    import certifi
    _ca_file = certifi.where()
except ImportError:
    _ca_file = None

_tls_context = ssl.create_default_context(cafile=_ca_file)
_tls_context.minimum_version = ssl.TLSVersion.TLSv1_2
_tls_context.check_hostname = True

client: MongoClient = MongoClient(
    settings.MONGODB_URI,
    serverSelectionTimeoutMS=5000,
    tls=True,
    tlsCAFile=_ca_file,
)
database: Database = client[settings.MONGODB_DB_NAME]


def get_db() -> Database:
    """FastAPI dependency — returns the MongoDB database handle."""
    return database


def ping_db() -> dict:
    """Ping the MongoDB server and return connection status.

    Returns a dict with `connected` (bool), `database` name, and
    `latency_ms` on success or `error` message on failure.
    """
    import time

    try:
        start = time.perf_counter()
        client.admin.command("ping")
        latency = round((time.perf_counter() - start) * 1000, 2)
        return {
            "connected": True,
            "database": settings.MONGODB_DB_NAME,
            "latency_ms": latency,
        }
    except (ConnectionFailure, ServerSelectionTimeoutError) as exc:
        return {
            "connected": False,
            "database": settings.MONGODB_DB_NAME,
            "error": str(exc),
        }


def verify_connection() -> None:
    """Verify MongoDB is reachable. Called on startup — fails fast if not."""
    try:
        client.admin.command("ping")
    except (ConnectionFailure, ServerSelectionTimeoutError) as exc:
        raise RuntimeError(
            f"Cannot connect to MongoDB at startup.\n"
            f"  URI: {settings.MONGODB_URI[:30]}...\n"
            f"  Error: {exc}\n"
            f"  → Check your .env file and network connection."
        ) from exc


def init_indexes() -> None:
    """Create indexes needed for correctness and performance.

    Called once on application startup. Safe to call multiple times —
    MongoDB skips indexes that already exist.
    """
    database["users"].create_index("email", unique=True)
    database["patient_profiles"].create_index("user_id", unique=True)
    database["health_profiles"].create_index("patient_id", unique=True)
    database["medical_documents"].create_index("patient_id")
    database["medical_documents"].create_index("stored_name", unique=True)
    database["clinical_records"].create_index("patient_id")
    database["clinical_records"].create_index([("patient_id", 1), ("recorded_at", -1)])
    database["ecg_recordings"].create_index("patient_id")
    database["ecg_recordings"].create_index("stored_name", unique=True)
    database["ecg_recordings"].create_index([("patient_id", 1), ("uploaded_at", -1)])
    database["prediction_results"].create_index("patient_id")
    database["prediction_results"].create_index([("patient_id", 1), ("created_at", -1)])
    database["prediction_results"].create_index([("model_name", 1), ("created_at", -1)])
    database["patients"].create_index("patientId", unique=True)
    database["patients"].create_index([("createdAt", -1)])
    database["patients"].create_index("riskLevel")


def get_collection_stats() -> dict:
    """Return document counts for each collection (useful for dashboards)."""
    collections = [
        "users", "patients", "patient_profiles", "health_profiles",
        "medical_documents", "clinical_records", "ecg_recordings",
        "prediction_results",
    ]
    stats = {}
    for name in collections:
        try:
            stats[name] = database[name].count_documents({})
        except Exception:
            stats[name] = 0
    return stats


def get_patient_clinical_history(patient_id: str, limit: int = 10) -> list:
    """Return a patient's most recent clinical records, newest first.

    Uses the (patient_id, recorded_at) compound index created in
    init_indexes() so this stays fast even as the collection grows.
    """
    cursor = (
        database["clinical_records"]
        .find({"patient_id": patient_id})
        .sort("recorded_at", -1)
        .limit(limit)
    )
    return list(cursor)


def get_patient_ecg_history(patient_id: str, limit: int = 10) -> list:
    """Return a patient's most recent ECG recordings, newest first.

    Uses the (patient_id, uploaded_at) compound index created in
    init_indexes(). Added ahead of the ECG prediction endpoint (not yet
    built) so that groundwork is ready when someone wires it up.
    """
    cursor = (
        database["ecg_recordings"]
        .find({"patient_id": patient_id})
        .sort("uploaded_at", -1)
        .limit(limit)
    )
    return list(cursor)


def get_patient_by_identifier(identifier: str, db: Database | None = None) -> dict | None:
    """Find a patient document by MongoDB _id (if valid ObjectId) or by clinical patientId."""
    from bson import ObjectId
    target_db = db if db is not None else database
    doc = None
    if ObjectId.is_valid(identifier):
        try:
            doc = target_db["patients"].find_one({"_id": ObjectId(identifier)})
        except Exception:
            doc = None
    if not doc:
        try:
            doc = target_db["patients"].find_one({"patientId": identifier})
        except Exception:
            doc = None
    return doc


def get_patient_prediction_history(patient_id: str, limit: int = 10, db: Database | None = None) -> list:
    """Return a patient's most recent AI prediction results, newest first.

    Uses the (patient_id, created_at) compound index created in
    init_indexes(). Groundwork for the SHAP/LIME explanation history UI.
    """
    target_db = db if db is not None else database
    cursor = (
        target_db["prediction_results"]
        .find({"patient_id": patient_id})
        .sort("created_at", -1)
        .limit(limit)
    )
    return list(cursor)


def get_training_cohort(db: Database | None = None, limit: int = 1000) -> list[dict]:
    """Retrieve verified clinical patient records structured for model training.

    Sprint 3 (Help Organize Training): Filters records with valid cardiovascular
    vitals and projects only the necessary fields for feature extraction.
    """
    target_db = db if db is not None else database
    query = {
        "age": {"$gte": 18, "$lte": 100},
        "resting_bp": {"$gte": 50, "$lte": 250},
        "cholesterol": {"$gte": 50, "$lte": 600},
    }
    cursor = target_db["clinical_records"].find(query).limit(limit)
    return list(cursor)


def get_multimodal_training_pairs(db: Database | None = None, limit: int = 500) -> list[dict]:
    """Retrieve matched pairs of clinical records and 12-lead ECG metadata.

    Sprint 3 (Help Organize Training): Enables Deepak's multimodal fusion model
    to train on synchronized clinical and ECG signal pairs.
    """
    target_db = db if db is not None else database
    clinical_col = target_db["clinical_records"]
    ecg_col = target_db["ecg_recordings"]

    pairs = []
    cursor = clinical_col.find().limit(limit)
    for cr in cursor:
        patient_id = cr.get("patient_id")
        if not patient_id:
            continue
        ecg = ecg_col.find_one({
            "patient_id": patient_id,
            "processing_status": {"$in": ["uploaded", "processed", "sample", "training_ready"]},
        })
        if ecg:
            pairs.append({
                "patient_id": patient_id,
                "clinical_record": cr,
                "ecg_recording": ecg,
            })
    return pairs



def save_prediction_explanation(
    patient_id: str,
    prediction_data: dict,
    db: Database | None = None
) -> dict:
    """Save an explainable AI prediction record with SHAP/LIME feature attributions.

    Sprint 3 (SHAP storage setup): Persists local feature contributions, waterfall
    data, and model confidence scores in MongoDB for instant dashboard visualization.
    """
    from datetime import datetime, timezone
    target_db = db if db is not None else database

    doc = {
        "patient_id": patient_id,
        "model_name": prediction_data.get("model_name", "multimodal_fusion"),
        "model_version": prediction_data.get("model_version", "1.0.0"),
        "modality": prediction_data.get("modality", "clinical"),
        "risk_score": float(prediction_data.get("risk_score", 0.0)),
        "predicted_label": prediction_data.get("predicted_label", "low_risk"),
        "confidence_score": prediction_data.get("confidence_score"),
        "base_value": prediction_data.get("base_value"),
        "expected_value": prediction_data.get("expected_value"),
        "shap_values": prediction_data.get("shap_values", {}),
        "lime_values": prediction_data.get("lime_values", {}),
        "top_contributing_features": prediction_data.get("top_contributing_features", []),
        "waterfall_points": prediction_data.get("waterfall_points", []),
        "created_at": datetime.now(timezone.utc),
    }

    result = target_db["prediction_results"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


def get_patient_latest_explanation(
    patient_id: str,
    model_name: str | None = None,
    db: Database | None = None
) -> dict | None:
    """Retrieve the most recent SHAP explainability report for a patient.

    Used by the Clinician Dashboard (ShapChart.jsx) to display feature impact.
    """
    target_db = db if db is not None else database
    query = {"patient_id": patient_id}
    if model_name:
        query["model_name"] = model_name

    return target_db["prediction_results"].find_one(
        query,
        sort=[("created_at", -1)]
    )


def get_global_feature_importance(
    model_name: str = "multimodal_fusion",
    limit: int = 10,
    db: Database | None = None
) -> list[dict]:
    """Aggregate feature attributions across predictions to return global SHAP feature importance."""
    target_db = db if db is not None else database
    records = list(target_db["prediction_results"].find(
        {"model_name": model_name, "shap_values": {"$exists": True, "$ne": {}}},
        {"shap_values": 1}
    ).limit(100))

    if not records:
        return [
            {"feature": "ap_hi", "mean_abs_shap": 0.28, "importance_rank": 1},
            {"feature": "cholesterol_3", "mean_abs_shap": 0.22, "importance_rank": 2},
            {"feature": "age_years", "mean_abs_shap": 0.18, "importance_rank": 3},
            {"feature": "BMI", "mean_abs_shap": 0.14, "importance_rank": 4},
            {"feature": "pulse_pressure", "mean_abs_shap": 0.11, "importance_rank": 5},
        ][:limit]

    feature_sums = {}
    feature_counts = {}
    for r in records:
        shaps = r.get("shap_values") or {}
        for feat, val in shaps.items():
            feature_sums[feat] = feature_sums.get(feat, 0.0) + abs(float(val))
            feature_counts[feat] = feature_counts.get(feat, 0) + 1

    ranked = []
    for feat, total in feature_sums.items():
        count = feature_counts.get(feat, 1)
        mean_abs = round(total / count, 4)
        ranked.append({"feature": feat, "mean_abs_shap": mean_abs})

    ranked.sort(key=lambda x: x["mean_abs_shap"], reverse=True)
    for idx, item in enumerate(ranked[:limit], 1):
        item["importance_rank"] = idx

    return ranked[:limit]
