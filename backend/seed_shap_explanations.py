"""
seed_shap_explanations.py

Sprint 3: SHAP Storage Setup (Jatin Khandelwal)
Seeds realistic Explainable AI (SHAP & LIME) prediction results into the
MongoDB `prediction_results` collection for registered clinical patients.
Enables clinician dashboard (ShapChart.jsx) and printable PDF reports to
instantly render waterfall and feature attribution charts.
"""

from typing import Any, Dict, List
from datetime import datetime, timezone
from database import get_db, verify_connection, save_prediction_explanation


SAMPLE_SHAP_EXPLANATIONS: List[Dict[str, Any]] = [
    {
        "patient_id": "CVD-2026-001",
        "model_name": "multimodal_fusion",
        "model_version": "1.0.0",
        "modality": "multimodal_fusion",
        "risk_score": 0.78,
        "predicted_label": "high_risk",
        "confidence_score": 0.91,
        "base_value": 0.35,
        "expected_value": 0.35,
        "shap_values": {
            "ap_hi": +0.22,
            "cholesterol_3": +0.14,
            "age_years": +0.09,
            "BMI": +0.06,
            "active": -0.05,
            "smoke": +0.03,
            "MAP": +0.02,
        },
        "top_contributing_features": ["ap_hi", "cholesterol_3", "age_years", "BMI"],
        "waterfall_points": [
            {"step": 0, "feature": "Baseline (E[f(x)])", "contribution": 0.35, "running_score": 0.35},
            {"step": 1, "feature": "Systolic BP (+22 mmHg)", "contribution": +0.22, "running_score": 0.57},
            {"step": 2, "feature": "High Cholesterol (Cat 3)", "contribution": +0.14, "running_score": 0.71},
            {"step": 3, "feature": "Age (58 yrs)", "contribution": +0.09, "running_score": 0.80},
            {"step": 4, "feature": "Physical Activity", "contribution": -0.05, "running_score": 0.75},
            {"step": 5, "feature": "Other Biomarkers", "contribution": +0.03, "running_score": 0.78},
        ],
    },
    {
        "patient_id": "CVD-2026-002",
        "model_name": "multimodal_fusion",
        "model_version": "1.0.0",
        "modality": "multimodal_fusion",
        "risk_score": 0.22,
        "predicted_label": "low_risk",
        "confidence_score": 0.88,
        "base_value": 0.35,
        "expected_value": 0.35,
        "shap_values": {
            "ap_hi": -0.08,
            "cholesterol_3": -0.06,
            "age_years": -0.04,
            "active": -0.03,
            "BMI": +0.05,
        },
        "top_contributing_features": ["ap_hi", "cholesterol_3", "active"],
        "waterfall_points": [
            {"step": 0, "feature": "Baseline (E[f(x)])", "contribution": 0.35, "running_score": 0.35},
            {"step": 1, "feature": "Normal Systolic BP (118)", "contribution": -0.08, "running_score": 0.27},
            {"step": 2, "feature": "Normal Cholesterol", "contribution": -0.06, "running_score": 0.21},
            {"step": 3, "feature": "Younger Age (46 yrs)", "contribution": -0.04, "running_score": 0.17},
            {"step": 4, "feature": "Elevated BMI", "contribution": +0.05, "running_score": 0.22},
        ],
    },
    {
        "patient_id": "CVD-2026-003",
        "model_name": "multimodal_fusion",
        "model_version": "1.0.0",
        "modality": "multimodal_fusion",
        "risk_score": 0.89,
        "predicted_label": "high_risk",
        "confidence_score": 0.94,
        "base_value": 0.35,
        "expected_value": 0.35,
        "shap_values": {
            "ap_hi": +0.25,
            "cholesterol_3": +0.18,
            "pulse_pressure": +0.10,
            "age_years": +0.08,
            "smoke": +0.04,
            "active": -0.11,
        },
        "top_contributing_features": ["ap_hi", "cholesterol_3", "pulse_pressure", "age_years"],
        "waterfall_points": [
            {"step": 0, "feature": "Baseline (E[f(x)])", "contribution": 0.35, "running_score": 0.35},
            {"step": 1, "feature": "Severe Systolic BP (158)", "contribution": +0.25, "running_score": 0.60},
            {"step": 2, "feature": "High Cholesterol (275)", "contribution": +0.18, "running_score": 0.78},
            {"step": 3, "feature": "Pulse Pressure (60 mmHg)", "contribution": +0.10, "running_score": 0.88},
            {"step": 4, "feature": "Other Clinical Factors", "contribution": +0.01, "running_score": 0.89},
        ],
    },
]


def seed_shap_records(db) -> int:
    """Populate realistic SHAP explanation documents in MongoDB."""
    col = db["prediction_results"]
    seeded_count = 0
    for exp in SAMPLE_SHAP_EXPLANATIONS:
        pid = exp["patient_id"]
        # Skip if explanation already exists for patient
        if col.find_one({"patient_id": pid, "model_name": exp["model_name"]}):
            print(f"  [SKIP] Explanation already exists for patient: {pid}")
            continue

        save_prediction_explanation(pid, exp, db=db)
        print(f"  [OK] Saved SHAP explanation for patient: {pid} (Risk: {exp['risk_score']:.2f})")
        seeded_count += 1

    return seeded_count


def main():
    print("=" * 60)
    print("  CardioXAI — SHAP Explanation Storage Seeder (Sprint 3)")
    print("  Database Integration: Jatin Khandelwal")
    print("=" * 60)

    try:
        verify_connection()
        db = get_db()
        count = seed_shap_records(db)
        print(f"\n[DONE] Successfully seeded {count} new SHAP explainability records.")
    except Exception as exc:
        print(f"[ERROR] Database connection or seeding failed: {exc}")


if __name__ == "__main__":
    main()
