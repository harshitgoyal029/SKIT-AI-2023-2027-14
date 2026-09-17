"""
Clinical DNN inference engine — pure numpy, no TensorFlow needed.

Loads the trained model weights from clinical_dnn.keras (HDF5/zip),
the StandardScaler from clinical_scaler.pkl, and the feature list
from clinical_features.pkl.  Replicates the exact feature-engineering
pipeline used during training so that predictions are consistent.

Sprint 2(B): Initial prediction pipeline.
"""

import os
import tempfile
import zipfile
from pathlib import Path
import warnings

import h5py
import joblib
import numpy as np

# Suppress sklearn feature name and version warnings during inference
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")

# ── Paths ────────────────────────────────────────────────────────

_MODELS_DIR = Path(__file__).resolve().parent.parent / "Trained Models"
_KERAS_PATH = _MODELS_DIR / "clinical_dnn.keras"
_SCALER_PATH = _MODELS_DIR / "clinical_scaler.pkl"
_FEATURES_PATH = _MODELS_DIR / "clinical_features.pkl"

# ── Feature list the model was trained on ────────────────────────

EXPECTED_FEATURES: list[str] = [
    "gender", "height", "weight", "ap_hi", "ap_lo",
    "smoke", "alco", "active", "age_years", "BMI",
    "pulse_pressure", "MAP",
    "cholesterol_2", "cholesterol_3",
    "gluc_2", "gluc_3",
]


# ── Activation functions ─────────────────────────────────────────


def _relu(x: np.ndarray) -> np.ndarray:
    return np.maximum(0, x)


def _sigmoid(x: np.ndarray) -> np.ndarray:
    # Clip to avoid overflow in exp
    x = np.clip(x, -500, 500)
    return 1.0 / (1.0 + np.exp(-x))


# ── Weight extraction from .keras file ───────────────────────────


def _load_weights(keras_path: Path) -> list[tuple[np.ndarray, np.ndarray]]:
    """Extract Dense layer weights from a .keras archive.

    Returns a list of (kernel, bias) tuples, one per Dense layer,
    in network order.
    """
    tmpdir = tempfile.mkdtemp()
    with zipfile.ZipFile(keras_path, "r") as zf:
        zf.extract("model.weights.h5", tmpdir)

    h5_path = os.path.join(tmpdir, "model.weights.h5")
    weights: list[tuple[np.ndarray, np.ndarray]] = []

    with h5py.File(h5_path, "r") as f:
        # Dense layers are named dense, dense_1, dense_2, dense_3
        layer_names = ["dense", "dense_1", "dense_2", "dense_3"]
        for name in layer_names:
            layer_vars = f["layers"][name]["vars"]
            kernel = np.array(layer_vars["0"])  # shape: (in, out)
            bias = np.array(layer_vars["1"])    # shape: (out,)
            weights.append((kernel, bias))

    return weights


# ── Model class ──────────────────────────────────────────────────


class ClinicalDNN:
    """Lightweight DNN inference using raw numpy.

    Architecture (from training notebook):
        Dense(64, relu) → Dropout(0.3)   ← dropout is no-op at inference
        Dense(32, relu) → Dropout(0.2)   ← dropout is no-op at inference
        Dense(16, relu)
        Dense(1, sigmoid)
    """

    def __init__(self) -> None:
        self.weights: list[tuple[np.ndarray, np.ndarray]] = []
        self.scaler = None
        self.feature_names: list[str] = []
        self._loaded = False

    def load(self) -> None:
        """Load model weights, scaler, and feature list from disk."""
        if not _KERAS_PATH.exists():
            raise FileNotFoundError(f"Model file not found: {_KERAS_PATH}")
        if not _SCALER_PATH.exists():
            raise FileNotFoundError(f"Scaler file not found: {_SCALER_PATH}")
        if not _FEATURES_PATH.exists():
            raise FileNotFoundError(f"Features file not found: {_FEATURES_PATH}")

        self.weights = _load_weights(_KERAS_PATH)
        self.scaler = joblib.load(_SCALER_PATH)
        self.feature_names = joblib.load(_FEATURES_PATH)
        self._loaded = True

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def forward(self, x: np.ndarray) -> np.ndarray:
        """Run a forward pass through the DNN.

        Args:
            x: Input array of shape (n_samples, 16).

        Returns:
            Predicted probabilities of shape (n_samples,).
        """
        # Layer 0: Dense(64, relu)
        x = _relu(x @ self.weights[0][0] + self.weights[0][1])
        # Layer 1: Dense(32, relu)  (Dropout is no-op at inference)
        x = _relu(x @ self.weights[1][0] + self.weights[1][1])
        # Layer 2: Dense(16, relu)
        x = _relu(x @ self.weights[2][0] + self.weights[2][1])
        # Layer 3: Dense(1, sigmoid)
        x = _sigmoid(x @ self.weights[3][0] + self.weights[3][1])
        return x.ravel()

    def predict(self, features: dict) -> dict:
        """Run prediction on a single patient's clinical data.

        Args:
            features: Dict with keys matching the API input schema.

        Returns:
            Dict with risk_score, predicted_label, risk_level, and
            feature_contributions.
        """
        if not self._loaded:
            raise RuntimeError("Model not loaded. Call load() first.")

        feature_vector = prepare_features(features)
        scaled = self.scaler.transform(feature_vector.reshape(1, -1))
        prob = self.forward(scaled)[0]

        risk_score = float(round(prob, 4))
        predicted_label = "high_risk" if risk_score >= 0.5 else "low_risk"
        risk_level = _risk_level(risk_score)
        contributions = _feature_contributions(
            feature_vector, self.scaler, self.weights, self.feature_names
        )

        return {
            "risk_score": risk_score,
            "predicted_label": predicted_label,
            "risk_level": risk_level,
            "feature_contributions": contributions,
        }


