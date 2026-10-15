# Sprint 3: Model Training Data Organization Specification
**Project:** CardioXAI (SKIT/AI/2023-2027/14)  
**Author:** Jatin Khandelwal (Member 1 — Database Integration)  
**Collaborator:** Deepak Kumar Saini (Member 3 — Machine Learning & Deep Learning)  
**Sprint Window:** 14/10/2026 – 26/10/2026 (Form 2 Milestone)  
**Date:** October 15, 2026  

---

## 1. Objective (Form 2 Alignment)
As outlined in **Form 2**, the objective for Sprint 3 is:
> *"Help organize training: Will work with Deepak to organize data properly for model training."*

This document formalizes the ETL pipeline that transforms raw MongoDB documents into normalized, aligned feature vectors for Deepak's Clinical DNN and Multimodal Fusion networks.

---

## 2. Feature Mapping & Derived Metrics

Deepak's model requires a strict 16-element feature vector (`clinical_features.pkl`). The database integration layer extracts and derives these directly:

| Index | Feature Name | Source / Derivation | Data Type | Notes |
|---|---|---|---|---|
| 0 | `gender` | `record.gender` | Float (0.0 / 1.0) | 0.0: Female, 1.0: Male |
| 1 | `height` | `record.height` | Float (cm) | Standard default: 165.0 |
| 2 | `weight` | `record.weight` | Float (kg) | Standard default: 70.0 |
| 3 | `ap_hi` | `record.resting_bp` | Float (mmHg) | Systolic blood pressure |
| 4 | `ap_lo` | `record.diastolic_bp` | Float (mmHg) | Diastolic blood pressure (default: 80.0) |
| 5 | `smoke` | `record.smoking` | Float (0.0 / 1.0) | 1.0 if positive |
| 6 | `alco` | `record.alcohol` | Float (0.0 / 1.0) | 1.0 if positive |
| 7 | `active` | `record.active` | Float (0.0 / 1.0) | Physical activity |
| 8 | `age_years` | `record.age` | Float (years) | Standard physiological age |
| 9 | `BMI` | $\text{weight} / (\text{height}/100)^2$ | Float ($kg/m^2$) | Derived Body Mass Index |
| 10 | `pulse_pressure` | $\text{ap\_hi} - \text{ap\_lo}$ | Float (mmHg) | Derived hemodynamic marker |
| 11 | `MAP` | $\text{ap\_lo} + (\text{pulse\_pressure}/3)$ | Float (mmHg) | Derived Mean Arterial Pressure |
| 12 | `cholesterol_2` | One-hot Level 2 | Float (0.0 / 1.0) | 200–239 mg/dL |
| 13 | `cholesterol_3` | One-hot Level 3 | Float (0.0 / 1.0) | $\ge$ 240 mg/dL |
| 14 | `gluc_2` | One-hot Level 2 | Float (0.0 / 1.0) | Above normal fasting glucose |
| 15 | `gluc_3` | One-hot Level 3 | Float (0.0 / 1.0) | Well above normal fasting glucose |

---

## 3. Multimodal Synchronization
Deepak's fusion model (`Multimodal_Fusion_Final.py`) pairs clinical lab features with 12-lead ECG signal embeddings. The function `get_multimodal_training_pairs()` queries MongoDB to ensure:
1. Patient IDs match between `clinical_records` and `ecg_recordings`.
2. ECG signals have verified status (`uploaded`, `processed`, or `sample`) with 12 leads and 500 Hz sampling.

---

## 4. Automated Verification Results
Running `python backend/verify_model_data_alignment.py`:
```text
=================================================================
  CardioXAI — Feature & Schema Alignment Audit (Sprint 3)
  Database Integration: Jatin Khandelwal
=================================================================
[Audit 1/3] Clinical Feature Vector Alignment:
  [OK] Database extraction fields match trained model features 100%.

[Audit 2/3] 12-Lead ECG Signal Compatibility:
  [OK] ECGRecording schema matches 12-lead model input.

[Audit 3/3] Database Diagnostics:
  [OK] MongoDB Connected (Latency: 15.2ms)
=================================================================
  Alignment Result: PASSED (Ready for Training)
=================================================================
```

Automated unit tests in `test_training_data.py`: **5/5 tests passing**. Total suite: **44/44 tests passing**.
