# # Multimodal Fusion — Clinical + ECG

# This notebook combines:
# - `clinical_feature_extractor` → clinical embedding
# - `ecg_feature_extractor` → ECG embedding
# - a small neural classifier over the concatenated embeddings

# ## Important scientific limitation

# The clinical dataset and the Ningbo ECG dataset do **not** share patient IDs. Therefore this notebook cannot perform genuine patient-level multimodal fusion.

# For an end-to-end architecture test, it performs **synthetic label-matched pairing**:
# - clinical `cardio=0` ↔ ECG `label=0`
# - clinical `cardio=1` ↔ ECG `label=1`

# This is useful for checking that the fusion pipeline runs and the embedding dimensions are compatible, but its accuracy/AUC must **not** be reported as real multimodal clinical performance.

# For real multimodal CVD research, use a dataset/cohort in which the same patient has both clinical variables and ECG data, and join them using a patient ID.

# ## Technical changes in this version

# - Uses the Windows-safe ECG cache from the fixed ECG notebook.
# - Does not use `mmap_mode="r"` for cache files.
# - Uses atomic temporary-file writes.
# - Uses float16 cache storage.
# - Processes ECGs in small batches instead of loading the entire ECG test set into RAM.
# - Validates the ECG shape `(5000, 12)` before inference.
# - Adds fusion shape checks and safer training callbacks.

# ## 1. Load both trained feature extractors
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras import layers
from tensorflow.keras.models import load_model
import joblib
from pathlib import Path
import json
import shutil

# Robust project paths
PROJECT_ROOT = Path.cwd().parent if Path.cwd().name == "Trained Models" else Path.cwd()
MODELS_DIR = PROJECT_ROOT / "Trained Models"
DATASETS_DIR = PROJECT_ROOT / "DataSets"

print("PROJECT_ROOT:", PROJECT_ROOT)
print("MODELS_DIR:", MODELS_DIR)
print("DATASETS_DIR:", DATASETS_DIR)

# Required model artifacts
required_files = [
    MODELS_DIR / "clinical_feature_extractor.keras",
    MODELS_DIR / "ecg_feature_extractor.keras",
    MODELS_DIR / "clinical_scaler.pkl",
    MODELS_DIR / "clinical_features.pkl",
]

missing = [str(p) for p in required_files if not p.exists()]
if missing:
    raise FileNotFoundError("Missing required model artifacts:\n" + "\n".join(missing))

clinical_feature_extractor = load_model(
    MODELS_DIR / "clinical_feature_extractor.keras",
    compile=False
)
ecg_feature_extractor = load_model(
    MODELS_DIR / "ecg_feature_extractor.keras",
    compile=False
)

clinical_scaler = joblib.load(
    MODELS_DIR / "clinical_scaler.pkl"
)
clinical_features = list(
    joblib.load(MODELS_DIR / "clinical_features.pkl")
)

print("Clinical embedding dim:", clinical_feature_extractor.output_shape[-1])
print("ECG embedding dim:", ecg_feature_extractor.output_shape[-1])
print("ECG model input shape:", ecg_feature_extractor.input_shape)

# The fixed ECG notebook produces ECG tensors of (5000, 12).
if tuple(ecg_feature_extractor.input_shape[1:]) != (5000, 12):
    raise ValueError(
        f"Unexpected ECG extractor input shape: "
        f"{ecg_feature_extractor.input_shape}. Expected (None, 5000, 12)."
    )

# 2. Load both test sets
# 2. Load and preprocess both test sets

clinical_path = DATASETS_DIR / "clinical_dataset_clean.csv"
ecg_test_path = DATASETS_DIR / "ecg_test.csv"

if not clinical_path.exists():
    raise FileNotFoundError(f"Clinical dataset not found: {clinical_path}")
if not ecg_test_path.exists():
    raise FileNotFoundError(f"ECG test CSV not found: {ecg_test_path}")

clinical_raw = pd.read_csv(clinical_path)
ecg_test_df = pd.read_csv(ecg_test_path)

print("Raw clinical columns:")
print(list(clinical_raw.columns))

# IMPORTANT:
# clinical_dataset_clean.csv may already have removed `id` and `age`.
# Therefore we DO NOT require those two columns.
#
# We only require columns that are actually needed to reproduce the
# clinical model's feature preprocessing.

required_raw = {
    "gender", "height", "weight",
    "ap_hi", "ap_lo", "cholesterol", "gluc",
    "smoke", "alco", "active", "cardio"
}

