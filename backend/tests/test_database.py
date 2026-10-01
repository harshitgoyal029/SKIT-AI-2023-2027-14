"""Unit tests for database.py's collection-level functions.

Uses mongomock (an in-memory MongoDB simulator) instead of a live Atlas
connection, so these tests run anywhere, in CI, with no network needed
and no risk of touching real data.

Covers get_patient_clinical_history() and get_collection_stats(), which
had no test coverage before — only the Pydantic schemas in models.py
were tested, not the actual query logic that runs against them.
"""

import mongomock
import pytest

import database as db_module


@pytest.fixture(autouse=True)
def mock_database(monkeypatch):
    """Replace the real MongoDB database handle with an in-memory mock
    for every test in this file, then restore it afterward."""
    mock_client = mongomock.MongoClient()
    mock_db = mock_client["cardioxai_test"]
    monkeypatch.setattr(db_module, "database", mock_db)
    return mock_db


class TestGetPatientClinicalHistory:
    def test_returns_records_newest_first(self, mock_database):
        patient_id = "patient-1"
        mock_database["clinical_records"].insert_many([
            {"patient_id": patient_id, "age": 50, "recorded_at": "2026-01-01"},
            {"patient_id": patient_id, "age": 51, "recorded_at": "2026-06-01"},
            {"patient_id": patient_id, "age": 52, "recorded_at": "2026-03-01"},
        ])

        history = db_module.get_patient_clinical_history(patient_id)

        # Sorted by recorded_at descending — June, then March, then January
        assert [r["age"] for r in history] == [51, 52, 50]

    def test_only_returns_matching_patient(self, mock_database):
        mock_database["clinical_records"].insert_many([
            {"patient_id": "patient-1", "age": 50, "recorded_at": "2026-01-01"},
            {"patient_id": "patient-2", "age": 60, "recorded_at": "2026-01-01"},
        ])

        history = db_module.get_patient_clinical_history("patient-1")

        assert len(history) == 1
        assert history[0]["age"] == 50

    def test_respects_limit(self, mock_database):
        patient_id = "patient-1"
        mock_database["clinical_records"].insert_many([
            {"patient_id": patient_id, "age": i, "recorded_at": f"2026-01-{i:02d}"}
            for i in range(1, 21)
        ])

        history = db_module.get_patient_clinical_history(patient_id, limit=5)

        assert len(history) == 5

    def test_no_records_returns_empty_list(self, mock_database):
        history = db_module.get_patient_clinical_history("nobody-here")
        assert history == []


class TestGetCollectionStats:
    def test_counts_documents_per_collection(self, mock_database):
        mock_database["users"].insert_many([{"email": "a@x.com"}, {"email": "b@x.com"}])
        mock_database["clinical_records"].insert_one({"patient_id": "p1"})

        stats = db_module.get_collection_stats()

        assert stats["users"] == 2
        assert stats["clinical_records"] == 1
        assert stats["prediction_results"] == 0  # empty but still present

    def test_all_expected_collections_present(self, mock_database):
        stats = db_module.get_collection_stats()

        expected_collections = {
            "users", "patient_profiles", "health_profiles",
            "medical_documents", "clinical_records", "ecg_recordings",
            "prediction_results",
        }
        assert set(stats.keys()) == expected_collections
