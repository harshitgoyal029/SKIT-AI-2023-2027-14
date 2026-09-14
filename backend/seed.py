"""
Seed script — populates the database with test data for local development.

Usage:
    cd backend
    python seed.py

Creates test users (all 4 roles) and sample clinical/ECG records.
Safe to run multiple times — skips data that already exists.
"""

from database import get_db, verify_connection
from models import ClinicalRecord, ECGRecording, User, UserRole
from security import hash_password


# ── Test Users ───────────────────────────────────────────────────

TEST_USERS = [
    ("System Administrator", "admin@cardioxai.org", "Admin@123", UserRole.admin),
    ("Dr. Aditi Sharma", "doctor@cardioxai.org", "Doctor@123", UserRole.doctor),
    ("Rohan Mehta", "patient@cardioxai.org", "Patient@123", UserRole.patient),
    ("Arjun Singh", "lab@cardioxai.org", "Lab@123", UserRole.lab_technician),
]


# ── Sample Clinical Records ─────────────────────────────────────

SAMPLE_CLINICAL_DATA = [
    {
        "age": 54, "sex": "M", "chest_pain_type": "ATA",
        "resting_bp": 130, "cholesterol": 246, "fasting_blood_sugar": False,
        "resting_ecg": "Normal", "max_heart_rate": 150,
        "exercise_angina": False, "st_depression": 0.8, "st_slope": "Up",
    },
    {
        "age": 54, "sex": "M", "chest_pain_type": "NAP",
        "resting_bp": 125, "cholesterol": 220, "fasting_blood_sugar": False,
        "resting_ecg": "Normal", "max_heart_rate": 155,
        "exercise_angina": False, "st_depression": 0.5, "st_slope": "Flat",
    },
]


def seed_users(db) -> None:
    """Create test user accounts if they don't already exist."""
    users = db["users"]

    for full_name, email, password, role in TEST_USERS:
        if users.find_one({"email": email}):
            print(f"  ⊘ Skipped (exists): {email}")
            continue

        user = User(
            full_name=full_name,
            email=email,
            password_hash=hash_password(password),
            role=role,
        )
        users.insert_one(user.model_dump(by_alias=True, exclude={"id"}))
        print(f"  ✓ Created: {email}  (password: {password})")


def seed_clinical_data(db) -> None:
    """Create sample clinical records for the test patient."""
    users = db["users"]
    clinical = db["clinical_records"]

    patient = users.find_one({"email": "patient@cardioxai.org"})
    if not patient:
        print("  ⊘ Patient user not found — run seed_users first.")
        return

    patient_id = str(patient["_id"])
    existing = clinical.count_documents({"patient_id": patient_id})
    if existing > 0:
        print(f"  ⊘ Skipped (already has {existing} records)")
        return

    for i, data in enumerate(SAMPLE_CLINICAL_DATA, 1):
        record = ClinicalRecord(patient_id=patient_id, **data)
        clinical.insert_one(record.model_dump(by_alias=True, exclude={"id"}))
        print(f"  ✓ Created clinical record #{i}")


def seed_ecg_metadata(db) -> None:
    """Create a sample ECG metadata entry (no actual file)."""
    users = db["users"]
    ecg = db["ecg_recordings"]

    patient = users.find_one({"email": "patient@cardioxai.org"})
    if not patient:
        print("  ⊘ Patient user not found — run seed_users first.")
        return

    patient_id = str(patient["_id"])
    if ecg.find_one({"patient_id": patient_id}):
        print("  ⊘ Skipped (ECG record already exists)")
        return

    recording = ECGRecording(
        patient_id=patient_id,
        original_name="sample_ecg_lead_II.csv",
        stored_name="sample_ecg_placeholder.csv",
        storage_path="uploads/ecg/sample_placeholder.csv",
        content_type="text/csv",
        size_bytes=0,
        sampling_rate_hz=500,
        lead_count=1,
        duration_seconds=10.0,
        processing_status="sample",
        processing_message="Placeholder entry for development — no actual file.",
    )
    ecg.insert_one(recording.model_dump(by_alias=True, exclude={"id"}))
    print("  ✓ Created sample ECG metadata entry")


def main() -> None:
    print("=" * 50)
    print("  CardioXAI — Database Seed Script")
    print("=" * 50)

    print("\n→ Verifying database connection...")
    verify_connection()
    print("  ✓ Connected\n")

    db = get_db()

    print("→ Seeding users...")
    seed_users(db)

    print("\n→ Seeding clinical records...")
    seed_clinical_data(db)

    print("\n→ Seeding ECG metadata...")
    seed_ecg_metadata(db)

    # Print summary
    print("\n" + "=" * 50)
    print("  Database Summary")
    print("=" * 50)
    for name in ["users", "clinical_records", "ecg_recordings"]:
        count = db[name].count_documents({})
        print(f"  {name}: {count} document(s)")
    print()


if __name__ == "__main__":
    main()
