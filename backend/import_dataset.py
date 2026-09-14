"""Import sample rows from DataSets/clinical_dataset_clean.csv into the
`clinical_records` collection, mapped onto the ClinicalRecord schema.

IMPORTANT — schema mismatch note (still applies to the cleaned dataset):
This dataset does NOT contain chest_pain_type, resting_ecg, max_heart_rate,
or st_slope — those fields will be left as None for every imported row.
Flagged to the team on 2026-09-13; the 2026-09-14 cleaned CSV adds derived
columns (age_years, BMI, pulse_pressure, MAP) but does not add these four
missing fields.
"""

import csv

from database import get_db
from models import ClinicalRecord

DATASET_PATH = "../DataSets/clinical_dataset_clean.csv"
IMPORT_LIMIT = 20  # keep the demo dataset small and inspectable


def _map_row(row: dict, patient_id: str) -> ClinicalRecord:
    """Convert one cleaned-dataset row into a ClinicalRecord."""
    sex = "F" if row["gender"] == "1" else "M"  # source: 1=female, 2=male
    # source cholesterol is a 1/2/3 risk category, not mg/dl — cannot convert
    # losslessly, so the numeric `cholesterol` field is left unset here.
    return ClinicalRecord(
        patient_id=patient_id,
        age=round(float(row["age_years"])),
        sex=sex,
        resting_bp=int(row["ap_hi"]),
        fasting_blood_sugar=bool(int(row["gluc"]) > 1),
    )


def import_sample_rows() -> None:
    db = get_db()
    users = db["users"]
    clinical_records = db["clinical_records"]

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
            record = _map_row(row, patient_id)
            clinical_records.insert_one(record.model_dump(by_alias=True, exclude={"id"}))
            imported += 1

    print(f"Imported {imported} sample rows into clinical_records.")
    print("Note: chest_pain_type, resting_ecg, max_heart_rate, st_slope left "
          "unset — source dataset does not contain these fields.")


if __name__ == "__main__":
    import_sample_rows()
