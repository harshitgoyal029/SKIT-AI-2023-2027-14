# Sprint 3: SHAP & XAI Explanation Storage Architecture
**Project:** CardioXAI (SKIT/AI/2023-2027/14)  
**Author:** Jatin Khandelwal (Member 1 — Database Integration)  
**Sprint Window:** 27/10/2026 – 08/11/2026 (Pre-requisite & Initial Implementation)  
**Date:** October 22, 2026  

---

## 1. Scope & Objective (Form 2 Alignment)
As outlined in **Form 2**:
> *"Sprint 3: SHAP storage setup — Will setup a place in database to store SHAP explanation result."*

This architecture enables persistent storage of local and global Explainable AI (XAI) outputs produced by Deepak's multimodal machine learning models. Storing these precomputed attributions eliminates re-running expensive Shapley value computations on every dashboard load.

---

## 2. Collection Schema: `prediction_results`

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | Unique MongoDB primary key |
| `patient_id` | str / ObjectId | Institutional or MongoDB identifier of patient |
| `model_name` | str | Identifier of model (`multimodal_fusion`, `clinical_dnn`, `ecg_cnn_bilstm`) |
| `model_version` | str | Version string (default `1.0.0`) |
| `modality` | enum | `clinical`, `ecg`, or `multimodal_fusion` |
| `risk_score` | float | Calibrated disease probability ($0.0 \le p \le 1.0$) |
| `predicted_label` | str | Risk tier (`low_risk`, `moderate_risk`, `high_risk`) |
| `confidence_score` | float | Model output confidence metric |
| `base_value` | float | Prior baseline expected value ($E[f(X)]$) |
| `shap_values` | dict[str, float] | Feature attributions for 16 clinical bio-markers |
| `top_contributing_features` | list[str] | Top positive risk contributors |
| `waterfall_points` | list[dict] | Sequential steps for rendering interactive waterfall plots |
| `created_at` | datetime (UTC) | Timestamp of model inference |

---

## 3. High-Performance Indexing Strategy
To support real-time rendering in the clinician dashboard and PDF generation:
- `(patient_id, 1)`: Quick patient lookups.
- `(patient_id, 1, created_at, -1)`: Retrieves latest patient explanation in $O(\log N)$ time.
- `(model_name, 1, created_at, -1)`: Scopes global explainability aggregation to specific model versions.

---

## 4. Database Helper API
- `save_prediction_explanation(patient_id, prediction_data, db)`: Validates and writes explanation payload.
- `get_patient_latest_explanation(patient_id, model_name, db)`: Powers `ShapChart.jsx` and printable reports.
- `get_global_feature_importance(model_name, limit, db)`: Computes mean absolute SHAP values across patient cohorts.

---

## 5. Verification & Automated Test Results
```text
collected 49 items
backend/tests/test_database.py ...............                           [ 30%]
backend/tests/test_models.py ........................                    [ 79%]
backend/tests/test_training_data.py .....                                [ 89%]
backend/tests/test_shap_storage.py .....                                 [100%]
============================== 49 passed in 6.34s ==============================
```
