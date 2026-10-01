"""Unit tests for MongoDB document schemas (models.py).

These test schema validation rules directly (no live database needed) —
they confirm that ClinicalRecord/ECGRecording reject bad data before it
ever reaches MongoDB, and that a valid document with a real ObjectId
parses correctly.
"""

import pytest
from bson import ObjectId
from pydantic import ValidationError

from models import ClinicalRecord, ECGRecording, Patient, PredictionResult, User, UserRole


def _pid() -> str:
    return str(ObjectId())


class TestClinicalRecord:
    def test_valid_record_parses(self):
        record = ClinicalRecord(
            patient_id=_pid(), age=54, sex="M", resting_bp=130,
            cholesterol=246, max_heart_rate=150,
        )
        assert record.age == 54
        assert record.patient_id is not None

    def test_age_out_of_range_rejected(self):
        with pytest.raises(ValidationError):
            ClinicalRecord(patient_id=_pid(), age=200)

    def test_negative_resting_bp_rejected(self):
        with pytest.raises(ValidationError):
            ClinicalRecord(patient_id=_pid(), resting_bp=-10)

    def test_invalid_object_id_rejected(self):
        with pytest.raises(ValidationError):
            ClinicalRecord(patient_id="not-a-real-object-id")

    def test_missing_patient_id_rejected(self):
        with pytest.raises(ValidationError):
            ClinicalRecord(age=54)

    def test_optional_fields_can_be_omitted(self):
        record = ClinicalRecord(patient_id=_pid())
        assert record.age is None
        assert record.cholesterol is None

    def test_invalid_sex_value_rejected(self):
        with pytest.raises(ValidationError):
            ClinicalRecord(patient_id=_pid(), sex="male")

    def test_invalid_chest_pain_type_rejected(self):
        with pytest.raises(ValidationError):
            ClinicalRecord(patient_id=_pid(), chest_pain_type="unknown")

    def test_invalid_st_slope_rejected(self):
        with pytest.raises(ValidationError):
            ClinicalRecord(patient_id=_pid(), st_slope="Sideways")

    def test_valid_categorical_values_accepted(self):
        record = ClinicalRecord(
            patient_id=_pid(), sex="F", chest_pain_type="ASY",
            resting_ecg="LVH", st_slope="Flat",
        )
        assert record.sex == "F"
        assert record.st_slope == "Flat"


class TestECGRecording:
    def test_valid_recording_parses(self):
        ecg = ECGRecording(
            patient_id=_pid(), original_name="ecg_001.csv", stored_name="a1b2.csv",
            storage_path="uploads/ecg/a1b2.csv", size_bytes=204800,
        )
        assert ecg.sampling_rate_hz == 500  # default applied
        assert ecg.processing_status == "uploaded"  # default applied

    def test_missing_required_file_fields_rejected(self):
        with pytest.raises(ValidationError):
            ECGRecording(patient_id=_pid())


class TestUser:
    def test_valid_user_parses(self):
        user = User(
            full_name="Test Patient", email="patient@cardioxai.org",
            password_hash="hashed-value", role=UserRole.patient,
        )
        assert user.is_active is True

    def test_invalid_role_rejected(self):
        with pytest.raises(ValidationError):
            User(
                full_name="Test", email="t@x.com",
                password_hash="x", role="not-a-real-role",
            )


class TestPredictionResult:
    def test_valid_prediction_with_shap_parses(self):
        pred = PredictionResult(
            patient_id=_pid(), model_name="fusion_v1", risk_score=0.78,
            predicted_label="high_risk",
            shap_values={"age": 0.12, "cholesterol": 0.34},
            top_contributing_features=["cholesterol", "age"],
        )
        assert pred.risk_score == 0.78
        assert pred.shap_values["cholesterol"] == 0.34

    def test_risk_score_out_of_range_rejected(self):
        with pytest.raises(ValidationError):
            PredictionResult(
                patient_id=_pid(), model_name="x", risk_score=1.5,
                predicted_label="high_risk",
            )

    def test_negative_risk_score_rejected(self):
        with pytest.raises(ValidationError):
            PredictionResult(
                patient_id=_pid(), model_name="x", risk_score=-0.1,
                predicted_label="low_risk",
            )

    def test_invalid_predicted_label_rejected(self):
        with pytest.raises(ValidationError):
            PredictionResult(
                patient_id=_pid(), model_name="x", risk_score=0.5,
                predicted_label="maybe",
            )

    def test_prediction_without_explainability_still_valid(self):
        # A model that hasn't run SHAP/LIME yet should still be storable.
        pred = PredictionResult(
            patient_id=_pid(), model_name="clinical_xgboost", risk_score=0.3,
            predicted_label="low_risk",
        )
        assert pred.shap_values is None
        assert pred.lime_values is None


class TestPatientModel:
    def test_valid_patient_creation(self):
        p = Patient(
            patientId="PT-1001",
            name="John Doe",
            age=52,
            gender="Male",
            bloodPressure="130/85",
            cholesterol=210,
            heartRate=72,
            diabetes="No",
            smoking="Yes",
            risk_score=0.62,
            riskLevel="High Risk",
        )
        assert p.patient_id == "PT-1001"
        assert p.name == "John Doe"
        assert p.age == 52
        assert p.risk_level == "High Risk"
        assert p.risk_score == 0.62

    def test_invalid_age_rejected(self):
        with pytest.raises(ValidationError):
            Patient(
                patientId="PT-1002",
                name="Jane Doe",
                age=150,  # exceeds 120
                gender="Female",
            )

    def test_empty_patient_id_rejected(self):
        with pytest.raises(ValidationError):
            Patient(
                patientId="",
                name="Jane Doe",
                age=35,
                gender="Female",
            )

    def test_flexible_cholesterol_and_heart_rate(self):
        # Supports numeric, string, or None
        p1 = Patient(patientId="PT-1", name="A", age=40, gender="F", cholesterol="Normal")
        p2 = Patient(patientId="PT-2", name="B", age=40, gender="M", cholesterol=190.5)
        p3 = Patient(patientId="PT-3", name="C", age=40, gender="M", cholesterol=None)
        assert p1.cholesterol == "Normal"
        assert p2.cholesterol == 190.5
        assert p3.cholesterol is None
