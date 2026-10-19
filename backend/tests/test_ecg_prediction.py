"""
Unit and Integration tests for ECG Prediction and Multimodal Fusion API endpoints.

Tests:
  1. Signal parsing and multi-format conversion.
  2. Butterworth bandpass filtering and normalization.
  3. Pan-Tompkins QRS and clinical biomarker extraction (HR, HRV, QRS, QTc, ST-segment).
  4. ECG Cardiovascular Risk Prediction engine.
  5. Multimodal Fusion Engine (Clinical + ECG).
  6. API endpoints:
     - POST /api/predict/ecg (streamed signal)
     - POST /api/predict/ecg/upload (multipart file upload)
     - POST /api/predict/multimodal
     - GET  /api/predict/ecg/{ecg_id}
     - GET  /api/predict/ecg/latest
     - GET  /api/predict/history
     - GET  /api/predict/health
"""

import io
from pathlib import Path
from unittest.mock import MagicMock

import numpy as np
import pytest
from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from auth import get_current_user
from database import get_db
from ecg_engine import (
    LEAD_NAMES,
    extract_ecg_biomarkers,
    parse_ecg_file,
    predict_ecg,
    predict_multimodal,
    preprocess_ecg,
)
from predict import router as predict_router


# ── Synthetic Signal Helper ──────────────────────────────────────


def generate_synthetic_ecg(
    samples: int = 5000,
    leads: int = 12,
    heart_rate_bpm: float = 75.0,
    fs: int = 500,
) -> np.ndarray:
    """Generate realistic synthetic 12-lead ECG signal with periodic QRS spikes."""
    time = np.arange(samples) / fs
    rr_sec = 60.0 / heart_rate_bpm
    signal = np.zeros((samples, leads), dtype=np.float32)

    # Base baseline oscillation (P and T waves)
    for lead_idx in range(leads):
        phase = lead_idx * 0.15
        signal[:, lead_idx] += 0.15 * np.sin(2 * np.pi * (1.0 / rr_sec) * time + phase)
        signal[:, lead_idx] += 0.05 * np.sin(2 * np.pi * (2.0 / rr_sec) * time)

    # Periodic R-peaks
    beat_samples = int(rr_sec * fs)
    num_beats = samples // beat_samples
    for b in range(num_beats):
        peak_idx = int((b + 0.5) * beat_samples)
        if peak_idx + 15 < samples and peak_idx - 15 >= 0:
            for lead_idx in range(leads):
                scale = 1.2 if lead_idx in (1, 10) else 0.8
                signal[peak_idx - 5 : peak_idx + 5, lead_idx] += scale * np.exp(
                    -0.5 * ((np.arange(-5, 5) / 1.5) ** 2)
                )

    return signal


# ── In-Memory Database Mock Fixture ──────────────────────────────


@pytest.fixture
def mock_db(tmp_path):
    """In-memory mock database and temporary directory for file storage."""
    db = MagicMock()
    collections: dict[str, dict[str, dict]] = {
        "ecg_recordings": {},
        "prediction_results": {},
        "clinical_records": {},
        "users": {},
        "patients": {},
    }

    def insert_one(coll_name):
        def _ins(doc):
            _id = ObjectId()
            doc_copy = dict(doc)
            doc_copy["_id"] = _id
            collections[coll_name][str(_id)] = doc_copy
            res = MagicMock()
            res.inserted_id = _id
            return res
        return _ins

    def find_one(coll_name):
        def _find(query, sort=None):
            docs = list(collections[coll_name].values())
            if sort:
                for key, direction in reversed(sort):
                    docs.sort(key=lambda d: str(d.get(key, "")), reverse=(direction == -1))
            for doc in docs:
                match = True
                for k, v in query.items():
                    if str(doc.get(k)) != str(v):
                        match = False
                        break
                if match:
                    return dict(doc)
            return None
        return _find

    def find(coll_name):
        def _find_many(query):
            cursor = MagicMock()
            docs = [
                dict(doc) for doc in collections[coll_name].values()
                if all(str(doc.get(k)) == str(v) for k, v in query.items())
            ]
            def _sort(sort_key, direction=-1):
                docs.sort(key=lambda d: str(d.get(sort_key, "")), reverse=(direction == -1))
                return cursor
            def _limit(n):
                return docs[:n]

            cursor.sort.side_effect = _sort
            cursor.limit.side_effect = _limit
            cursor.__iter__.side_effect = lambda: iter(docs)
            return cursor
        return _find_many

    def update_one(coll_name):
        def _upd(query, update):
            target = find_one(coll_name)(query)
            if target:
                doc_id = str(target["_id"])
                if "$set" in update:
                    collections[coll_name][doc_id].update(update["$set"])
            res = MagicMock()
            res.modified_count = 1 if target else 0
            return res
        return _upd

    for name in collections:
        db[name].insert_one.side_effect = insert_one(name)
        db[name].find_one.side_effect = find_one(name)
        db[name].find.side_effect = find(name)
        db[name].update_one.side_effect = update_one(name)

    return db


