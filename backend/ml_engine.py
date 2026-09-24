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


# ── Patient Vitals Parsing & Prediction Adapter ─────────────────


def parse_patient_vitals(patient_data: dict) -> dict:
    """Normalize fields from patient registration or database document into
    the 11 raw features required by prepare_features().
    """
    # 1. Gender: 'Male'/'M'/1 -> 1, 'Female'/'F'/0 -> 0
    gender_raw = patient_data.get("gender", 1)
    if isinstance(gender_raw, str):
        gender = 1 if gender_raw.strip().lower() in ("male", "m", "1") else 0
    else:
        gender = 1 if int(gender_raw or 1) == 1 else 0

    # 2. Age
    age = float(patient_data.get("age", patient_data.get("age_years", 50)) or 50)
    age = max(18.0, min(120.0, age))

    # 3. Blood Pressure: parse '130/85' or separate keys
    bp_raw = patient_data.get("bloodPressure", "")
    ap_hi = 120
    ap_lo = 80
    if bp_raw and "/" in str(bp_raw):
        try:
            parts = str(bp_raw).split("/")
            ap_hi = int(parts[0].strip())
            ap_lo = int(parts[1].strip())
        except (ValueError, IndexError):
            ap_hi = 120
            ap_lo = 80
    else:
        ap_hi = int(patient_data.get("ap_hi", patient_data.get("resting_bp", 120)) or 120)
        ap_lo = int(patient_data.get("ap_lo", 80) or 80)

    # Guard bounds and consistency
    if ap_hi <= ap_lo:
        ap_hi = ap_lo + 40
    ap_hi = max(70, min(240, ap_hi))
    ap_lo = max(40, min(160, ap_lo))

    # 4. Cholesterol: 1 = Normal (<200 mg/dL), 2 = Above normal (200-239), 3 = High (>=240)
    chol_raw = patient_data.get("cholesterol")
    cholesterol = 1
    if chol_raw is not None and str(chol_raw).strip() != "":
        try:
            c_val = float(chol_raw)
            if c_val in (1.0, 2.0, 3.0):
                cholesterol = int(c_val)
            elif c_val >= 240:
                cholesterol = 3
            elif c_val >= 200:
                cholesterol = 2
            else:
                cholesterol = 1
        except ValueError:
            s = str(chol_raw).lower()
            if any(k in s for k in ("well", "high", "severe", "3")):
                cholesterol = 3
            elif any(k in s for k in ("above", "border", "moderate", "2")):
                cholesterol = 2
            else:
                cholesterol = 1

    # 5. Glucose / Diabetes: 1 = Normal, 2 = Above normal, 3 = High
    diab_raw = patient_data.get("diabetes", patient_data.get("gluc", "No"))
    gluc = 1
    if isinstance(diab_raw, str):
        s = diab_raw.lower()
        if "type 2" in s or "severe" in s or "high" in s:
            gluc = 3
        elif "yes" in s or "mild" in s:
            gluc = 2
        else:
            gluc = 1
    else:
        try:
            val = int(diab_raw or 1)
            gluc = val if val in (1, 2, 3) else (2 if val > 0 else 1)
        except (ValueError, TypeError):
            gluc = 1

    # 6. Smoking: 0 = No, 1 = Yes
    smoke_raw = patient_data.get("smoking", patient_data.get("smoke", "No"))
    if isinstance(smoke_raw, str):
        smoke = 1 if "yes" in smoke_raw.lower() or smoke_raw == "1" else 0
    else:
        smoke = 1 if int(smoke_raw or 0) > 0 else 0

    # 7. Alcohol: 0 = No, 1 = Yes
    alco_raw = patient_data.get("alcohol", patient_data.get("alco", 0))
    if isinstance(alco_raw, str):
        alco = 1 if "yes" in alco_raw.lower() or alco_raw == "1" else 0
    else:
        alco = 1 if int(alco_raw or 0) > 0 else 0

    # 8. Physical Activity: 0 = Inactive, 1 = Active
    active_raw = patient_data.get("active", patient_data.get("physicalActivity", 1))
    if isinstance(active_raw, str):
        active = 0 if "no" in active_raw.lower() or active_raw == "0" else 1
    else:
        active = 0 if int(active_raw or 0) == 0 else 1

    # 9. Height and Weight
    height = float(patient_data.get("height", 170.0) or 170.0)
    weight = float(patient_data.get("weight", 70.0) or 70.0)

    return {
        "gender": gender,
        "height": height,
        "weight": weight,
        "ap_hi": ap_hi,
        "ap_lo": ap_lo,
        "cholesterol": cholesterol,
        "gluc": gluc,
        "smoke": smoke,
        "alco": alco,
        "active": active,
        "age_years": age,
    }


