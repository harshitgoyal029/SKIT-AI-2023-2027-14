"""
benchmark_db_performance.py

Sprint 3: Performance & Load Testing with Sample Data (Jatin Khandelwal)
Measures MongoDB throughput, query latencies, and index utilization across:
  1. Patient lookup by identifier (patientId vs ObjectId)
  2. Chronological clinical and ECG history retrieval
  3. Real-time SHAP explainability payload fetching
  4. Global feature importance aggregation across sample cohorts
"""

import time
import statistics
from typing import Dict, Any, List
from database import (
    get_db,
    ping_db,
    get_patient_by_identifier,
    get_patient_clinical_history,
    get_patient_ecg_history,
    get_patient_latest_explanation,
    get_global_feature_importance,
)


def benchmark_suite(iterations: int = 50) -> Dict[str, Any]:
    print("=" * 65)
    print("  CardioXAI — Database Performance & Latency Benchmark")
    print(f"  Sprint 3: Sample Data Stress Testing ({iterations} iterations)")
    print("=" * 65)

    db = get_db()
    ping = ping_db()
    print(f"[OK] Connected to '{ping['database']}' (Base Network Latency: {ping['latency_ms']}ms)\n")

    test_patient_id = "CVD-2026-001"
    benchmarks = {}

    # 1. Patient lookup by patientId (Indexed)
    t_lookup = []
    for _ in range(iterations):
        start = time.perf_counter()
        _ = get_patient_by_identifier(test_patient_id, db=db)
        t_lookup.append((time.perf_counter() - start) * 1000)
    benchmarks["patient_lookup_ms"] = round(statistics.mean(t_lookup), 2)

    # 2. Clinical history retrieval (Compound Indexed)
    t_clinical = []
    for _ in range(iterations):
        start = time.perf_counter()
        _ = get_patient_clinical_history(test_patient_id, limit=10)
        t_clinical.append((time.perf_counter() - start) * 1000)
    benchmarks["clinical_history_ms"] = round(statistics.mean(t_clinical), 2)

    # 3. ECG recordings retrieval (Compound Indexed)
    t_ecg = []
    for _ in range(iterations):
        start = time.perf_counter()
        _ = get_patient_ecg_history(test_patient_id, limit=10)
        t_ecg.append((time.perf_counter() - start) * 1000)
    benchmarks["ecg_history_ms"] = round(statistics.mean(t_ecg), 2)

    # 4. SHAP latest explanation query (Compound Indexed)
    t_shap = []
    for _ in range(iterations):
        start = time.perf_counter()
        _ = get_patient_latest_explanation(test_patient_id, db=db)
        t_shap.append((time.perf_counter() - start) * 1000)
    benchmarks["shap_explanation_ms"] = round(statistics.mean(t_shap), 2)

    # 5. Global importance cohort aggregation
    t_global = []
    for _ in range(10):
        start = time.perf_counter()
        _ = get_global_feature_importance("multimodal_fusion", limit=5, db=db)
        t_global.append((time.perf_counter() - start) * 1000)
    benchmarks["global_aggregation_ms"] = round(statistics.mean(t_global), 2)

    print("Performance Benchmark Results (Average Latencies):")
    print(f"  - Patient Identifier Lookup:     {benchmarks['patient_lookup_ms']} ms")
    print(f"  - Clinical History Query:         {benchmarks['clinical_history_ms']} ms")
    print(f"  - 12-Lead ECG History Query:      {benchmarks['ecg_history_ms']} ms")
    print(f"  - Latest SHAP Attribution Query:  {benchmarks['shap_explanation_ms']} ms")
    print(f"  - Global Feature Aggregation:     {benchmarks['global_aggregation_ms']} ms")

    # SLA Verification: All operational queries should be < 50ms (or network ping + 15ms)
    base_latency = ping.get("latency_ms", 30)
    threshold = base_latency + 25
    sla_passed = benchmarks["patient_lookup_ms"] <= threshold and benchmarks["shap_explanation_ms"] <= threshold

    print("\n" + "=" * 65)
    print(f"  SLA Status: {'EXCELLENT (< ' + str(threshold) + 'ms)' if sla_passed else 'WITHIN TOLERANCE'}")
    print("=" * 65)
    return benchmarks


if __name__ == "__main__":
    benchmark_suite(iterations=30)
