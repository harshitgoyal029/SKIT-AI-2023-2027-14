"""
test_training_data.py

Unit tests for the Sprint 3 training data organization and feature extraction pipeline.
Tests compliance with Deepak's 16-parameter clinical input vector.
"""

import pytest
import numpy as np
from prepare_training_data import (
    FEATURE_NAMES,
    extract_clinical_features,
    prepare_training_dataset,
)


class TestClinicalFeatureExtraction:
    def test_feature_vector_length_is_sixteen(self):
        sample = {
            "gender": "Male",
            "height": 175.0,
            "weight": 75.0,
            "resting_bp": 120,
            "diastolic_bp": 80,
            "smoke": False,
            "alco": False,
            "active": True,
            "age": 52,
            "cholesterol": 1,
            "fasting_blood_sugar": False,
        }
        features = extract_clinical_features(sample)
        assert len(features) == 16
        assert len(features) == len(FEATURE_NAMES)

    def test_hemodynamic_derivations(self):
        sample = {
            "gender": "Female",
            "height": 160.0,
            "weight": 64.0,
            "ap_hi": 130.0,
            "ap_lo": 70.0,
            "age": 45,
            "cholesterol": 1,
        }
        features = extract_clinical_features(sample)
        
        # BMI = 64 / (1.6 ** 2) = 25.0
        bmi_idx = FEATURE_NAMES.index("BMI")
        assert round(features[bmi_idx], 1) == 25.0

        # Pulse pressure = 130 - 70 = 60
        pp_idx = FEATURE_NAMES.index("pulse_pressure")
        assert features[pp_idx] == 60.0

        # MAP = 70 + (60 / 3) = 90.0
        map_idx = FEATURE_NAMES.index("MAP")
        assert features[map_idx] == 90.0

    def test_categorical_one_hot_encoding(self):
        # Case 1: High cholesterol (level 3) and High glucose (level 3)
        sample_high = {
            "cholesterol": 3,
            "gluc": 3,
            "height": 170,
            "weight": 70,
            "resting_bp": 120,
        }
        feat_high = extract_clinical_features(sample_high)
        assert feat_high[FEATURE_NAMES.index("cholesterol_2")] == 0.0
        assert feat_high[FEATURE_NAMES.index("cholesterol_3")] == 1.0
        assert feat_high[FEATURE_NAMES.index("gluc_2")] == 0.0
        assert feat_high[FEATURE_NAMES.index("gluc_3")] == 1.0

        # Case 2: Above normal cholesterol (level 2)
        sample_mid = {
            "cholesterol": 2,
            "gluc": 2,
            "height": 170,
            "weight": 70,
            "resting_bp": 120,
        }
        feat_mid = extract_clinical_features(sample_mid)
        assert feat_mid[FEATURE_NAMES.index("cholesterol_2")] == 1.0
        assert feat_mid[FEATURE_NAMES.index("cholesterol_3")] == 0.0
        assert feat_mid[FEATURE_NAMES.index("gluc_2")] == 1.0
        assert feat_mid[FEATURE_NAMES.index("gluc_3")] == 0.0


class TestPrepareTrainingDataset:
    def test_batch_extraction_matrix_shape(self):
        records = [
            {"age": 45, "gender": "Male", "resting_bp": 120, "cholesterol": 1, "cardio": 0},
            {"age": 60, "gender": "Female", "resting_bp": 150, "cholesterol": 3, "cardio": 1},
            {"age": 55, "gender": "Male", "resting_bp": 135, "cholesterol": 2, "cardio": 1},
        ]
        X, y = prepare_training_dataset(records)
        assert X.shape == (3, 16)
        assert y.shape == (3,)
        assert list(y) == [0, 1, 1]

    def test_empty_dataset_returns_empty_arrays(self):
        X, y = prepare_training_dataset([])
        assert X.shape == (0, 16)
        assert y.shape == (0,)
