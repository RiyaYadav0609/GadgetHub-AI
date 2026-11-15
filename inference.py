from __future__ import annotations
import json
from pathlib import Path
from functools import lru_cache
import joblib
import numpy as np
import pandas as pd
from app.ml.features import FEATURES

ROOT = Path(__file__).resolve().parents[2]
MODEL_PATH = ROOT / "models" / "gadgethub_fraud_models.joblib"
REPORT_PATH = ROOT / "reports" / "ml_evaluation.json"
META_PATH = ROOT / "models" / "model_metadata.json"

@lru_cache(maxsize=1)
def load_bundle():
    if not MODEL_PATH.exists():
        return None
    return joblib.load(MODEL_PATH)

def model_status():
    bundle = load_bundle()
    metadata = json.loads(META_PATH.read_text(encoding="utf-8")) if META_PATH.exists() else {}
    report = json.loads(REPORT_PATH.read_text(encoding="utf-8")) if REPORT_PATH.exists() else {}
    return {"trained": bundle is not None, "metadata": metadata,
            "evaluation": report, "message": "Trained synthetic-demo models loaded" if bundle else
            "No trained model found. Run: python -m app.ml.train"}

def predict_ml(payload: dict):
    bundle = load_bundle()
    if bundle is None:
        return None
    row = {feature: payload.get(feature, 0) for feature in FEATURES}
    frame = pd.DataFrame([row], columns=FEATURES).astype(float)
    rf_probability = float(bundle["random_forest"].predict_proba(frame)[0, 1])
    xgb_probability = float(bundle["xgboost"].predict_proba(frame)[0, 1])
    weights = bundle.get("ensemble_weights", {"random_forest": 0.45, "xgboost": 0.55})
    probability = (weights["random_forest"] * rf_probability +
                   weights["xgboost"] * xgb_probability)
    anomaly_raw = float(-bundle["isolation_forest"].score_samples(frame)[0])
    limits = bundle.get("anomaly_range", {"min": 0, "max": 1})
    anomaly_score = float(np.clip((anomaly_raw - limits["min"]) /
        max(limits["max"] - limits["min"], 1e-9), 0, 1))
    # The anomaly score is a separate, uncalibrated signal; it contributes only 10% to
    # the operational risk score and is never presented as a fraud probability.
    blended_risk_score = round((0.90 * probability + 0.10 * anomaly_score) * 100)
    return {"fraud_probability": probability, "risk_score": blended_risk_score,
            "decision_threshold": float(bundle.get("decision_threshold", 0.5)),
            "random_forest_probability": rf_probability,
            "xgboost_probability": xgb_probability,
            "anomaly_score": anomaly_score, "model_version": "1.0.0",
            "model_type": "weighted_random_forest_xgboost_ensemble"}
