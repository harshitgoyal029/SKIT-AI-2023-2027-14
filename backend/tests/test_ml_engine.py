"""Unit tests for ML engine and prediction pipeline (ml_engine.py and predict.py).

Verifies feature engineering, model weight loading, forward pass inference,
prediction output schema, and consistency. Runs standalone without a live database.
"""

import numpy as np
import pytest
from pydantic import ValidationError

from ml_engine import ClinicalDNN, clinical_model, prepare_features, EXPECTED_FEATURES
from predict import ClinicalPredictionInput

pytestmark = [
    pytest.mark.filterwarnings("ignore::sklearn.exceptions.InconsistentVersionWarning"),
    pytest.mark.filterwarnings("ignore:.*valid feature names.*:UserWarning"),
]


@pytest.fixture(scope="module")
def loaded_model():
    """Load model once for test module."""
    if not clinical_model.is_loaded:
        clinical_model.load()
    return clinical_model


class TestFeatureEngineering:
    def test_prepare_features_shape_and_order(self):
        sample = {
            "gender": 1,
            "height": 175.0,
            "weight": 70.0,
            "ap_hi": 120,
            "ap_lo": 80,
            "cholesterol": 1,
            "gluc": 1,
            "smoke": 0,
            "alco": 0,
            "active": 1,
            "age_years": 50.0,
        }
        vector = prepare_features(sample)
        assert isinstance(vector, np.ndarray)
        assert vector.shape == (16,)

        # Check raw features match
        assert vector[0] == 1.0  # gender
        assert vector[1] == 175.0  # height
        assert vector[2] == 70.0  # weight
        assert vector[3] == 120.0  # ap_hi
        assert vector[4] == 80.0  # ap_lo
        assert vector[5] == 0.0  # smoke
        assert vector[6] == 0.0  # alco
        assert vector[7] == 1.0  # active
        assert vector[8] == 50.0  # age_years

    def test_derived_features_calculation(self):
        sample = {
            "gender": 0,
            "height": 160.0,
            "weight": 64.0,
            "ap_hi": 130,
            "ap_lo": 85,
            "cholesterol": 2,
            "gluc": 3,
            "smoke": 1,
            "alco": 0,
            "active": 0,
            "age_years": 55.0,
        }
        vector = prepare_features(sample)

        # BMI = 64 / (1.6 * 1.6) = 25.0
        expected_bmi = 64.0 / (1.6 ** 2)
        assert np.isclose(vector[9], expected_bmi)

        # pulse_pressure = 130 - 85 = 45
        assert vector[10] == 45.0

        # MAP = (130 + 2 * 85) / 3 = 100.0
        assert np.isclose(vector[11], 100.0)

        # cholesterol=2 -> cholesterol_2=1, cholesterol_3=0
        assert vector[12] == 1.0
        assert vector[13] == 0.0

        # gluc=3 -> gluc_2=0, gluc_3=1
        assert vector[14] == 0.0
        assert vector[15] == 1.0

    def test_one_hot_encoding_baseline(self):
        sample = {
            "gender": 1,
            "height": 170.0,
            "weight": 70.0,
            "ap_hi": 120,
            "ap_lo": 80,
            "cholesterol": 1,
            "gluc": 1,
            "smoke": 0,
            "alco": 0,
            "active": 1,
            "age_years": 40.0,
        }
        vector = prepare_features(sample)
        # Category 1 is baseline (drop_first=True)
        assert vector[12] == 0.0  # cholesterol_2
        assert vector[13] == 0.0  # cholesterol_3
        assert vector[14] == 0.0  # gluc_2
        assert vector[15] == 0.0  # gluc_3


