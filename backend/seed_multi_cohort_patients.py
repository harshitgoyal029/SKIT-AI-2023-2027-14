"""
seed_multi_cohort_patients.py

Sprint 3: Test with Sample Data (Jatin Khandelwal)
Populates diverse, realistic sample patient cohorts across all cardiovascular risk
tiers (Low, Moderate, High, Critical) with complete clinical vitals, 12-lead ECG
records, and explainable AI (SHAP) attributions in MongoDB.
"""

from typing import List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
from database import get_db, verify_connection, save_prediction_explanation
from models import Patient, ClinicalRecord, ECGRecording


SAMPLE_COHORTS: List[Dict[str, Any]] = [
    {
        "patientId": "CVD-2026-101",
        "mongo_id": "60c72b2f9b1d8b2bad000101",
        "name": "Ananya Sharma",
        "age": 34,
        "gender": "Female",
        "phone": "+91 98111 22334",
        "email": "ananya.sharma@example.com",
        "bloodPressure": "112/74",
        "cholesterol": 168,
        "heartRate": 68,
        "diabetes": "No",
        "smoking": "No",
        "familyHistory": "No",
        "height": 162.0,
        "weight": 56.0,
        "risk_score": 0.12,
        "riskLevel": "Low Risk",
        "top_contributing_features": ["age_years", "ap_hi", "cholesterol_3"],
        "shap_values": {
            "age_years": -0.15,
            "ap_hi": -0.10,
            "cholesterol_3": -0.08,
            "BMI": -0.05,
            "active": -0.04,
        },
        "waterfall_points": [
            {"step": 0, "feature": "Baseline (E[f(x)])", "contribution": 0.35, "running_score": 0.35},
            {"step": 1, "feature": "Young Age (34 yrs)", "contribution": -0.15, "running_score": 0.20},
            {"step": 2, "feature": "Optimal BP (112/74)", "contribution": -0.10, "running_score": 0.10},
            {"step": 3, "feature": "Normal Lipids (168)", "contribution": -0.08, "running_score": 0.02},
            {"step": 4, "feature": "Other Biomarkers", "contribution": +0.10, "running_score": 0.12},
        ],
    },
    {
        "patientId": "CVD-2026-102",
        "mongo_id": "60c72b2f9b1d8b2bad000102",
        "name": "Deepak Verma",
        "age": 48,
        "gender": "Male",
        "phone": "+91 98222 33445",
        "email": "deepak.verma@example.com",
        "bloodPressure": "134/86",
        "cholesterol": 215,
        "heartRate": 76,
        "diabetes": "No",
        "smoking": "Yes",
        "familyHistory": "No",
        "height": 172.0,
        "weight": 78.0,
        "risk_score": 0.48,
        "riskLevel": "Moderate Risk",
        "top_contributing_features": ["ap_hi", "smoke", "BMI", "cholesterol_2"],
        "shap_values": {
            "ap_hi": +0.09,
            "smoke": +0.07,
            "BMI": +0.05,
            "cholesterol_2": +0.04,
            "active": -0.03,
        },
        "waterfall_points": [
            {"step": 0, "feature": "Baseline (E[f(x)])", "contribution": 0.35, "running_score": 0.35},
            {"step": 1, "feature": "Pre-hypertension (134)", "contribution": +0.09, "running_score": 0.44},
            {"step": 2, "feature": "Tobacco Use", "contribution": +0.07, "running_score": 0.51},
            {"step": 3, "feature": "Physical Activity", "contribution": -0.03, "running_score": 0.48},
        ],
    },
    {
        "patientId": "CVD-2026-103",
        "mongo_id": "60c72b2f9b1d8b2bad000103",
        "name": "Meera Nambiar",
        "age": 66,
        "gender": "Female",
        "phone": "+91 98333 44556",
        "email": "meera.nambiar@example.com",
        "bloodPressure": "152/94",
        "cholesterol": 258,
        "heartRate": 82,
        "diabetes": "Yes",
        "smoking": "No",
        "familyHistory": "Yes",
        "height": 158.0,
        "weight": 74.0,
        "risk_score": 0.81,
        "riskLevel": "High Risk",
        "top_contributing_features": ["ap_hi", "cholesterol_3", "age_years", "diabetes"],
        "shap_values": {
            "ap_hi": +0.21,
            "cholesterol_3": +0.16,
            "age_years": +0.12,
            "diabetes": +0.08,
            "BMI": +0.05,
        },
        "waterfall_points": [
            {"step": 0, "feature": "Baseline (E[f(x)])", "contribution": 0.35, "running_score": 0.35},
            {"step": 1, "feature": "Stage 2 Hypertension (152)", "contribution": +0.21, "running_score": 0.56},
            {"step": 2, "feature": "High Cholesterol (258)", "contribution": +0.16, "running_score": 0.72},
            {"step": 3, "feature": "Advanced Age (66 yrs)", "contribution": +0.12, "running_score": 0.84},
            {"step": 4, "feature": "Metabolic Status", "contribution": -0.03, "running_score": 0.81},
        ],
    },
    {
        "patientId": "CVD-2026-104",
        "mongo_id": "60c72b2f9b1d8b2bad000104",
        "name": "Harish Chandra",
        "age": 71,
        "gender": "Male",
        "phone": "+91 98444 55667",
        "email": "harish.chandra@example.com",
        "bloodPressure": "168/102",
        "cholesterol": 284,
        "heartRate": 92,
        "diabetes": "Yes",
        "smoking": "Yes",
        "familyHistory": "Yes",
        "height": 168.0,
        "weight": 86.0,
        "risk_score": 0.94,
        "riskLevel": "Critical Risk",
        "top_contributing_features": ["ap_hi", "cholesterol_3", "age_years", "pulse_pressure"],
        "shap_values": {
            "ap_hi": +0.26,
            "cholesterol_3": +0.20,
            "age_years": +0.15,
            "pulse_pressure": +0.11,
            "smoke": +0.06,
        },
        "waterfall_points": [
            {"step": 0, "feature": "Baseline (E[f(x)])", "contribution": 0.35, "running_score": 0.35},
            {"step": 1, "feature": "Severe Systolic BP (168)", "contribution": +0.26, "running_score": 0.61},
            {"step": 2, "feature": "Hypercholesterolemia (284)", "contribution": +0.20, "running_score": 0.81},
            {"step": 3, "feature": "Widened Pulse Pressure", "contribution": +0.11, "running_score": 0.92},
            {"step": 4, "feature": "Other Combined Risks", "contribution": +0.02, "running_score": 0.94},
        ],
    },
]