# ── Feature engineering ──────────────────────────────────────────


def prepare_features(data: dict) -> np.ndarray:
    """Build the 16-element feature vector from raw patient input.

    Replicates the exact transformations applied during training:
      - gender: passed through (0 or 1)
      - age_years: passed through (API accepts years directly)
      - BMI: weight / (height_cm / 100)²
      - pulse_pressure: ap_hi - ap_lo
      - MAP: (ap_hi + 2 * ap_lo) / 3
      - cholesterol: one-hot → cholesterol_2, cholesterol_3
      - gluc: one-hot → gluc_2, gluc_3

    Args:
        data: Dict with keys: gender, height, weight, ap_hi, ap_lo,
              cholesterol, gluc, smoke, alco, active, age_years.

    Returns:
        numpy array of shape (16,) in EXPECTED_FEATURES order.
    """
    height_cm = float(data["height"])
    weight_kg = float(data["weight"])
    ap_hi = float(data["ap_hi"])
    ap_lo = float(data["ap_lo"])
    cholesterol = int(data["cholesterol"])
    gluc = int(data["gluc"])

    # Derived features
    bmi = weight_kg / ((height_cm / 100) ** 2) if height_cm > 0 else 0.0
    pulse_pressure = ap_hi - ap_lo
    mean_arterial_pressure = (ap_hi + 2 * ap_lo) / 3

    # One-hot encoding (drop_first=True, so category 1 is the baseline)
    cholesterol_2 = 1 if cholesterol == 2 else 0
    cholesterol_3 = 1 if cholesterol == 3 else 0
    gluc_2 = 1 if gluc == 2 else 0
    gluc_3 = 1 if gluc == 3 else 0

    # Build feature vector in training order
    vector = np.array([
        float(data["gender"]),
        height_cm,
        weight_kg,
        ap_hi,
        ap_lo,
        float(data["smoke"]),
        float(data["alco"]),
        float(data["active"]),
        float(data["age_years"]),
        bmi,
        pulse_pressure,
        mean_arterial_pressure,
        cholesterol_2,
        cholesterol_3,
        gluc_2,
        gluc_3,
    ], dtype=np.float64)

    return vector


# ── Helpers ──────────────────────────────────────────────────────


def _risk_level(score: float) -> str:
    """Map a 0–1 risk score to a human-readable level."""
    if score < 0.3:
        return "Low Risk"
    elif score < 0.5:
        return "Moderate Risk"
    elif score < 0.7:
        return "High Risk"
    else:
        return "Very High Risk"


def _feature_contributions(
    raw_vector: np.ndarray,
    scaler,
    weights: list[tuple[np.ndarray, np.ndarray]],
    feature_names: list[str],
) -> list[dict]:
    """Estimate each feature's contribution using input × first-layer weight.

    This is a lightweight approximation (not full SHAP), useful for
    giving patients a quick summary of which features mattered most.
    """
    # Scale the input
    scaled = scaler.transform(raw_vector.reshape(1, -1)).ravel()

    # Use absolute value of (scaled_input × first-layer kernel mean)
    first_kernel = weights[0][0]  # shape (16, 64)
    importance = np.abs(scaled * np.mean(np.abs(first_kernel), axis=1))

    # Normalize to percentages
    total = importance.sum()
    if total == 0:
        total = 1.0

    contributions = []
    for name, imp in zip(feature_names, importance):
        contributions.append({
            "feature": name,
            "importance": round(float(imp / total) * 100, 2),
        })

    # Sort by importance (descending)
    contributions.sort(key=lambda x: x["importance"], reverse=True)
    return contributions


# ── Singleton ────────────────────────────────────────────────────

# One global instance, loaded once at startup.
clinical_model = ClinicalDNN()
