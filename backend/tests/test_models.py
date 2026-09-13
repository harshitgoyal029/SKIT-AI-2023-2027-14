"""Unit tests for MongoDB document schemas (models.py).

These test schema validation rules directly (no live database needed) —
they confirm that ClinicalRecord/ECGRecording reject bad data before it
ever reaches MongoDB, and that a valid document with a real ObjectId
parses correctly.
"""

import pytest
from bson import ObjectId
from pydantic import ValidationError

from models import ClinicalRecord, ECGRecording, User, UserRole


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