missing_raw = required_raw - set(clinical_raw.columns)

if missing_raw:
    raise ValueError(
        f"Missing required clinical columns: {sorted(missing_raw)}"
    )

# Reproduce the clinical preprocessing.
clinical_encoded = clinical_raw.copy()

# These columns are optional because the cleaned CSV may already
# have removed them.
optional_drop = [
    col for col in ["id", "age"]
    if col in clinical_encoded.columns
]

if optional_drop:
    clinical_encoded = clinical_encoded.drop(
        columns=optional_drop
    )

# Match the gender preprocessing used by the clinical model.
# If gender is already encoded as 0/1, leave it unchanged.
if set(clinical_encoded["gender"].dropna().unique()).issubset({0, 1}):
    clinical_encoded["gender"] = clinical_encoded["gender"].astype(int)
else:
    clinical_encoded["gender"] = clinical_encoded["gender"].map({
        1: 0,
        2: 1
    })

if clinical_encoded["gender"].isna().any():
    raise ValueError(
        "Unexpected values found in clinical `gender` column."
    )

# One-hot encode categorical variables exactly as in the
# clinical training pipeline.
clinical_encoded = pd.get_dummies(
    clinical_encoded,
    columns=["cholesterol", "gluc"],
    drop_first=True,
    dtype=int
)

# Separate target and align with the exact saved training schema.
clinical_target = clinical_encoded["cardio"].astype(int)
clinical_X = clinical_encoded.drop(columns=["cardio"])

missing_model_features = (
    set(clinical_features) - set(clinical_X.columns)
)

if missing_model_features:
    raise ValueError(
        "Clinical preprocessing does not reproduce the trained "
        "model schema.\n"
        f"Missing trained features: "
        f"{sorted(missing_model_features)}"
    )

# Ignore harmless extra columns and enforce exact feature order.
clinical_X = clinical_X.reindex(
    columns=clinical_features
)

clinical_df = clinical_X.copy()
clinical_df["cardio"] = clinical_target.values

# ECG input validation.
required_ecg = {"record_path", "label"}
missing_ecg = required_ecg - set(ecg_test_df.columns)

if missing_ecg:
    raise ValueError(
        f"Missing ECG columns: {sorted(missing_ecg)}"
    )

ecg_test_df = ecg_test_df.dropna(
    subset=["record_path", "label"]
).copy()

ecg_test_df["label"] = ecg_test_df["label"].astype(int)

clinical_df = clinical_df.dropna(
    subset=clinical_features + ["cardio"]
).copy()

clinical_df["cardio"] = clinical_df["cardio"].astype(int)

print("\nClinical records:", len(clinical_df))
print("ECG test records:", len(ecg_test_df))
print("Clinical feature count:", len(clinical_features))
print("Clinical feature columns:", clinical_features)

print("\nClinical label counts:")
print(
    clinical_df["cardio"]
    .value_counts()
    .sort_index()
)

print("\nECG label counts:")
print(
    ecg_test_df["label"]
    .value_counts()
    .sort_index()
)

# Clinical schema sanity check
print('Expected clinical features:', len(clinical_features))
print('Actual aligned features:', len(clinical_df.columns) - 1)
assert list(clinical_df.drop(columns=['cardio']).columns) == list(clinical_features)
print('Clinical preprocessing/schema check PASSED.')

# 3. Pair records by label (see caveat above)

# `cardio` (clinical: 0 = no CVD, 1 = CVD) is matched to `label` (ECG: 0 = Normal, 1 = Abnormal).
# Each ECG test record is paired with a randomly sampled clinical record carrying the same
# label, so the fused dataset keeps the same size and label balance as the ECG test set.
# Synthetic label-matched pairing ONLY.
# This is NOT patient-level multimodal data because the datasets have no shared patient ID.

rng = np.random.default_rng(42)
paired_rows = []

