"""
Unit tests for the patient API and clinical adapter pipeline (patient_api.py & ml_engine.py).

Verifies patient vitals parsing, risk scoring, explainability generation,
CRUD schemas, and API endpoint behavior without requiring an external database.
"""

from unittest.mock import MagicMock
from bson import ObjectId
import pytest
from fastapi.testclient import TestClient

from ml_engine import (
    explain_feature_contribution,
    parse_patient_vitals,
    predict_patient,
)
from patient_api import PatientCreate, PatientUpdate, router
from predict import router as predict_router
from fastapi import FastAPI
from database import get_db


# ── Fixtures & Setup ─────────────────────────────────────────────


@pytest.fixture
def mock_db():
    """In-memory mock database for testing router endpoints."""
    db = MagicMock()
    storage = {}

    def insert_one(doc):
        _id = ObjectId()
        doc_copy = dict(doc)
        doc_copy["_id"] = _id
        storage[str(_id)] = doc_copy
        res = MagicMock()
        res.inserted_id = _id
        return res

    def find_one(query):
        for doc in storage.values():
            match = True
            for k, v in query.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                return dict(doc)
        return None

    def find(query):
        cursor = MagicMock()
        results = list(storage.values())
        cursor.sort.return_value = cursor
        cursor.skip.return_value = cursor
        cursor.limit.return_value = results
        return cursor

    def count_documents(query):
        return len(storage)

    def update_one(query, update):
        target = find_one(query)
        if target:
            doc_id = str(target["_id"])
            if "$set" in update:
                storage[doc_id].update(update["$set"])
        res = MagicMock()
        res.modified_count = 1 if target else 0
        return res

    def delete_one(query):
        target = find_one(query)
        if target:
            del storage[str(target["_id"])]
        res = MagicMock()
        res.deleted_count = 1 if target else 0
        return res

    db["patients"].insert_one.side_effect = insert_one
    db["patients"].find_one.side_effect = find_one
    db["patients"].find.side_effect = find
    db["patients"].count_documents.side_effect = count_documents
    db["patients"].update_one.side_effect = update_one
    db["patients"].delete_one.side_effect = delete_one
    db["prediction_results"].insert_one.return_value = MagicMock(inserted_id=ObjectId())
    db["prediction_results"].delete_many.return_value = MagicMock(deleted_count=0)
    return db


@pytest.fixture
def client(mock_db):
    test_app = FastAPI()
    test_app.include_router(router)
    test_app.include_router(predict_router)
    test_app.dependency_overrides[get_db] = lambda: mock_db
    return TestClient(test_app)


# ── Feature Parsing Tests ────────────────────────────────────────


class TestPatientVitalsParsing:
    def test_blood_pressure_slash_parsing(self):
        vitals = parse_patient_vitals({"bloodPressure": "145/95", "age": 55})
        assert vitals["ap_hi"] == 145
        assert vitals["ap_lo"] == 95

    def test_blood_pressure_fallback(self):
        vitals = parse_patient_vitals({"bloodPressure": "", "ap_hi": 135, "ap_lo": 85})
        assert vitals["ap_hi"] == 135
        assert vitals["ap_lo"] == 85

    def test_blood_pressure_bounds_enforcement(self):
        # Even with malformed or inverted numbers, ap_hi must be > ap_lo
        vitals = parse_patient_vitals({"bloodPressure": "80/120"})
        assert vitals["ap_hi"] > vitals["ap_lo"]

    def test_gender_string_mapping(self):
        m = parse_patient_vitals({"gender": "Male"})
        f = parse_patient_vitals({"gender": "Female"})
        assert m["gender"] == 1
        assert f["gender"] == 0

    def test_cholesterol_categorization(self):
        # <200 -> 1, 200-239 -> 2, >=240 -> 3
        c1 = parse_patient_vitals({"cholesterol": 180})
        c2 = parse_patient_vitals({"cholesterol": 220})
        c3 = parse_patient_vitals({"cholesterol": 260})
        assert c1["cholesterol"] == 1
        assert c2["cholesterol"] == 2
        assert c3["cholesterol"] == 3

    def test_cholesterol_text_mapping(self):
        c_high = parse_patient_vitals({"cholesterol": "Well above normal"})
        c_border = parse_patient_vitals({"cholesterol": "Above normal"})
        c_norm = parse_patient_vitals({"cholesterol": "Normal"})
        assert c_high["cholesterol"] == 3
        assert c_border["cholesterol"] == 2
        assert c_norm["cholesterol"] == 1

    def test_smoking_and_diabetes_text_mapping(self):
        v1 = parse_patient_vitals({"smoking": "Yes", "diabetes": "Yes"})
        v2 = parse_patient_vitals({"smoking": "No", "diabetes": "No"})
        assert v1["smoke"] == 1
        assert v1["gluc"] == 2
        assert v2["smoke"] == 0
        assert v2["gluc"] == 1


# ── Prediction & Explainability Tests ─────────────────────────────


