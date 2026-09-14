"""Create sample clinical and ECG records for the seeded patient, for local testing
of the ClinicalRecord / ECGRecording document schemas."""

from database import get_db
from models import ClinicalRecord, ECGRecording


def seed_clinical_data() -> None:
    db = get_db()
    users = db["users"]
    clinical_records = db["clinical_records"]
    ecg_recordings = db["ecg_recordings"]

    patient = users.find_one({"email": "patient@cardioxai.org"})
    if not patient:
        print("Patient user not found — run seed_users.py first.")
        return

    patient_id = str(patient["_id"])

    if not clinical_records.find_one({"patient_id": patient_id}):
        record = ClinicalRecord(
            patient_id=patient_id, age=54, resting_bp=130, cholesterol=246,
            fasting_blood_sugar=False, max_heart_rate=150, exercise_angina=False,
        )
        clinical_records.insert_one(record.model_dump(by_alias=True, exclude={"id"}))
        print("Created sample ClinicalRecord")
    else:
        print("Skipped existing ClinicalRecord")

    if not ecg_recordings.find_one({"patient_id": patient_id}):
        ecg = ECGRecording(
            patient_id=patient_id, sampling_rate_hz=500, lead_count=1,
            duration_seconds=10.0, signal_storage_path="uploads/ecg/sample_patient_001.csv",
        )
        ecg_recordings.insert_one(ecg.model_dump(by_alias=True, exclude={"id"}))
        print("Created sample ECGRecording")
    else:
        print("Skipped existing ECGRecording")


if __name__ == "__main__":
    seed_clinical_data()