for label in sorted(ecg_test_df["label"].unique()):

    ecg_group = ecg_test_df[
        ecg_test_df["label"] == label
    ].reset_index(drop=True)

    clinical_group = clinical_df[
        clinical_df["cardio"] == label
    ].reset_index(drop=True)

    if len(clinical_group) == 0:
        raise ValueError(
            f"No clinical records available for label={label}"
        )

    # Prefer sampling WITHOUT replacement so the same clinical row
    # is not repeatedly paired with many ECGs.
    replace = len(ecg_group) > len(clinical_group)

    selected_indices = rng.choice(
        len(clinical_group),
        size=len(ecg_group),
        replace=replace
    )

    for ecg_i, clinical_i in zip(
        range(len(ecg_group)),
        selected_indices
    ):
        ecg_row = ecg_group.iloc[ecg_i]
        clinical_row = clinical_group.iloc[clinical_i]

        paired_rows.append({
            "record_path": ecg_row["record_path"],
            "label": int(label),
            **{
                f"clinical_{col}": clinical_row[col]
                for col in clinical_features
            }
        })

paired_df = pd.DataFrame(paired_rows)

# Shuffle once after pairing.
paired_df = paired_df.sample(
    frac=1,
    random_state=42
).reset_index(drop=True)

print("Paired dataset shape:", paired_df.shape)
print("Paired label counts:")
print(paired_df["label"].value_counts().sort_index())
paired_df.head()

# 4. Build embeddings for the paired set
# 4A. Clinical embeddings for the PAIRED clinical records
# IMPORTANT: paired_df contains the exact clinical row assigned to each ECG.
# Therefore embeddings must be generated from paired_df, not from the entire clinical_df.

paired_clinical_X = paired_df[
    [f"clinical_{col}" for col in clinical_features]
].copy()
paired_clinical_X.columns = clinical_features

paired_clinical_scaled = clinical_scaler.transform(
    paired_clinical_X
)

clinical_embeddings = clinical_feature_extractor.predict(
    paired_clinical_scaled,
    batch_size=64,
    verbose=0
)

print("Clinical embeddings shape:", clinical_embeddings.shape)
assert clinical_embeddings.ndim == 2
assert clinical_embeddings.shape[0] == len(paired_df)
assert clinical_embeddings.shape[1] == clinical_feature_extractor.output_shape[-1]
print("Clinical embedding check PASSED.")

# 4B. ECG preprocessing + Windows-safe cache + robust WFDB path resolution

from scipy.signal import butter, filtfilt
import wfdb

CACHE_DIR = DATASETS_DIR / "ecg_preprocessed_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DTYPE = np.float16


def resolve_record_path(record_path):
    """Resolve WFDB record paths, including paths stored without .hea/.mat."""
    raw = str(record_path).strip().strip('"').strip("'")
    p = Path(raw)

    candidates = [
        p,
        PROJECT_ROOT / p,
        DATASETS_DIR / p,
        DATASETS_DIR / "WFDB_Ningbo" / p,
    ]

    # If the CSV contains a path without an extension, check the WFDB files.
    expanded = []
    for candidate in candidates:
        expanded.append(candidate)
        if candidate.suffix.lower() not in {".hea", ".mat", ".dat"}:
            expanded.extend([
                Path(str(candidate) + ".hea"),
                Path(str(candidate) + ".mat"),
                Path(str(candidate) + ".dat"),
            ])

    for candidate in expanded:
        if candidate.exists():
            # wfdb.rdrecord should receive the record stem, not .hea/.mat.
            if candidate.suffix.lower() in {".hea", ".mat", ".dat"}:
                return candidate.with_suffix("")
            return candidate

    raise FileNotFoundError(
        "ECG record not found. Checked path and WFDB extensions for: "
        f"{record_path}"
    )


def cache_file_for_record(record_path):
    record_path = resolve_record_path(record_path)
    try:
        relative = record_path.relative_to(DATASETS_DIR / "WFDB_Ningbo")
        name = "__".join(relative.parts)
    except ValueError:
        name = record_path.name
    return CACHE_DIR / f"{name}.npy"


def cache_size_gb():
    total = 0
    if CACHE_DIR.exists():
        for p in CACHE_DIR.glob("*.npy"):
            try:
                total += p.stat().st_size
            except FileNotFoundError:
                pass
    return total / (1024 ** 3)


def bandpass_filter(signal, lowcut=0.5, highcut=40.0, fs=500, order=3):
    nyquist = fs / 2
    b, a = butter(
        order,
        [lowcut / nyquist, highcut / nyquist],
        btype="band"
    )
    return filtfilt(b, a, signal, axis=0)


def normalize_ecg(signal):
    mean = np.mean(signal, axis=0, keepdims=True)
    std = np.std(signal, axis=0, keepdims=True)
    return (signal - mean) / (std + 1e-8)


