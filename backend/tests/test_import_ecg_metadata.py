"""Tests for import_ecg_metadata.py's row-mapping logic.

Tests the mapping function directly against sample rows shaped like the
real ecg_metadata.csv — no live database or CSV file needed.
"""

import pytest
from bson import ObjectId
from pydantic import ValidationError

from import_ecg_metadata import _map_row

SAMPLE_ROW = {
    "record_path": r"C:\data\WFDB_Ningbo\JS10647",
    "age": "82",
    "sex": "Male",
    "diagnosis_codes": "426177001,713427006",
    "label": "1",
    "sampling_frequency": "500",
    "num_leads": "12",
    "num_samples": "5000",
    "lead_names": "I,II,III,aVR,aVL,aVF,V1,V2,V3,V4,V5,V6",
}


def _pid() -> str:
    return str(ObjectId())


class TestMapRow:
    def test_valid_row_maps_correctly(self):
        record = _map_row(SAMPLE_ROW, _pid())
        assert record.sampling_rate_hz == 500
        assert record.lead_count == 12
        assert record.duration_seconds == 10.0  # 5000 samples / 500 Hz
        assert record.original_name == "JS10647"
        assert record.processing_status == "imported"

    def test_diagnosis_codes_preserved_in_message(self):
        record = _map_row(SAMPLE_ROW, _pid())
        assert "426177001" in record.processing_message

    def test_stored_name_has_extension(self):
        record = _map_row(SAMPLE_ROW, _pid())
        assert record.stored_name.endswith(".dat")

    def test_different_sampling_rate_changes_duration(self):
        row = dict(SAMPLE_ROW, sampling_frequency="250", num_samples="2500")
        record = _map_row(row, _pid())
        assert record.duration_seconds == 10.0

    def test_missing_required_field_raises(self):
        bad_row = dict(SAMPLE_ROW)
        del bad_row["sampling_frequency"]
        with pytest.raises(KeyError):
            _map_row(bad_row, _pid())
