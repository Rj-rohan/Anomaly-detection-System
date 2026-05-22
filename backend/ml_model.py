"""
ML Model — Isolation Forest per user.
Trains on login history, predicts anomaly score for new logins.
"""
import os, joblib, numpy as np
from pathlib import Path
from sklearn.ensemble import IsolationForest

MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(exist_ok=True)

MIN_SAMPLES = 10          # need at least this many logs before ML activates
CONTAMINATION = 0.1       # expect ~10% anomalies in training data


def _model_path(user_id: str) -> Path:
    return MODELS_DIR / f"{user_id}.pkl"


def extract_features(log: dict, profile: dict = None) -> list:
    """
    Convert a login log dict into a feature vector.
    Features:
      0  hour            (0-23)
      1  day_of_week     (0=Mon … 6=Sun)
      2  is_failed       (0/1)
      3  failed_last_10m (count)
      4  logins_last_24h (count)
      5  is_new_device   (0/1)
      6  is_new_location (0/1)
    """
    from datetime import datetime
    ts = log.get("timestamp", "")
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        dt = datetime.utcnow()

    hour        = dt.hour
    dow         = dt.weekday()
    is_failed   = 1 if log.get("status") == "failed" else 0
    failed_10m  = log.get("failed_last_10m", 0)
    logins_24h  = log.get("logins_last_24h", 1)

    known_devices   = (profile or {}).get("known_devices") or []
    known_locations = (profile or {}).get("known_locations") or []
    device   = log.get("device", "Unknown")
    location = log.get("location", "Unknown")

    is_new_device   = 0 if (not known_devices or device in known_devices or device == "Unknown") else 1
    is_new_location = 0 if (not known_locations or location in known_locations or location == "Unknown") else 1

    return [hour, dow, is_failed, failed_10m, logins_24h, is_new_device, is_new_location]


def train(user_id: str, logs: list, profile: dict = None):
    """Train Isolation Forest on user's login history and save model."""
    if len(logs) < MIN_SAMPLES:
        return False

    X = [extract_features(l, profile) for l in logs]
    X = np.array(X, dtype=float)

    model = IsolationForest(
        n_estimators=100,
        contamination=CONTAMINATION,
        random_state=42,
    )
    model.fit(X)
    joblib.dump(model, _model_path(user_id))
    return True


def predict(user_id: str, log: dict, profile: dict = None) -> dict:
    """
    Predict anomaly for a single login.
    Returns:
      {
        "ml_score": 0-40,          # risk contribution
        "is_anomaly": True/False,
        "anomaly_score": float,    # raw IF score (-1 to 1, lower = more anomalous)
        "active": True/False       # False if model not trained yet
      }
    """
    path = _model_path(user_id)
    if not path.exists():
        return {"ml_score": 0, "is_anomaly": False, "anomaly_score": 0.0, "active": False}

    model = joblib.load(path)
    features = extract_features(log, profile)
    X = np.array([features], dtype=float)

    # decision_function: negative = anomalous, positive = normal
    raw_score = model.decision_function(X)[0]        # typically -0.5 to 0.5
    prediction = model.predict(X)[0]                 # -1 = anomaly, 1 = normal
    is_anomaly = prediction == -1

    # Normalize raw_score to 0-40 risk contribution
    # raw_score range roughly -0.5 (very anomalous) to 0.5 (very normal)
    # Map: -0.5 → 40,  0.0 → 20,  0.5 → 0
    ml_score = int(max(0, min(40, (-raw_score + 0.5) * 40)))

    return {
        "ml_score": ml_score,
        "is_anomaly": is_anomaly,
        "anomaly_score": round(float(raw_score), 4),
        "active": True,
    }
