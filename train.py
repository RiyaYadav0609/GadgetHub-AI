"""Train, evaluate and persist GadgetHub fraud models.
Run from backend: python -m app.ml.train
"""
from __future__ import annotations
import json
import platform
from datetime import datetime, timezone
from pathlib import Path
import joblib
import sklearn
import xgboost
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.metrics import (accuracy_score, average_precision_score, confusion_matrix,
    f1_score, precision_score, recall_score, roc_auc_score)
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier
from app.ml.features import FEATURES, FEATURE_LABELS
from app.ml.generate_dataset import generate_dataset

ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "data" / "gadgethub_synthetic_transactions.csv"
MODEL_DIR = ROOT / "models"
REPORT_DIR = ROOT / "reports"


def safe_auc(fn, y, p):
    try:
        return float(fn(y, p))
    except Exception:
        return None


def evaluate(y_true, probabilities, threshold=0.5):
    predictions = (probabilities >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, predictions, labels=[0, 1]).ravel()
    return {
        "threshold": threshold,
        "accuracy": float(accuracy_score(y_true, predictions)),
        "precision": float(precision_score(y_true, predictions, zero_division=0)),
        "recall": float(recall_score(y_true, predictions, zero_division=0)),
        "f1": float(f1_score(y_true, predictions, zero_division=0)),
        "roc_auc": safe_auc(roc_auc_score, y_true, probabilities),
        "pr_auc": safe_auc(average_precision_score, y_true, probabilities),
        "confusion_matrix": {"true_negative": int(tn), "false_positive": int(fp),
                             "false_negative": int(fn), "true_positive": int(tp)},
        "support": {"legitimate": int((np.asarray(y_true) == 0).sum()),
                    "fraud": int((np.asarray(y_true) == 1).sum())},
    }


def train():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    if DATA_PATH.exists():
        df = pd.read_csv(DATA_PATH)
    else:
        df = generate_dataset()
        DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(DATA_PATH, index=False)

    X = df[FEATURES].astype(float)
    y = df["is_fraud"].astype(int)
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.30, random_state=42, stratify=y)
    X_valid, X_test, y_valid, y_test = train_test_split(
        X_temp, y_temp, test_size=0.50, random_state=42, stratify=y_temp)

    rf = RandomForestClassifier(n_estimators=350, max_depth=13, min_samples_leaf=3,
        class_weight="balanced_subsample", n_jobs=-1, random_state=42)
    rf.fit(X_train, y_train)

    # Scale positive-class weight to reduce the effect of class imbalance.
    neg, pos = np.bincount(y_train, minlength=2)
    xgb = XGBClassifier(n_estimators=350, max_depth=5, learning_rate=0.045,
        subsample=0.85, colsample_bytree=0.85, reg_lambda=2.0,
        scale_pos_weight=float(neg / max(pos, 1)), eval_metric="logloss",
        tree_method="hist", random_state=42, n_jobs=4)
    xgb.fit(X_train, y_train, eval_set=[(X_valid, y_valid)], verbose=False)

    # Unsupervised anomaly model: trained on training partition only.
    iso = IsolationForest(n_estimators=250, contamination=float(y_train.mean()),
        random_state=42, n_jobs=-1)
    iso.fit(X_train)

    rf_valid = rf.predict_proba(X_valid)[:, 1]
    xgb_valid = xgb.predict_proba(X_valid)[:, 1]
    valid_ensemble = (0.45 * rf_valid) + (0.55 * xgb_valid)
    # Select the operating threshold on validation data only, never on test labels.
    candidates = np.linspace(0.10, 0.80, 71)
    threshold = float(max(candidates, key=lambda t: f1_score(y_valid, (valid_ensemble >= t).astype(int), zero_division=0)))
    rf_p = rf.predict_proba(X_test)[:, 1]
    xgb_p = xgb.predict_proba(X_test)[:, 1]
    ensemble_p = (0.45 * rf_p) + (0.55 * xgb_p)
    rf_metrics = evaluate(y_test, rf_p, threshold)
    xgb_metrics = evaluate(y_test, xgb_p, threshold)
    ensemble_metrics = evaluate(y_test, ensemble_p, threshold)

    # Anomaly score is a separate signal, not treated as a supervised probability.
    anomaly_raw = -iso.score_samples(X_test)
    anomaly_min, anomaly_max = float(anomaly_raw.min()), float(anomaly_raw.max())

    importances = (0.45 * np.asarray(rf.feature_importances_) +
                   0.55 * np.asarray(xgb.feature_importances_))
    feature_importance = [{"feature": name, "label": FEATURE_LABELS.get(name, name),
                           "importance": float(value)}
                          for name, value in sorted(zip(FEATURES, importances),
                                                    key=lambda x: x[1], reverse=True)]

    bundle = {"random_forest": rf, "xgboost": xgb, "isolation_forest": iso,
              "features": FEATURES, "ensemble_weights": {"random_forest": 0.45, "xgboost": 0.55},
              "decision_threshold": threshold,
              "anomaly_range": {"min": anomaly_min, "max": anomaly_max}}
    joblib.dump(bundle, MODEL_DIR / "gadgethub_fraud_models.joblib", compress=3)

    report = {
        "model_version": "1.0.0",
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
        "training_environment": {"python": platform.python_version(), "pandas": pd.__version__,
                               "numpy": np.__version__, "scikit_learn": sklearn.__version__,
                               "xgboost": xgboost.__version__, "joblib": joblib.__version__},
        "data_origin": "synthetic_demo_dataset",
        "dataset_rows": int(len(df)),
        "fraud_prevalence": float(y.mean()),
        "split": {"train": int(len(X_train)), "validation": int(len(X_valid)), "test": int(len(X_test))},
        "threshold_selection": "Maximum F1 on validation partition; reported once on held-out test partition",
        "models": {"random_forest": rf_metrics, "xgboost": xgb_metrics,
                   "ensemble": ensemble_metrics},
        "feature_importance": feature_importance,
        "limitations": [
            "All labels are synthetic and generated from simulated risk patterns.",
            "Metrics are an internal held-out synthetic test split, not real merchant performance.",
            "Production thresholds require time-based validation on confirmed outcomes.",
            "Isolation Forest anomaly scores are not calibrated fraud probabilities."
        ]
    }
    (REPORT_DIR / "ml_evaluation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    metadata = {"model_version": report["model_version"], "trained_at_utc": report["trained_at_utc"],
        "data_origin": report["data_origin"], "dataset_rows": report["dataset_rows"],
        "features": FEATURES, "model_files": ["gadgethub_fraud_models.joblib"],
        "primary_model": "weighted_ensemble_random_forest_xgboost", "status": "trained_demo"}
    (MODEL_DIR / "model_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps({"saved_model": str(MODEL_DIR / 'gadgethub_fraud_models.joblib'),
                      "evaluation": str(REPORT_DIR / 'ml_evaluation.json'),
                      "ensemble_test_metrics": ensemble_metrics}, indent=2))
    return report


if __name__ == "__main__":
    train()
