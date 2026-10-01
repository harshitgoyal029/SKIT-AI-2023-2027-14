# Schema Gap: `ClinicalRecord` vs `ClinicalPredictionInput`

**Found:** 2026-09-22, while reviewing `predict.py` and `ml_engine.py`
against the stored `clinical_records` schema.

## The gap

The project currently has two unrelated "clinical data" shapes:

1. **`ClinicalRecord`** (`models.py`) — what gets stored in the
   `clinical_records` collection. Shaped like the UCI Heart Disease
   dataset: `sex`, `chest_pain_type`, `resting_bp`, `resting_ecg`,
   `max_heart_rate`, `exercise_angina`, `st_depression`, `st_slope`.

2. **`ClinicalPredictionInput`** (`predict.py`) — what the `/api/predict/clinical`
   endpoint actually accepts, and what `ml_engine.py`'s `EXPECTED_FEATURES`
   requires. Shaped like the Cardio dataset: `gender`, `height`, `weight`,
   `ap_hi`, `ap_lo`, `cholesterol` (1–3 scale), `gluc`, `smoke`, `alco`,
   `active`, `age_years`.

These share almost no fields. A stored `ClinicalRecord` document cannot
currently be fed into a prediction — `ClinicalPredictionInput.clinical_record_id`
is stored as a loose reference string but nothing in the codebase reads
it back or maps a `ClinicalRecord` into the model's expected features.

## Why this happened (not anyone's mistake)

This traces back to the dataset mismatch flagged on 2026-09-13/14:
`ClinicalRecord` was designed against the UCI Heart Disease dataset
schema, but the dataset the team actually trained on (`clinical_dataset_clean.csv`,
Cardio-style) has different fields entirely. `ml_engine`/`predict.py`
were correctly built to match the *actual* training data — which is why
they diverged from `ClinicalRecord`.

## What this means in practice right now

- The prediction API works correctly on its own — it takes raw
  Cardio-style input directly from the request body every time.
- `clinical_records` (populated by `import_dataset.py`/`seed_clinical_data.py`)
  is effectively a separate, currently-unused-by-predictions dataset.
- This is **not a bug** — the system runs fine as-is. It's a design
  question for the team: should `ClinicalRecord` be redefined to match
  the Cardio schema (so stored records *can* feed predictions), or is
  it meant to serve some other purpose (e.g. a different, future model)?

## Recommendation

Raise this at the next team sync. Two reasonable paths:
- **Option A:** Redefine `ClinicalRecord` to match the Cardio dataset
  fields, so a patient's saved record can be reused for future predictions
  without re-entering data.
- **Option B:** Keep both as intentionally separate — `ClinicalRecord`
  for general patient history, `ClinicalPredictionInput` as a pure
  model-input DTO — and document that they're not meant to be linked.

Either is fine; the current state (undocumented, silently disconnected)
is the only actual problem.