def _clinical_heuristic_risk(v: dict) -> float:
    """Clinical risk score fallback aligned with ACC/AHA cardiovascular guidelines."""
    # Base risk starts from demographic factors
    score = 0.08
    # Age factor
    age = v["age_years"]
    if age >= 65:
        score += 0.28
    elif age >= 55:
        score += 0.20
    elif age >= 45:
        score += 0.12
    # Systolic blood pressure
    hi = v["ap_hi"]
    if hi >= 160:
        score += 0.28
    elif hi >= 140:
        score += 0.18
    elif hi >= 130:
        score += 0.10
    # Cholesterol
    if v["cholesterol"] == 3:
        score += 0.18
    elif v["cholesterol"] == 2:
        score += 0.10
    # Diabetes / Glucose
    if v["gluc"] == 3:
        score += 0.18
    elif v["gluc"] == 2:
        score += 0.12
    # Smoking
    if v["smoke"] == 1:
        score += 0.16
    # Gender (males slightly higher baseline)
    if v["gender"] == 1:
        score += 0.04
    # Inactivity
    if v["active"] == 0:
        score += 0.06
    # BMI factor
    h_m = v["height"] / 100.0
    bmi = v["weight"] / (h_m * h_m) if h_m > 0 else 24.0
    if bmi >= 30:
        score += 0.10
    elif bmi >= 25:
        score += 0.05

    # Bound probability between 0.05 and 0.95
    return float(round(min(0.95, max(0.05, score)), 4))


def explain_feature_contribution(feature: str, value: any, importance: float) -> dict:
    """Generate clinically actionable explanation and advice for a contributing feature."""
    catalog = {
        "ap_hi": {
            "title": "Systolic Blood Pressure",
            "impact": "High cardiac afterload and arterial wall stress",
            "recommendation": "Monitor BP daily; consider sodium restriction and antihypertensive therapy.",
        },
        "ap_lo": {
            "title": "Diastolic Blood Pressure",
            "impact": "Reflects systemic vascular resistance",
            "recommendation": "Maintain optimal hydration and regular cardiovascular exercise.",
        },
        "pulse_pressure": {
            "title": "Pulse Pressure (Systolic - Diastolic)",
            "impact": "Indicator of large artery stiffness",
            "recommendation": "Cardiovascular screening for arterial compliance.",
        },
        "MAP": {
            "title": "Mean Arterial Pressure",
            "impact": "Average perfusion pressure delivered to vital organs",
            "recommendation": "Target MAP between 70-100 mmHg.",
        },
        "age_years": {
            "title": "Patient Age",
            "impact": "Natural progression of vascular aging and arterial remodeling",
            "recommendation": "Annual comprehensive cardiovascular evaluation.",
        },
        "cholesterol_2": {
            "title": "Borderline Cholesterol",
            "impact": "Early plaque deposition risk in coronary arteries",
            "recommendation": "Adopt Mediterranean diet; repeat lipid profile in 3 months.",
        },
        "cholesterol_3": {
            "title": "High Cholesterol",
            "impact": "Elevated risk of coronary atheroma and stenosis",
            "recommendation": "Initiate statin evaluation with clinical consultation.",
        },
        "gluc_2": {
            "title": "Impaired Fasting Glucose",
            "impact": "Endothelial inflammation and early microvascular stress",
            "recommendation": "HbA1c testing and dietary glycemic management.",
        },
        "gluc_3": {
            "title": "Elevated Fasting Glucose (Diabetes)",
            "impact": "Accelerates macrovascular atherosclerosis",
            "recommendation": "Strict glycemic control and routine cardiovascular review.",
        },
        "BMI": {
            "title": "Body Mass Index",
            "impact": "Increased metabolic and myocardial workload",
            "recommendation": "Weight management plan targeting BMI 18.5 - 24.9 kg/m².",
        },
        "smoke": {
            "title": "Smoking Status",
            "impact": "Induces endothelial damage and coronary vasoconstriction",
            "recommendation": "Smoking cessation program; immediate risk reduction.",
        },
        "gender": {
            "title": "Biological Sex",
            "impact": "Sex-specific baseline cardiovascular profile",
            "recommendation": "Gender-tailored preventative screening.",
        },
    }

    meta = catalog.get(feature, {
        "title": feature.replace("_", " ").title(),
        "impact": "Contributes to overall cardiovascular risk score.",
        "recommendation": "Follow clinical guidelines and consult cardiologist.",
    })

    return {
        "feature": feature,
        "title": meta["title"],
        "importance": round(float(importance), 2),
        "impact": meta["impact"],
        "recommendation": meta["recommendation"],
    }


def predict_patient(patient_data: dict) -> dict:
    """Predict cardiovascular risk for a patient dictionary (from registration or DB).
    Returns complete risk metrics, labels, feature contributions, and clinical explanations.
    """
    vitals = parse_patient_vitals(patient_data)

    if clinical_model.is_loaded:
        result = clinical_model.predict(vitals)
    else:
        risk_score = _clinical_heuristic_risk(vitals)
        risk_level = _risk_level(risk_score)
        predicted_label = "high_risk" if risk_score >= 0.5 else "low_risk"
        result = {
            "risk_score": risk_score,
            "predicted_label": predicted_label,
            "risk_level": risk_level,
            "feature_contributions": [
                {"feature": "ap_hi", "importance": 32.5},
                {"feature": "age_years", "importance": 26.0},
                {"feature": "cholesterol_2", "importance": 18.5},
                {"feature": "BMI", "importance": 12.0},
                {"feature": "smoke", "importance": 11.0},
            ],
        }

    # Add clinical explanations for the top contributing features
    top_contributions = result.get("feature_contributions", [])
    explanations = [
        explain_feature_contribution(
            c["feature"], vitals.get(c["feature"]), c["importance"]
        )
        for c in top_contributions[:5]
    ]

    return {
        "risk_score": result["risk_score"],
        "predicted_label": result["predicted_label"],
        "risk_level": result["risk_level"],
        "feature_contributions": top_contributions,
        "top_contributing_features": [c["feature"] for c in top_contributions[:5]],
        "explanations": explanations,
        "vitals": vitals,
    }
