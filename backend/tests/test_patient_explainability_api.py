"""
test_patient_explainability_api.py

Unit tests for the live patient SHAP explainability API endpoints.
Validates function responses, schema formats matching ShapChart.jsx, and error handling.
"""

import pytest
import mongomock
from fastapi import HTTPException
from patient_api import get_patient_explainability, get_global_shap_importance_api


@pytest.fixture
def mock_db():
    db = mongomock.MongoClient()["cardioxai_test"]

    # Seed mock patient
    db["patients"].insert_one({
        "patientId": "CVD-TEST-99",
        "name": "Ramesh Kumar",
        "age": 52,
        "gender": "Male",
        "risk_score": 0.72,
        "riskLevel": "High Risk",
        "feature_contributions": {
            "ap_hi": 0.24,
            "cholesterol_3": 0.16,
            "active": -0.06,
        },
        "top_contributing_features": ["ap_hi", "cholesterol_3"],
    })

    # Seed mock prediction result
    db["prediction_results"].insert_one({
        "patient_id": "CVD-TEST-99",
        "model_name": "multimodal_fusion",
        "risk_score": 0.72,
        "base_value": 0.35,
        "shap_values": {
            "ap_hi": 0.24,
            "cholesterol_3": 0.16,
            "active": -0.06,
        },
        "waterfall_points": [
            {"step": 0, "feature": "Baseline", "contribution": 0.35},
            {"step": 1, "feature": "ap_hi", "contribution": 0.24},
        ],
    })

    return db


class TestPatientExplainabilityApi:
    def test_get_explainability_success(self, mock_db):
        data = get_patient_explainability("CVD-TEST-99", db=mock_db)

        assert data["patientId"] == "CVD-TEST-99"
        assert data["method"] == "SHAP"
        assert "features" in data
        assert len(data["features"]) == 3

        # Check ShapChart.jsx compatible format
        top_feat = data["features"][0]
        assert "feature" in top_feat
        assert "contribution" in top_feat
        assert "direction" in top_feat
        assert "signedValue" in top_feat
        assert top_feat["direction"] == "Positive impact"
        assert top_feat["signedValue"] > 0

    def test_get_explainability_not_found(self, mock_db):
        with pytest.raises(HTTPException) as exc_info:
            get_patient_explainability("NONEXISTENT-ID", db=mock_db)
        assert exc_info.value.status_code == 404

    def test_get_global_importance_api(self, mock_db):
        data = get_global_shap_importance_api("multimodal_fusion", limit=5, db=mock_db)

        assert "features" in data
        assert len(data["features"]) > 0
        assert data["features"][0]["importance_rank"] == 1
        assert data["model_name"] == "multimodal_fusion"
