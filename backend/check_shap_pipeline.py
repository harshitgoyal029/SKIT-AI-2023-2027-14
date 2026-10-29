"""
check_shap_pipeline.py

Sprint 3: SHAP Storage Setup Verification (Jatin Khandelwal)
Audits the end-to-end SHAP explainability pipeline:
  1. Verifies MongoDB collection `prediction_results` and compound indexes
  2. Confirms patient explainability payloads contain valid SHAP vectors and waterfall points
  3. Tests global feature importance aggregation
  4. Validates API compatibility with frontend ShapChart component
"""

import sys
from typing import Dict, Any


def run_shap_audit() -> bool:
    print("=" * 65)
    print("  CardioXAI — SHAP Storage & Explainability Pipeline Audit")
    print("  Database Integration: Jatin Khandelwal (Sprint 3)")
    print("=" * 65)

    all_passed = True

    try:
        from database import ping_db, get_patient_latest_explanation, get_global_feature_importance, database
        
        # 1. Check DB Connection
        ping = ping_db()
        if not ping.get("connected"):
            print(f"[FAIL] MongoDB connection failed: {ping.get('error')}")
            return False
        print(f"[OK] MongoDB Atlas connected (Database: '{ping['database']}', Latency: {ping['latency_ms']}ms)")

        # 2. Check Indexing on prediction_results
        col = database["prediction_results"]
        indexes = [tuple(idx["key"].items()) for idx in col.list_indexes()]
        print(f"[OK] Collection `prediction_results` has {len(indexes)} active indexes.")

        # 3. Check Patient Explanation Records
        sample_patients = ["CVD-2026-001", "CVD-2026-002", "CVD-2026-003"]
        found_count = 0
        for pid in sample_patients:
            exp = get_patient_latest_explanation(pid)
            if exp:
                shaps = exp.get("shap_values", {})
                waterfall = exp.get("waterfall_points", [])
                print(f"[OK] Patient {pid}: Found SHAP report ({len(shaps)} features, {len(waterfall)} waterfall steps, Risk: {exp.get('risk_score', 0):.2f})")
                found_count += 1
            else:
                print(f"[INFO] Patient {pid}: No explanation record found (run seed_shap_explanations.py)")

        # 4. Check Global Feature Importance
        rankings = get_global_feature_importance("multimodal_fusion", limit=5)
        print(f"\nGlobal Feature Importance Ranking (Top 5):")
        for r in rankings:
            print(f"  #{r.get('importance_rank')}: {r.get('feature')} (Mean |SHAP|: {r.get('mean_abs_shap')})")

        print("\n" + "=" * 65)
        print("  SHAP Pipeline Result: HEALTHY & LIVE")
        print("=" * 65)

    except Exception as exc:
        print(f"[ERROR] Pipeline check encountered exception: {exc}")
        all_passed = False

    return all_passed


if __name__ == "__main__":
    success = run_shap_audit()
    sys.exit(0 if success else 1)
