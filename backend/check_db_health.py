"""Database health-check script.

Run this any time to verify:
  1. MongoDB Atlas is reachable (uses database.ping_db())
  2. Every index we expect to exist actually exists (nobody currently
     checks this — init_indexes() creates them once at startup, but there
     was no way to confirm they're still there / weren't dropped)
  3. How many documents are in each collection (uses get_collection_stats())

Exits with code 0 if everything is healthy, 1 if anything is wrong —
so this can also be used as a quick pre-demo sanity check.
"""

import sys

from database import database, get_collection_stats, ping_db

# Collection name -> list of expected index key-patterns (as tuples of
# (field, direction) tuples, matching what init_indexes() creates).
EXPECTED_INDEXES = {
    "users": [(("email", 1),)],
    "patient_profiles": [(("user_id", 1),)],
    "health_profiles": [(("patient_id", 1),)],
    "medical_documents": [(("patient_id", 1),), (("stored_name", 1),)],
    "clinical_records": [(("patient_id", 1),), (("patient_id", 1), ("recorded_at", -1))],
    "ecg_recordings": [(("patient_id", 1),), (("stored_name", 1),)],
    "prediction_results": [(("patient_id", 1),), (("patient_id", 1), ("created_at", -1))],
}


def _index_keys(collection_name: str) -> list:
    """Return the key-pattern of every index currently on a collection,
    as a list of tuples, ignoring the default _id index."""
    keys = []
    for index in database[collection_name].list_indexes():
        pattern = tuple(index["key"].items())
        if pattern != (("_id", 1),):
            keys.append(pattern)
    return keys


def check_indexes() -> bool:
    print("\nIndex check:")
    all_ok = True
    for collection_name, expected in EXPECTED_INDEXES.items():
        actual = _index_keys(collection_name)
        for expected_pattern in expected:
            found = expected_pattern in actual
            status = "OK" if found else "MISSING"
            if not found:
                all_ok = False
            print(f"  [{status}] {collection_name}: {expected_pattern}")
    return all_ok


def main() -> int:
    print("=== CardioXAI Database Health Check ===")

    ping = ping_db()
    if not ping["connected"]:
        print(f"\n[FAIL] Cannot connect to MongoDB: {ping.get('error')}")
        return 1
    print(f"\n[OK] Connected to '{ping['database']}' (latency: {ping['latency_ms']}ms)")

    indexes_ok = check_indexes()

    print("\nCollection document counts:")
    for name, count in get_collection_stats().items():
        print(f"  {name}: {count}")

    print("\n=== Result:", "HEALTHY" if indexes_ok else "ISSUES FOUND", "===")
    return 0 if indexes_ok else 1


if __name__ == "__main__":
    sys.exit(main())