class TestPredictPatient:
    def test_predict_patient_structure(self):
        patient_data = {
            "name": "Jane Clinical",
            "age": 58,
            "gender": "Female",
            "bloodPressure": "150/92",
            "cholesterol": 235,
            "smoking": "Yes",
            "diabetes": "No",
        }
        res = predict_patient(patient_data)
        assert "risk_score" in res
        assert 0.0 <= res["risk_score"] <= 1.0
        assert res["risk_level"] in ("Low Risk", "Moderate Risk", "High Risk", "Very High Risk")
        assert res["predicted_label"] in ("low_risk", "high_risk")
        assert len(res["top_contributing_features"]) <= 5
        assert len(res["explanations"]) <= 5

        # Verify explanation contents
        first_exp = res["explanations"][0]
        assert "feature" in first_exp
        assert "title" in first_exp
        assert "importance" in first_exp
        assert "impact" in first_exp
        assert "recommendation" in first_exp

    def test_explain_feature_contribution_catalog(self):
        exp = explain_feature_contribution("ap_hi", 150, 35.5)
        assert exp["title"] == "Systolic Blood Pressure"
        assert exp["importance"] == 35.5
        assert "cardiac afterload" in exp["impact"].lower()


# ── API Endpoint Tests ───────────────────────────────────────────


class TestPatientEndpoints:
    def test_create_patient_success(self, client):
        payload = {
            "patientId": "CVD-9001",
            "name": "Alex Mercer",
            "age": 52,
            "gender": "Male",
            "phone": "+91 9876543210",
            "email": "alex@hospital.org",
            "bloodPressure": "135/88",
            "cholesterol": 215,
            "heartRate": 74,
            "diabetes": "No",
            "smoking": "Yes",
            "familyHistory": "Yes",
            "autoAssess": True,
        }
        response = client.post("/api/patients", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["patientId"] == "CVD-9001"
        assert data["name"] == "Alex Mercer"
        assert "riskLevel" in data
        assert "risk_score" in data
        assert "top_contributing_features" in data
        assert "_id" in data

    def test_create_duplicate_patient_id_fails(self, client):
        payload = {
            "patientId": "CVD-DUP",
            "name": "Duplicate Test",
            "age": 45,
            "gender": "Female",
        }
        res1 = client.post("/api/patients", json=payload)
        assert res1.status_code == 201

        res2 = client.post("/api/patients", json=payload)
        assert res2.status_code == 409
        assert "already exists" in res2.json()["detail"]

    def test_list_patients(self, client):
        client.post("/api/patients", json={"patientId": "P-1", "name": "One", "age": 30, "gender": "Male"})
        client.post("/api/patients", json={"patientId": "P-2", "name": "Two", "age": 40, "gender": "Female"})

        res = client.get("/api/patients")
        assert res.status_code == 200
        data = res.json()
        assert data["total"] >= 2
        assert len(data["patients"]) >= 2

    def test_get_patient_not_found(self, client):
        res = client.get("/api/patients/nonexistent-id")
        assert res.status_code == 404

    def test_update_patient_recalculates_risk(self, client):
        p_res = client.post(
            "/api/patients",
            json={"patientId": "P-UPD", "name": "Before Update", "age": 40, "gender": "Male", "bloodPressure": "115/75"},
        )
        assert p_res.status_code == 201
        orig_score = p_res.json().get("risk_score")

        # Update BP to stage 2 hypertension
        upd_res = client.put(
            "/api/patients/P-UPD",
            json={"bloodPressure": "170/105", "smoking": "Yes", "cholesterol": 280},
        )
        assert upd_res.status_code == 200
        upd_data = upd_res.json()
        assert upd_data["riskLevel"] in ("High Risk", "Very High Risk")
        assert upd_data["risk_score"] > (orig_score or 0)

    def test_delete_patient(self, client):
        client.post("/api/patients", json={"patientId": "P-DEL", "name": "To Delete", "age": 45, "gender": "Male"})
        del_res = client.delete("/api/patients/P-DEL")
        assert del_res.status_code == 200
        assert "deleted successfully" in del_res.json()["message"]

    def test_manual_assess_patient(self, client):
        client.post("/api/patients", json={"patientId": "P-ASSESS", "name": "Assess Me", "age": 60, "gender": "Female", "bloodPressure": "140/90"})
        assess_res = client.post("/api/patients/P-ASSESS/assess")
        assert assess_res.status_code == 200
        data = assess_res.json()
        assert "risk_score" in data
        assert "risk_level" in data
        assert "feature_contributions" in data

    def test_predict_patient_route(self, client):
        client.post(
            "/api/patients",
            json={"patientId": "P-PRED", "name": "Predict Patient", "age": 62, "gender": "Male", "bloodPressure": "155/95", "smoking": "Yes"},
        )
        res = client.post("/api/predict/patient/P-PRED")
        assert res.status_code == 200
        data = res.json()
        assert data["patientId"] == "P-PRED"
        assert "risk_score" in data
        assert "risk_level" in data
        assert len(data["feature_contributions"]) > 0

    def test_predict_explain_route(self, client):
        body = {
            "age": 55,
            "gender": "Female",
            "bloodPressure": "140/90",
            "cholesterol": 240,
            "smoking": "Yes",
        }
        res = client.post("/api/predict/explain", json=body)
        assert res.status_code == 200
        data = res.json()
        assert "clinical_summary" in data
        assert "explanations" in data
        assert len(data["explanations"]) > 0