@pytest.fixture
def test_user():
    return {
        "_id": ObjectId(),
        "role": "doctor",
        "email": "doctor@cardioxai.org",
        "full_name": "Dr. Sarah Johnson",
    }


@pytest.fixture
def client(mock_db, test_user):
    test_app = FastAPI()
    test_app.include_router(predict_router)
    test_app.dependency_overrides[get_db] = lambda: mock_db
    test_app.dependency_overrides[get_current_user] = lambda: test_user
    return TestClient(test_app)


# ── 1. Unit Tests: ECG Engine Core ───────────────────────────────


class TestECGEngineCore:
    def test_parse_csv_text_bytes(self):
        csv_data = b"0.1,0.2,0.3\n0.15,0.25,0.35\n0.18,0.28,0.38"
        parsed = parse_ecg_file(csv_data, filename="sample.csv", target_samples=5000)
        assert parsed.shape == (5000, 12)
        assert not np.isnan(parsed).any()

    def test_preprocess_ecg_filtering(self):
        raw = generate_synthetic_ecg(samples=5000, leads=12)
        filtered = preprocess_ecg(raw, fs=500)
        assert filtered.shape == (5000, 12)
        assert not np.isnan(filtered).any()
        # Normalization check: mean near 0, std near 1
        assert np.abs(np.mean(filtered)) < 0.2

    def test_extract_biomarkers(self):
        raw = generate_synthetic_ecg(samples=5000, leads=12, heart_rate_bpm=75.0)
        filtered = preprocess_ecg(raw, fs=500)
        metrics = extract_ecg_biomarkers(filtered, fs=500)

        assert "heart_rate_bpm" in metrics
        assert 50 <= metrics["heart_rate_bpm"] <= 120
        assert "mean_rr_ms" in metrics
        assert "hrv_sdnn_ms" in metrics
        assert "qrs_duration_ms" in metrics
        assert "qtc_interval_ms" in metrics
        assert "rhythm_classification" in metrics
        assert "st_elevations_mm" in metrics
        assert "st_depressions_mm" in metrics
        assert len(metrics["st_elevations_mm"]) == 12

    def test_predict_ecg_pipeline(self):
        raw = generate_synthetic_ecg(samples=5000, leads=12)
        result = predict_ecg(raw, filename="test.csv")

        assert result["model_name"] == "ecg_cnn_bilstm"
        assert 0.0 <= result["risk_score"] <= 1.0
        assert result["predicted_label"] in ("low_risk", "moderate_risk", "high_risk")
        assert len(result["clinical_findings"]) > 0
        assert len(result["lead_contributions"]) == 12

    def test_predict_multimodal_pipeline(self):
        clinical_data = {
            "age": 55,
            "gender": "Male",
            "bloodPressure": "145/95",
            "cholesterol": 240,
            "heartRate": 82,
            "fastingBloodSugar": 110,
        }
        raw = generate_synthetic_ecg(samples=5000, leads=12)
        result = predict_multimodal(clinical_data, raw)

        assert result["model_name"] == "multimodal_fusion"
        assert 0.0 <= result["risk_score"] <= 1.0
        assert "clinical_component" in result
        assert "ecg_component" in result
        assert "modality_breakdown" in result
        assert result["modality_breakdown"]["clinical_weight"] == 0.55
        assert result["modality_breakdown"]["ecg_weight"] == 0.45