class TestClinicalDNNModel:
    def test_model_loaded(self, loaded_model):
        assert loaded_model.is_loaded
        assert len(loaded_model.weights) == 4
        assert loaded_model.feature_names == EXPECTED_FEATURES

    def test_layer_shapes(self, loaded_model):
        w0, b0 = loaded_model.weights[0]
        w1, b1 = loaded_model.weights[1]
        w2, b2 = loaded_model.weights[2]
        w3, b3 = loaded_model.weights[3]

        assert w0.shape == (16, 64) and b0.shape == (64,)
        assert w1.shape == (64, 32) and b1.shape == (32,)
        assert w2.shape == (32, 16) and b2.shape == (16,)
        assert w3.shape == (16, 1) and b3.shape == (1,)

    def test_prediction_output_structure(self, loaded_model):
        sample = {
            "gender": 1,
            "height": 175.0,
            "weight": 75.0,
            "ap_hi": 120,
            "ap_lo": 80,
            "cholesterol": 1,
            "gluc": 1,
            "smoke": 0,
            "alco": 0,
            "active": 1,
            "age_years": 45.0,
        }
        result = loaded_model.predict(sample)

        assert "risk_score" in result
        assert "predicted_label" in result
        assert "risk_level" in result
        assert "feature_contributions" in result

        assert 0.0 <= result["risk_score"] <= 1.0
        assert result["predicted_label"] in ["low_risk", "high_risk"]
        assert result["risk_level"] in ["Low Risk", "Moderate Risk", "High Risk", "Very High Risk"]

        contributions = result["feature_contributions"]
        assert len(contributions) == 16
        total_importance = sum(c["importance"] for c in contributions)
        assert np.isclose(total_importance, 100.0, atol=0.5)

    def test_prediction_deterministic(self, loaded_model):
        sample = {
            "gender": 0,
            "height": 165.0,
            "weight": 60.0,
            "ap_hi": 115,
            "ap_lo": 75,
            "cholesterol": 1,
            "gluc": 1,
            "smoke": 0,
            "alco": 0,
            "active": 1,
            "age_years": 30.0,
        }
        r1 = loaded_model.predict(sample)
        r2 = loaded_model.predict(sample)
        assert r1["risk_score"] == r2["risk_score"]
        assert r1["predicted_label"] == r2["predicted_label"]

    def test_risk_gradient(self, loaded_model):
        """A healthy individual should have lower risk than an individual with multiple CVD risk factors."""
        low_risk_patient = {
            "gender": 0,
            "height": 168.0,
            "weight": 58.0,
            "ap_hi": 110,
            "ap_lo": 70,
            "cholesterol": 1,
            "gluc": 1,
            "smoke": 0,
            "alco": 0,
            "active": 1,
            "age_years": 25.0,
        }
        high_risk_patient = {
            "gender": 1,
            "height": 170.0,
            "weight": 110.0,
            "ap_hi": 170,
            "ap_lo": 110,
            "cholesterol": 3,
            "gluc": 3,
            "smoke": 1,
            "alco": 1,
            "active": 0,
            "age_years": 62.0,
        }
        low_res = loaded_model.predict(low_risk_patient)
        high_res = loaded_model.predict(high_risk_patient)

        assert low_res["risk_score"] < high_res["risk_score"]
        assert high_res["predicted_label"] == "high_risk"


class TestPredictionInputValidation:
    def test_valid_input_passes(self):
        input_data = ClinicalPredictionInput(
            gender=1,
            height=175.0,
            weight=80.0,
            ap_hi=125,
            ap_lo=82,
            cholesterol=1,
            gluc=1,
            smoke=0,
            alco=0,
            active=1,
            age_years=48.0,
        )
        assert input_data.height == 175.0
        assert input_data.ap_hi == 125

    def test_invalid_cholesterol_rejected(self):
        with pytest.raises(ValidationError):
            ClinicalPredictionInput(
                gender=1, height=175, weight=80, ap_hi=120, ap_lo=80,
                cholesterol=4, gluc=1, smoke=0, alco=0, active=1, age_years=48,
            )

    def test_invalid_negative_age_rejected(self):
        with pytest.raises(ValidationError):
            ClinicalPredictionInput(
                gender=1, height=175, weight=80, ap_hi=120, ap_lo=80,
                cholesterol=1, gluc=1, smoke=0, alco=0, active=1, age_years=-5,
            )
