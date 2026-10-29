# Sprint 3: Live SHAP Explainability & Dashboard Integration Architecture
**Project:** CardioXAI (SKIT/AI/2023-2027/14)  
**Author:** Jatin Khandelwal (Member 1 — Database Integration)  
**Sprint Window:** 27/10/2026 – 08/11/2026 (Live API & Dashboard Integration)  
**Date:** October 29, 2026  

---

## 1. Executive Summary (Form 2 Alignment)
As outlined in **Form 2**:
> *"Sprint 3: SHAP storage setup — Will setup a place in database to store SHAP explanation result."*

During this sprint week, the database storage layer was integrated directly into the live API pipeline:
1. Granular SHAP attributions and waterfall steps are persisted in MongoDB during every `assess_patient` call.
2. A dedicated REST API endpoint `GET /api/patients/{identifier}/explainability` exposes precomputed SHAP vectors to Harshit's frontend `ShapChart.jsx`.
3. Cohort-level feature importance aggregation is exposed via `GET /api/patients/explainability/global-importance`.
4. The frontend `dashboardService.js` was connected to fetch real MongoDB explainability records instead of static mock data.

---

## 2. API Contract & Data Payloads

### `GET /api/patients/{identifier}/explainability`
Returns formatted feature attributions consumed by `ShapChart.jsx`:
```json
{
  "patientId": "CVD-2026-001",
  "name": "Rajesh Kumar",
  "risk_score": 0.78,
  "risk_level": "High Risk",
  "method": "SHAP",
  "base_value": 0.35,
  "features": [
    {
      "feature": "ap_hi",
      "contribution": 0.22,
      "shap_value": 0.22,
      "direction": "Positive impact",
      "signedValue": 0.22
    },
    {
      "feature": "cholesterol_3",
      "contribution": 0.14,
      "shap_value": 0.14,
      "direction": "Positive impact",
      "signedValue": 0.14
    },
    {
      "feature": "active",
      "contribution": 0.05,
      "shap_value": -0.05,
      "direction": "Negative impact",
      "signedValue": -0.05
    }
  ],
  "top_contributing_features": ["ap_hi", "cholesterol_3", "age_years"],
  "waterfall_points": [
    {"step": 0, "feature": "Baseline (E[f(x)])", "contribution": 0.35, "running_score": 0.35},
    {"step": 1, "feature": "Systolic BP (+22 mmHg)", "contribution": 0.22, "running_score": 0.57}
  ]
}
```

---

## 3. Verification & Automated Test Results
```text
collected 52 items
backend/tests/test_database.py ...............                           [ 28%]
backend/tests/test_models.py ........................                    [ 75%]
backend/tests/test_training_data.py .....                                [ 84%]
backend/tests/test_shap_storage.py .....                                 [ 94%]
backend/tests/test_patient_explainability_api.py ...                     [100%]
============================== 52 passed in 7.31s ==============================
```