def seed_multi_cohorts(db) -> Dict[str, int]:
    """Insert patient profiles, clinical records, and SHAP prediction results."""
    patient_col = db["patients"]
    clinical_col = db["clinical_records"]
    ecg_col = db["ecg_recordings"]

    counts = {"patients": 0, "clinical": 0, "ecg": 0, "predictions": 0}

    for data in SAMPLE_COHORTS:
        pid = data["patientId"]
        mongo_oid = ObjectId(data["mongo_id"])
        
        # 1. Patient profile
        if not patient_col.find_one({"patientId": pid}):
            patient_doc = {
                "_id": mongo_oid,
                "patientId": pid,
                "name": data["name"],
                "age": data["age"],
                "gender": data["gender"],
                "phone": data.get("phone"),
                "email": data.get("email"),
                "bloodPressure": data.get("bloodPressure"),
                "cholesterol": data.get("cholesterol"),
                "heartRate": data.get("heartRate"),
                "diabetes": data.get("diabetes"),
                "smoking": data.get("smoking"),
                "familyHistory": data.get("familyHistory"),
                "risk_score": data.get("risk_score"),
                "riskLevel": data.get("riskLevel"),
                "top_contributing_features": data.get("top_contributing_features"),
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc),
            }
            patient_col.insert_one(patient_doc)
            counts["patients"] += 1
            print(f"  [OK] Inserted patient profile: {pid} ({data['name']})")
        else:
            print(f"  [SKIP] Patient already exists: {pid}")

        # 2. Tabular clinical record
        if not clinical_col.find_one({"patient_id": mongo_oid}):
            sys_bp = int(data["bloodPressure"].split("/")[0])
            record = ClinicalRecord(
                patient_id=mongo_oid,
                age=data["age"],
                sex="M" if data["gender"] == "Male" else "F",
                resting_bp=sys_bp,
                cholesterol=int(data["cholesterol"]),
                fasting_blood_sugar=(data["diabetes"] == "Yes"),
                max_heart_rate=int(data["heartRate"]),
                exercise_angina=(data["risk_score"] > 0.6),
            )
            clinical_col.insert_one(record.model_dump(by_alias=True, exclude={"id"}))
            counts["clinical"] += 1

        # 3. 12-lead ECG recording metadata
        if not ecg_col.find_one({"patient_id": mongo_oid}):
            ecg = ECGRecording(
                patient_id=mongo_oid,
                original_name=f"{pid}_12lead_resting.csv",
                stored_name=f"ecg_{pid.lower().replace('-', '_')}.csv",
                storage_path=f"uploads/ecg/{pid.lower()}_resting.csv",
                content_type="text/csv",
                size_bytes=120000,
                sampling_rate_hz=500,
                lead_count=12,
                duration_seconds=10.0,
                processing_status="processed",
                processing_message="Validated 12-lead ECG recording ready for feature extraction",
            )
            ecg_col.insert_one(ecg.model_dump(by_alias=True, exclude={"id"}))
            counts["ecg"] += 1

        # 4. SHAP prediction result
        pred_payload = {
            "model_name": "multimodal_fusion",
            "model_version": "1.0.0",
            "modality": "multimodal_fusion",
            "risk_score": data["risk_score"],
            "predicted_label": "high_risk" if data["risk_score"] >= 0.5 else "low_risk",
            "confidence_score": round(0.85 + (abs(data["risk_score"] - 0.5) * 0.2), 2),
            "base_value": 0.35,
            "shap_values": data["shap_values"],
            "top_contributing_features": data["top_contributing_features"],
            "waterfall_points": data["waterfall_points"],
        }
        save_prediction_explanation(pid, pred_payload, db=db)
        counts["predictions"] += 1

    return counts


def main():
    print("=" * 65)
    print("  CardioXAI — Multi-Cohort Sample Data Seeder")
    print("  Sprint 3: Test with Sample Data (Jatin Khandelwal)")
    print("=" * 65)

    verify_connection()
    db = get_db()
    counts = seed_multi_cohorts(db)
    print("\n[SUMMARY] Data Ingestion Complete:")
    print(f"  Patients Created:     {counts['patients']}")
    print(f"  Clinical Records:     {counts['clinical']}")
    print(f"  12-Lead ECG Records:  {counts['ecg']}")
    print(f"  XAI Predictions:      {counts['predictions']}")


if __name__ == "__main__":
    main()
