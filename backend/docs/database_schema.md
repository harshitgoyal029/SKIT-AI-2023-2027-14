# CardioXAI — MongoDB Schema Reference

This document describes every collection in the `cardioxai` MongoDB database:
its purpose, fields, and indexes. Source of truth is `backend/models.py`
(Pydantic schemas) and `backend/database.py` (`init_indexes()`).

## `users`
Authentication + role record for every person who can log into the system.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | Mongo-generated primary key |
| `full_name` | str | Display name |
| `email` | str | Unique, used for login |
| `password_hash` | str | Never store plaintext passwords |
| `role` | enum | `admin`, `doctor`, `patient`, `lab_technician` |
| `is_active` | bool | Soft-disable a user without deleting them |
| `created_at` | datetime (UTC) | Set once, on creation |

**Index:** `email` (unique) — prevents duplicate accounts and speeds up login lookups.

## `clinical_records`
Tabular clinical/lab features used to train and run the clinical-side prediction model.

| Field | Type | Constraint |
|---|---|---|
| `patient_id` | ObjectId (str) | Required — links to `users._id` |
| `age` | int | 1–150 |
| `sex` | str | `M` / `F` |
| `chest_pain_type` | str | `TA`, `ATA`, `NAP`, `ASY` |
| `resting_bp` | int | 0–300 mmHg |
| `cholesterol` | int | 0–1000 mg/dl |
| `fasting_blood_sugar` | bool | true if > 120 mg/dl |
| `resting_ecg` | str | `Normal`, `ST`, `LVH` |
| `max_heart_rate` | int | 0–300 bpm |
| `exercise_angina` | bool | |
| `st_depression` | float | -10 to 10 |
| `st_slope` | str | `Up`, `Flat`, `Down` |
| `recorded_at` | datetime (UTC) | |

**Index:** `patient_id` — fast lookup of a patient's clinical history.

## `ecg_recordings`
Metadata for an uploaded ECG signal. The raw waveform is stored as a file on
disk/object storage; this document only tracks where it lives and its
signal properties (keeps documents small and MongoDB fast).

| Field | Type | Notes |
|---|---|---|
| `patient_id` | ObjectId (str) | Required |
| `original_name` / `stored_name` | str | Original upload name vs. de-duplicated storage name |
| `storage_path` | str | Where the raw signal file lives |
| `size_bytes` | int | |
| `sampling_rate_hz` | int | Default 500 |
| `lead_count` | int | Default 1 |
| `duration_seconds` | float | Optional |
| `processing_status` | str | `uploaded`, `processed`, `failed`, etc. |
| `uploaded_at` | datetime (UTC) | |

**Indexes:** `patient_id`; `stored_name` (unique) — prevents overwriting a
different patient's file with the same generated name.

## Why validation lives in Pydantic, not just MongoDB

MongoDB itself has no fixed schema, so all correctness (age ranges, required
fields, valid roles) is enforced at the application layer via these Pydantic
models before a document is ever written. See `backend/tests/test_models.py`
for automated checks that these constraints actually reject bad data.
