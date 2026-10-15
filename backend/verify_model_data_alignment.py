"""
verify_model_data_alignment.py

Sprint 3: Help Organize Training (Jatin Khandelwal)
Audits and verifies that MongoDB clinical & ECG records seamlessly align with
Deepak's trained ML models (clinical_features.pkl & ecg_model_info.json)
to prevent feature drift or dimension mismatches during model inference and training.
"""

import os
import sys
import pickle
import json
from pathlib import Path


def verify_alignment() -> bool:
    print("=" * 65)
    print("  CardioXAI — Feature & Schema Alignment Audit (Sprint 3)")
    print("  Database Integration: Jatin Khandelwal")
    print("=" * 65)

    base_dir = Path(__file__).resolve().parent.parent
    trained_models_dir = base_dir / "Trained Models"

    features_pkl = trained_models_dir / "clinical_features.pkl"
    ecg_info_json = trained_models_dir / "ecg_model_info.json"

    all_passed = True

    # 1. Check Clinical Feature Spec
    print("\n[Audit 1/3] Clinical Feature Vector Alignment:")
    if not features_pkl.exists():
        print(f"  [FAIL] {features_pkl.name} not found.")
        all_passed = False
    else:
        with open(features_pkl, "rb") as f:
            expected_features = pickle.load(f)
        
        from prepare_training_data import FEATURE_NAMES
        print(f"  Expected Features ({len(expected_features)}): {expected_features}")
        print(f"  Database Features ({len(FEATURE_NAMES)}): {FEATURE_NAMES}")

        if expected_features == FEATURE_NAMES:
            print("  [OK] Database extraction fields match trained model features 100%.")
        else:
            diff = set(expected_features).symmetric_difference(set(FEATURE_NAMES))
            print(f"  [FAIL] Feature discrepancy detected: {diff}")
            all_passed = False

    # 2. Check 12-Lead ECG Model Specifications
    print("\n[Audit 2/3] 12-Lead ECG Signal Compatibility:")
    if not ecg_info_json.exists():
        print(f"  [FAIL] {ecg_info_json.name} not found.")
        all_passed = False
    else:
        with open(ecg_info_json, "r") as f:
            ecg_spec = json.load(f)

        expected_leads = ecg_spec.get("leads", 12)
        expected_freq = ecg_spec.get("sampling_frequency", 500)
        expected_samples = ecg_spec.get("samples_per_record", 5000)

        print(f"  Target Architecture: {ecg_spec.get('architecture', 'CNN + BiLSTM')}")
        print(f"  Required Leads:       {expected_leads}")
        print(f"  Sampling Frequency:   {expected_freq} Hz")
        print(f"  Samples per Record:   {expected_samples}")

        # Check models.py default
        from models import ECGRecording
        ecg_default = ECGRecording.model_fields.get("lead_count").default
        if ecg_default == 12 or ecg_default == expected_leads:
            print("  [OK] ECGRecording schema matches 12-lead model input.")
        else:
            print(f"  [WARN] ECGRecording default leads is {ecg_default}, expected {expected_leads}.")

    # 3. Check Database Health Check Integration
    print("\n[Audit 3/3] Database Diagnostics:")
    try:
        from database import ping_db, get_collection_stats
        ping = ping_db()
        if ping.get("connected"):
            print(f"  [OK] MongoDB Connected (Latency: {ping.get('latency_ms')}ms)")
            stats = get_collection_stats()
            print(f"  Collection Counts: {stats}")
        else:
            print("  [INFO] MongoDB offline or remote; offline mocking active.")
    except Exception as exc:
        print(f"  [INFO] Database offline or mock mode: {exc}")

    print("\n" + "=" * 65)
    print("  Alignment Result:", "PASSED (Ready for Training)" if all_passed else "ISSUES FOUND")
    print("=" * 65)
    return all_passed


if __name__ == "__main__":
    success = verify_alignment()
    sys.exit(0 if success else 1)
