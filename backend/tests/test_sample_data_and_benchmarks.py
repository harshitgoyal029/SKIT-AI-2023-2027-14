"""
test_sample_data_and_benchmarks.py

Unit tests for Sprint 3 sample data validation, multi-cohort seeding, and data integrity checks.
"""

import pytest
import mongomock
from seed_multi_cohort_patients import seed_multi_cohorts, SAMPLE_COHORTS
from validate_sample_data_integrity import run_integrity_audit


@pytest.fixture
def mock_db():
    client = mongomock.MongoClient()
    return client["cardioxai_test"]


class TestSampleDataSeeding:
    def test_seeds_all_four_sample_cohorts(self, mock_db):
        counts = seed_multi_cohorts(mock_db)
        assert counts["patients"] == 4
        assert counts["clinical"] == 4
        assert counts["ecg"] == 4
        assert counts["predictions"] == 4

        # Verify documents in collection
        assert mock_db["patients"].count_documents({}) == 4
        assert mock_db["clinical_records"].count_documents({}) == 4
        assert mock_db["ecg_recordings"].count_documents({}) == 4
        assert mock_db["prediction_results"].count_documents({}) == 4

    def test_idempotent_seeding_skips_duplicates(self, mock_db):
        # Run first time
        seed_multi_cohorts(mock_db)
        # Run second time
        counts_repeat = seed_multi_cohorts(mock_db)
        assert counts_repeat["patients"] == 0
        assert mock_db["patients"].count_documents({}) == 4

    def test_risk_level_spread(self, mock_db):
        seed_multi_cohorts(mock_db)
        levels = [p["riskLevel"] for p in mock_db["patients"].find()]
        assert "Low Risk" in levels
        assert "Moderate Risk" in levels
        assert "High Risk" in levels
        assert "Critical Risk" in levels

    def test_waterfall_points_populated(self, mock_db):
        seed_multi_cohorts(mock_db)
        high_risk_pred = mock_db["prediction_results"].find_one({"patient_id": "CVD-2026-104"})
        assert high_risk_pred is not None
        assert high_risk_pred["risk_score"] == 0.94
        assert len(high_risk_pred["waterfall_points"]) >= 4
        assert "ap_hi" in high_risk_pred["shap_values"]