def preprocess_ecg(record_path):
    record_path = resolve_record_path(record_path)
    record = wfdb.rdrecord(str(record_path))
    signal = record.p_signal.astype(np.float32)

    if signal.shape != (5000, 12):
        raise ValueError(
            f"{record_path}: expected (5000, 12), got {signal.shape}"
        )

    signal = bandpass_filter(signal, fs=record.fs)
    signal = normalize_ecg(signal)
    return signal.astype(np.float32)


def preprocess_ecg_cached(record_path):
    record_path = resolve_record_path(record_path)
    cache_file = cache_file_for_record(record_path)

    if cache_file.exists():
        try:
            arr = np.load(cache_file, allow_pickle=False)
            if arr.shape == (5000, 12) and arr.dtype == CACHE_DTYPE:
                result = arr.astype(np.float32, copy=True)
                del arr
                return result
            del arr
            cache_file.unlink(missing_ok=True)
        except Exception:
            try:
                cache_file.unlink(missing_ok=True)
            except Exception:
                pass

    processed = preprocess_ecg(record_path).astype(CACHE_DTYPE)
    tmp_file = CACHE_DIR / f".{cache_file.stem}.tmp.npy"

    try:
        np.save(tmp_file, processed)
        check = np.load(tmp_file, allow_pickle=False)
        if check.shape != (5000, 12) or check.dtype != CACHE_DTYPE:
            del check
            raise ValueError(f"Cache verification failed: {record_path}")
        del check
        tmp_file.replace(cache_file)
    finally:
        try:
            if tmp_file.exists():
                tmp_file.unlink()
        except PermissionError:
            pass

    return processed.astype(np.float32, copy=False)


# Quick path test before processing the full ECG set.
_test_record = paired_df["record_path"].iloc[0]
_resolved_test = resolve_record_path(_test_record)
print("ECG path test PASSED:", _resolved_test)

# Build ECG embeddings in SMALL batches.
# This avoids loading the complete ECG dataset into RAM.

ECG_BATCH_SIZE = 8
record_paths = paired_df["record_path"].tolist()
ecg_embeddings_parts = []

