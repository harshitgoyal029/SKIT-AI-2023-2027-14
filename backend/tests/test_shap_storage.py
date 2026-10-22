"""
test_shap_storage.py

Unit tests for Sprint 3 SHAP explainability storage and retrieval pipeline.
Validates MongoDB storage of local SHAP attributions, waterfall steps, and global ranking.
"""

import pytest
import mongomock
from database import (
    save_prediction_explanation,
    get_patient_latest_explanation,
    get_global_feature_importance,
)


@pytest.fixture
def mock_db():
    client = mongomock.MongoClient()
    return client["cardioxai_test"]


class TestSavePredictionExplanation:
    def test_save_valid_explanation(self, mock_db):
        exp_data = {
            "model_name": "multimodal_fusion",
            "modality": "multimodal_fusion",
            "risk_score": 0.82,
            "predicted_label": "high_risk",
            "confidence_score": 0.93,
            "base_value": 0.35,
            "shap_values": {"ap_hi": 0.25, "cholesterol_3": 0.18},
            "top_contributing_features": ["ap_hi", "cholesterol_3"],
            "waterfall_points": [
                {"feature": "Baseline", "contribution": 0.35},
                {"feature": "ap_hi", "contribution": 0.25},
            ],
        }

        doc = save_prediction_explanation("P-101", exp_data, db=mock_db)
        assert doc is not None
        assert doc["patient_id"] == "P-101"
        assert doc["risk_score"] == 0.82
        assert "_id" in doc

        # Verify in collection
        saved = mock_db["prediction_results"].find_one({"patient_id": "P-101"})
        assert saved is not None
        assert saved["shap_values"]["ap_hi"] == 0.25
        assert len(saved["waterfall_points"]) == 2


class TestGetPatientLatestExplanation:
    def test_fetches_newest_explanation_first(self, mock_db):
        from datetime import datetime, timezone, timedelta

        t1 = datetime.now(timezone.utc) - timedelta(days=2)
        t2 = datetime.now(timezone.utc)

        mock_db["prediction_results"].insert_one({
            "patient_id": "P-202",
            "model_name": "clinical_dnn",
            "risk_score": 0.40,
            "created_at": t1,
        })
        mock_db["prediction_results"].insert_one({
            "patient_id": "P-202",
            "model_name": "clinical_dnn",
            "risk_score": 0.75,
            "created_at": t2,
        })

        latest = get_patient_latest_explanation("P-202", db=mock_db)
        assert latest is not None
        assert latest["risk_score"] == 0.75

    def test_returns_none_for_missing_patient(self, mock_db):
        assert get_patient_latest_explanation("NONEXISTENT", db=mock_db) is None


class TestGlobalFeatureImportance:
    def test_computes_mean_absolute_shap(self, mock_db):
        mock_db["prediction_results"].insert_many([
            {
                "model_name": "fusion",
                "shap_values": {"ap_hi": 0.30, "cholesterol_3": 0.10, "BMI": -0.20},
            },
            {
                "model_name": "fusion",
                "shap_values": {"ap_hi": 0.20, "cholesterol_3": 0.20, "BMI": -0.10},
            },
        ])

        rankings = get_global_feature_importance("fusion", limit=3, db=mock_db)
        assert len(rankings) == 3
        # ap_hi average abs is (0.30 + 0.20)/2 = 0.25
        assert rankings[0]["feature"] == "ap_hi"
        assert rankings[0]["mean_abs_shap"] == 0.25
        assert rankings[0]["importance_rank"] == 1

    def test_fallback_when_collection_empty(self, mock_db):
        rankings = get_global_feature_importance("empty_model", limit=3, db=mock_db)
        assert len(rankings) == 3
        assert rankings[0]["importance_rank"] == 1
