"""Import real ECG metadata from DataSets/ecg_metadata.csv into the
`ecg_recordings` collection.

Gap this fixes: seed.py's seed_ecg_metadata() only creates one fake
sample record. The actual Ningbo ECG dataset (34,905 real records,
used to train the CNN-BiLSTM model) was never imported anywhere.

Note: record_path in the source CSV is a local Windows path on the
original author's machine (raw signal files aren't in the repo — see
.gitignore's "Ignore raw Ningbo ECG dataset" entry), so storage_path
here stores that original path for traceability, not an accessible
file location. This script imports metadata only, not signal files.
"""

import csv

from database import get_db
from models import ECGRecording

DATASET_PATH = "../DataSets/ecg_metadata.csv"
IMPORT_LIMIT = 20  # keep the demo dataset small and inspectable


def _map_row(row: dict, patient_id: str) -> ECGRecording:
    sampling_rate = int(row["sampling_frequency"])
    num_samples = int(row["num_samples"])
    return ECGRecording(
        patient_id=patient_id,
        original_name=row["record_path"].split("\\")[-1],
        stored_name=row["record_path"].split("\\")[-1] + ".dat",
        storage_path=row["record_path"],
        size_bytes=num_samples * int(row["num_leads"]) * 2,  # 16-bit samples
        sampling_rate_hz=sampling_rate,
        lead_count=int(row["num_leads"]),
        duration_seconds=round(num_samples / sampling_rate, 2),
        processing_status="imported",
        processing_message=f"label={row['label']}, diagnosis_codes={row['diagnosis_codes']}",
    )


def import_sample_rows() -> None:
    db = get_db()
    users = db["users"]
    ecg_recordings = db["ecg_recordings"]

    patient = users.find_one({"email": "patient@cardioxai.org"})
    if not patient:
        print("Patient user not found — run seed_users.py first.")
        return
    patient_id = str(patient["_id"])

    imported = 0
    with open(DATASET_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if imported >= IMPORT_LIMIT:
                break
            # Duplicate stored_name has a unique index — skip rather than crash.
            existing = ecg_recordings.find_one({"stored_name": row["record_path"].split("\\")[-1] + ".dat"})
            if existing:
                continue
            record = _map_row(row, patient_id)
            ecg_recordings.insert_one(record.model_dump(by_alias=True, exclude={"id"}))
            imported += 1

    print(f"Imported {imported} real ECG metadata records into ecg_recordings.")
    print("Note: metadata only — raw signal files are not in the repo (see .gitignore).")


if __name__ == "__main__":
    import_sample_rows()