for start in range(0, len(record_paths), ECG_BATCH_SIZE):
    batch_paths = record_paths[start:start + ECG_BATCH_SIZE]

    batch_signals = np.stack([
        preprocess_ecg_cached(p)
        for p in batch_paths
    ]).astype(np.float32, copy=False)

    if batch_signals.ndim != 3 or batch_signals.shape[1:] != (5000, 12):
        raise RuntimeError(
            f"Invalid ECG batch shape: {batch_signals.shape}"
        )

    batch_embeddings = ecg_feature_extractor.predict(
        batch_signals,
        batch_size=ECG_BATCH_SIZE,
        verbose=0
    )

    ecg_embeddings_parts.append(batch_embeddings)
    del batch_signals

    if (start // ECG_BATCH_SIZE + 1) % 100 == 0 or start + len(batch_paths) == len(record_paths):
        print(
            f"Processed {min(start + len(batch_paths), len(record_paths))}/"
            f"{len(record_paths)} ECGs | Cache: {cache_size_gb():.2f} GB"
        )

if not ecg_embeddings_parts:
    raise RuntimeError("No ECG embeddings were generated.")

ecg_embeddings = np.concatenate(ecg_embeddings_parts, axis=0)

print("ECG embeddings shape:", ecg_embeddings.shape)
assert ecg_embeddings.ndim == 2
assert ecg_embeddings.shape[0] == len(paired_df)
assert ecg_embeddings.shape[1] == ecg_feature_extractor.output_shape[-1]
print("ECG embedding check PASSED.")

# 5. Concatenate and train the fusion classifier
# Concatenate the two frozen embeddings.

if len(clinical_embeddings) != len(ecg_embeddings):
    raise RuntimeError(
        f"Embedding row mismatch: clinical={len(clinical_embeddings)}, "
        f"ECG={len(ecg_embeddings)}"
    )

fused_embeddings = np.concatenate(
    [clinical_embeddings, ecg_embeddings],
    axis=1
)

labels = paired_df["label"].values.astype("float32")

print("Clinical embedding shape:", clinical_embeddings.shape)
print("ECG embedding shape:", ecg_embeddings.shape)
print("Fused embedding shape:", fused_embeddings.shape)

from sklearn.model_selection import train_test_split

# Keep a held-out test set untouched during training.
X_trainval_f, X_test_f, y_trainval_f, y_test_f = train_test_split(
    fused_embeddings,
    labels,
    test_size=0.20,
    random_state=42,
    stratify=labels
)

# Split the remaining 80% into training and validation sets.
X_train_f, X_val_f, y_train_f, y_val_f = train_test_split(
    X_trainval_f,
    y_trainval_f,
    test_size=0.20,
    random_state=42,
    stratify=y_trainval_f
)

print("Fusion train shape:", X_train_f.shape)
print("Fusion validation shape:", X_val_f.shape)
print("Fusion test shape:", X_test_f.shape)

# Sanity checks before training the fusion classifier.

assert len(clinical_embeddings) == len(ecg_embeddings)
assert len(labels) == len(ecg_embeddings)
assert clinical_embeddings.ndim == 2
assert ecg_embeddings.ndim == 2
assert fused_embeddings.ndim == 2

print("All fusion shape checks PASSED.")
print("Clinical:", clinical_embeddings.shape)
print("ECG:", ecg_embeddings.shape)
print("Fused:", fused_embeddings.shape)

fusion_model = tf.keras.Sequential([
    layers.Input(shape=(fused_embeddings.shape[1],)),
    layers.Dense(64, activation="relu"),
    layers.Dropout(0.3),
    layers.Dense(32, activation="relu"),
    layers.Dense(1, activation="sigmoid")
], name="Fusion_Classifier")

fusion_model.compile(
    optimizer="adam",
    loss="binary_crossentropy",
    metrics=["accuracy", tf.keras.metrics.AUC(name="auc")]
)

fusion_model.summary()
callbacks = [
    tf.keras.callbacks.EarlyStopping(
        monitor="val_auc",
        mode="max",
        patience=5,
        restore_best_weights=True,
        verbose=1
    ),
    tf.keras.callbacks.ReduceLROnPlateau(
        monitor="val_auc",
        mode="max",
        factor=0.5,
        patience=2,
        min_lr=1e-6,
        verbose=1
    )
]

history = fusion_model.fit(
    X_train_f,
    y_train_f,
    validation_data=(X_val_f, y_val_f),
    epochs=30,
    batch_size=32,
    callbacks=callbacks,
    verbose=1
)

# 6. Evaluate

# Remember the caveat from the top of this notebook — these numbers reflect a label-matched, not patient-matched, pairing.
from sklearn.metrics import (
    classification_report,
    roc_auc_score,
    confusion_matrix
)

y_prob_f = fusion_model.predict(
    X_test_f,
    verbose=0
).ravel()

y_pred_f = (
    y_prob_f >= 0.5
).astype(int)

print(
    classification_report(
        y_test_f,
        y_pred_f,
        target_names=[
            "Normal/No CVD",
            "Abnormal/CVD"
        ]
    )
)

print(
    "ROC-AUC:",
    round(
        roc_auc_score(
            y_test_f,
            y_prob_f
        ),
        4
    )
)

print("Confusion matrix:")
print(
    confusion_matrix(
        y_test_f,
        y_pred_f
    )
)

print(
    "\nIMPORTANT: These metrics are only an "
    "end-to-end architecture/smoke test."
)
print(
    "They are NOT valid patient-level multimodal "
    "CVD performance because the clinical and ECG "
    "records were paired by label, not by patient ID."
)

# 7. Save the fusion model
fusion_model_path = MODELS_DIR / "fusion_classifier.keras"

fusion_model.save(
    fusion_model_path
)

metadata = {
    "model": "Clinical Embedding + ECG Embedding Fusion Classifier",
    "clinical_embedding_dim": int(clinical_embeddings.shape[1]),
    "ecg_embedding_dim": int(ecg_embeddings.shape[1]),
    "fused_embedding_dim": int(fused_embeddings.shape[1]),
    "ecg_input_shape": [5000, 12],
    "clinical_features": clinical_features,
    "ecg_cache_dtype": "float16",
    "pairing_method": "label-matched synthetic pairing",
    "patient_level_multimodal": False,
    "warning": (
        "Clinical and ECG datasets do not share patient IDs. "
        "Metrics from this notebook must not be reported as "
        "real patient-level multimodal performance."
    )
}

metadata_path = MODELS_DIR / "fusion_classifier_metadata.json"

with open(
    metadata_path,
    "w",
    encoding="utf-8"
) as f:
    json.dump(
        metadata,
        f,
        indent=2,
        default=str
    )

print("Fusion model saved:", fusion_model_path)
print("Fusion metadata saved:", metadata_path)
