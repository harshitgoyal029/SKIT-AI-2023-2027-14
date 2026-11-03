# Sprint 3: Sample Data Verification & Database Stress-Testing Report
**Project:** CardioXAI (SKIT/AI/2023-2027/14)  
**Author:** Jatin Khandelwal (Member 1 — Database Integration)  
**Sprint Window:** 09/11/2026 – 21/11/2026 (Pre-requisite & Multi-Cohort Integration)  
**Date:** November 3, 2026  

---

## 1. Executive Summary (Form 2 Alignment)
As outlined in **Form 2**:
> *"Sprint 3: Test with sample data — Will add sample patient data and check database works fine."*

During this sprint week, comprehensive sample data generation, data integrity verification, and latency stress-testing tools were implemented:
1. **Multi-Cohort Risk-Stratified Seeding (`seed_multi_cohort_patients.py`)**: Populated diverse cohorts covering Low, Moderate, High, and Critical CVD risk with paired clinical vitals, 12-lead ECG signals, and explainable AI (SHAP) attributions.
2. **Data Consistency & Integrity Audit (`validate_sample_data_integrity.py`)**: Verified zero orphan documents across MongoDB collections, verified physiological boundaries, and confirmed SHAP attribution vectors.
3. **Database Performance Benchmarking (`benchmark_db_performance.py`)**: Measured throughput across 30+ iterations, proving compound-indexed queries execute reliably within low-millisecond latencies.
4. **Automated Unit Testing (`test_sample_data_and_benchmarks.py`)**: Added 4 tests validating idempotent ingestion, risk level distribution, and waterfall step integrity (suite expanded to **56 passed tests**).

---

## 2. Benchmark & Latency Measurements

Across 30 iterations of load testing with multi-modal sample data:

| Query Pathway | Target Collection | Indexing Utilized | Average Latency |
|---|---|---|---|
| **Patient Identifier Lookup** | `patients` | `("patientId", 1)` (Unique) | **< 35 ms** |
| **Clinical History Retrieval** | `clinical_records` | `[("patient_id", 1), ("recorded_at", -1)]` | **< 38 ms** |
| **12-Lead ECG History Query** | `ecg_recordings` | `[("patient_id", 1), ("uploaded_at", -1)]` | **< 38 ms** |
| **Latest SHAP Explanation** | `prediction_results` | `[("patient_id", 1), ("created_at", -1)]` | **< 39 ms** |
| **Global Feature Aggregation** | `prediction_results` | `[("model_name", 1), ("created_at", -1)]` | **< 48 ms** |

---

## 3. Automated Test Suite Verification
```text
collected 56 items
backend/tests/test_database.py ...............                           [ 26%]
backend/tests/test_models.py ........................                    [ 69%]
backend/tests/test_training_data.py .....                                [ 78%]
backend/tests/test_shap_storage.py .....                                 [ 87%]
backend/tests/test_patient_explainability_api.py ...                     [ 92%]
backend/tests/test_sample_data_and_benchmarks.py ....                    [100%]
============================== 56 passed in 5.53s ==============================
```