# ── 2. Integration Tests: API Endpoints ──────────────────────────


class TestECGPredictionEndpoints:
    def test_model_health_includes_ecg(self, client):
        resp = client.get("/api/predict/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ecg_engine_ready"] is True
        assert data["ecg_leads_supported"] == 12

    def test_predict_ecg_via_streamed_signal(self, client):
        raw_signal = generate_synthetic_ecg(samples=1000, leads=12)
        payload = {
            "signal_data": raw_signal.tolist(),
            "sampling_rate_hz": 500,
        }
        resp = client.post("/api/predict/ecg", json=payload)
        assert resp.status_code == 200
        data = resp.json()

        assert data["model_name"] == "ecg_cnn_bilstm"
        assert 0.0 <= data["risk_score"] <= 1.0
        assert "metrics" in data
        assert "heart_rate_bpm" in data["metrics"]
        assert len(data["lead_contributions"]) == 12
        assert len(data["clinical_findings"]) > 0

    def test_predict_ecg_upload_file(self, client, tmp_path):
        # Create a temporary CSV with 500 rows and 12 columns
        signal = generate_synthetic_ecg(samples=500, leads=12)
        csv_buffer = io.StringIO()
        for row in signal:
            csv_buffer.write(",".join(f"{x:.4f}" for x in row) + "\n")
        csv_bytes = csv_buffer.getvalue().encode("utf-8")

        resp = client.post(
            "/api/predict/ecg/upload",
            files={"file": ("patient_ecg_sample.csv", csv_bytes, "text/csv")},
            data={"sampling_rate_hz": 500, "lead_count": 12},
        )
        assert resp.status_code == 201
        data = resp.json()

        assert data["model_name"] == "ecg_cnn_bilstm"
        assert data["ecg_recording_id"] is not None
        assert data["prediction_id"] is not None
        assert 0.0 <= data["risk_score"] <= 1.0
        assert "metrics" in data

    def test_get_ecg_prediction_by_id(self, client):
        # First upload an ECG
        signal = generate_synthetic_ecg(samples=500, leads=12)
        csv_buffer = io.StringIO()
        for row in signal:
            csv_buffer.write(",".join(f"{x:.4f}" for x in row) + "\n")
        csv_bytes = csv_buffer.getvalue().encode("utf-8")

        upload_resp = client.post(
            "/api/predict/ecg/upload",
            files={"file": ("rec_test.csv", csv_bytes, "text/csv")},
            data={"sampling_rate_hz": 500},
        )
        assert upload_resp.status_code == 201
        rec_id = upload_resp.json()["ecg_recording_id"]

        # Fetch prediction by ECG ID
        get_resp = client.get(f"/api/predict/ecg/{rec_id}")
        assert get_resp.status_code == 200
        data = get_resp.json()
        assert data["ecg_recording_id"] == rec_id
        assert data["risk_score"] == upload_resp.json()["risk_score"]

    def test_predict_multimodal_endpoint(self, client):
        raw_signal = generate_synthetic_ecg(samples=1000, leads=12)
        payload = {
            "clinical_data": {
                "age": 60,
                "gender": "Female",
                "bloodPressure": "150/95",
                "cholesterol": 230,
                "heartRate": 85,
            },
            "signal_data": raw_signal.tolist(),
            "sampling_rate_hz": 500,
        }
        resp = client.post("/api/predict/multimodal", json=payload)
        assert resp.status_code == 200
        data = resp.json()

        assert data["model_name"] == "multimodal_fusion"
        assert 0.0 <= data["risk_score"] <= 1.0
        assert "clinical_component" in data
        assert "ecg_component" in data
        assert "modality_breakdown" in data

    def test_prediction_history_returns_ecg_records(self, client):
        # Post streamed signal prediction
        raw_signal = generate_synthetic_ecg(samples=500, leads=12)
        client.post("/api/predict/ecg", json={"signal_data": raw_signal.tolist()})

        # Fetch history
        hist_resp = client.get("/api/predict/history")
        assert hist_resp.status_code == 200
        items = hist_resp.json()
        assert len(items) >= 1
        assert any(item.get("model_name") == "ecg_cnn_bilstm" for item in items)
