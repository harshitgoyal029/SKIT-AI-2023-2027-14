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
