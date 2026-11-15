
"""Memory-efficient IEEE-CIS fraud benchmark training.

Run from backend:
    python -m app.ml.train_ieee

This model is kept separate from the GadgetHub operational model.
"""

from __future__ import annotations

import gc
import json
import platform
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
import xgboost

from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier


ROOT = Path(__file__).resolve().parents[2]

DATA_PATH = ROOT / "data" / "train_transaction.csv"
MODEL_DIR = ROOT / "models"
REPORT_DIR = ROOT / "reports"

MODEL_PATH = MODEL_DIR / "ieee_cis_benchmark.joblib"
REPORT_PATH = REPORT_DIR / "ieee_cis_evaluation.json"

NUMERIC_FEATURES = [
    "TransactionDT", "TransactionAmt",
    "card1", "card2", "card3", "card5",
    "addr1", "addr2", "dist1", "dist2",
    "C1", "C2", "C3", "C4", "C5", "C6", "C7",
    "C8", "C9", "C10", "C11", "C12", "C13", "C14",
    "D1", "D2", "D3", "D4", "D5", "D10", "D15",
    "V1", "V2", "V3", "V4", "V5",
    "V6", "V7", "V8", "V9", "V10",
]

CATEGORICAL_FEATURES = [
    "ProductCD", "card4", "card6",
    "P_emaildomain", "R_emaildomain",
]

FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES
TARGET = "isFraud"

CHUNK_SIZE = 2000
SAMPLE_FRACTION = 0.20
MAX_ROWS = 120_000
RANDOM_STATE = 42


def load_sample():
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Dataset not found: {DATA_PATH}")

    print("Reading IEEE-CIS data in small chunks...")
    print(f"Chunk size: {CHUNK_SIZE:,}")
    print(f"Sampling fraction per chunk: {SAMPLE_FRACTION:.0%}")

    required = FEATURES + [TARGET]

    dtype_map = {
        col: "float32" for col in NUMERIC_FEATURES
    }
    dtype_map.update({
        col: "object" for col in CATEGORICAL_FEATURES
    })
    dtype_map[TARGET] = "int8"

    collected = []
    total_rows = 0
    chunk_number = 0

    reader = pd.read_csv(
        DATA_PATH,
        usecols=required,
        dtype=dtype_map,
        chunksize=CHUNK_SIZE,
        low_memory=True,
    )

    for chunk in reader:
        chunk_number += 1
        total_rows += len(chunk)

        chunk = chunk.dropna(subset=[TARGET])
        chunk = chunk[chunk[TARGET].isin([0, 1])]

        if chunk.empty:
            continue

        sampled = chunk.sample(
            frac=SAMPLE_FRACTION,
            random_state=RANDOM_STATE + chunk_number,
        )

        if not sampled.empty:
            collected.append(sampled)

        if chunk_number % 25 == 0:
            print(
                f"Scanned {total_rows:,} rows | "
                f"Chunks: {chunk_number} | "
                f"Collected: {sum(len(x) for x in collected):,}"
            )

        del chunk, sampled

    if not collected:
        raise ValueError("No usable rows were found in the dataset.")

    print("\nCombining sampled batches...")
    df = pd.concat(collected, ignore_index=True)

    del collected
    gc.collect()

    if len(df) > MAX_ROWS:
        df = df.sample(
            n=MAX_ROWS,
            random_state=RANDOM_STATE,
        ).reset_index(drop=True)

    print(f"Total rows scanned: {total_rows:,}")
    print(f"Final sampled rows: {len(df):,}")

    # Ensure numeric columns are numeric and compact.
    for col in NUMERIC_FEATURES:
        df[col] = pd.to_numeric(
            df[col], errors="coerce"
        ).astype("float32")

    # Convert categories to numeric codes.
    category_mappings = {}

    for col in CATEGORICAL_FEATURES:
        values = df[col].fillna("__MISSING__").astype(str)
        codes, uniques = pd.factorize(values, sort=True)

        df[col] = codes.astype("float32")
        category_mappings[col] = uniques.tolist()

    df[FEATURES] = df[FEATURES].replace(
        [np.inf, -np.inf], np.nan
    )

    df[TARGET] = df[TARGET].astype("int8")

    return df, category_mappings, total_rows


def calculate_metrics(y_true, probabilities, threshold):
    predictions = (probabilities >= threshold).astype(int)

    tn, fp, fn, tp = confusion_matrix(
        y_true,
        predictions,
        labels=[0, 1],
    ).ravel()

    return {
        "threshold": float(threshold),
        "accuracy": float(accuracy_score(y_true, predictions)),
        "precision": float(
            precision_score(y_true, predictions, zero_division=0)
        ),
        "recall": float(
            recall_score(y_true, predictions, zero_division=0)
        ),
        "f1": float(
            f1_score(y_true, predictions, zero_division=0)
        ),
        "roc_auc": float(roc_auc_score(y_true, probabilities)),
        "pr_auc": float(
            average_precision_score(y_true, probabilities)
        ),
        "confusion_matrix": {
            "true_negative": int(tn),
            "false_positive": int(fp),
            "false_negative": int(fn),
            "true_positive": int(tp),
        },
        "support": {
            "legitimate": int((np.asarray(y_true) == 0).sum()),
            "fraud": int((np.asarray(y_true) == 1).sum()),
        },
    }


def train():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    df, category_mappings, total_rows = load_sample()

    y = df[TARGET].copy()
    X = df[FEATURES].copy()

    print("\nSample fraud prevalence:", f"{y.mean():.2%}")
    print("Creating train, validation and test splits...")

    X_train, X_temp, y_train, y_temp = train_test_split(
        X,
        y,
        test_size=0.40,
        random_state=RANDOM_STATE,
        stratify=y,
    )

    X_valid, X_test, y_valid, y_test = train_test_split(
        X_temp,
        y_temp,
        test_size=0.50,
        random_state=RANDOM_STATE,
        stratify=y_temp,
    )

    del df, X, y, X_temp, y_temp
    gc.collect()

    negative_count = int((y_train == 0).sum())
    positive_count = int((y_train == 1).sum())

    if positive_count == 0:
        raise ValueError("No fraud examples in training sample.")

    scale_weight = negative_count / positive_count

    print(f"Training rows: {len(X_train):,}")
    print(f"Validation rows: {len(X_valid):,}")
    print(f"Test rows: {len(X_test):,}")
    print(f"Fraud class weight: {scale_weight:.2f}")

    print("\nTraining XGBoost...")

    model = XGBClassifier(
        n_estimators=150,
        max_depth=3,
        learning_rate=0.05,
        subsample=0.80,
        colsample_bytree=0.80,
        min_child_weight=5,
        reg_lambda=3.0,
        scale_pos_weight=scale_weight,
        objective="binary:logistic",
        eval_metric="aucpr",
        tree_method="hist",
        max_bin=128,
        n_jobs=2,
        random_state=RANDOM_STATE,
    )

    model.fit(
        X_train,
        y_train,
        eval_set=[(X_valid, y_valid)],
        verbose=25,
    )

    print("\nSelecting threshold using validation data...")

    valid_probabilities = model.predict_proba(
        X_valid
    )[:, 1]

    thresholds = np.arange(0.05, 0.81, 0.01)

    threshold = float(max(
        thresholds,
        key=lambda value: f1_score(
            y_valid,
            (valid_probabilities >= value).astype(int),
            zero_division=0,
        ),
    ))

    print(f"Selected threshold: {threshold:.2f}")

    print("\nEvaluating held-out test data...")

    test_probabilities = model.predict_proba(
        X_test
    )[:, 1]

    metrics = calculate_metrics(
        y_test,
        test_probabilities,
        threshold,
    )

    importance = [
        {
            "feature": name,
            "importance": float(value),
        }
        for name, value in sorted(
            zip(FEATURES, model.feature_importances_),
            key=lambda item: item[1],
            reverse=True,
        )
    ]

    bundle = {
        "model": model,
        "features": FEATURES,
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "category_mappings": category_mappings,
        "decision_threshold": threshold,
        "model_version": "ieee-cis-benchmark-1.0",
        "data_origin": "IEEE-CIS labeled training dataset",
        "note": (
            "Benchmark only. Not directly connected to "
            "GadgetHub live transaction scoring."
        ),
    }

    print("\nSaving benchmark model...")
    joblib.dump(bundle, MODEL_PATH, compress=3)

    report = {
        "model_version": "ieee-cis-benchmark-1.0",
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
        "data_origin": "IEEE-CIS labeled train_transaction.csv",
        "source_rows_scanned": int(total_rows),
        "sampled_rows": int(
            len(X_train) + len(X_valid) + len(X_test)
        ),
        "fraud_prevalence_in_sample": float(
            (int(y_train.sum()) + int(y_valid.sum()) + int(y_test.sum()))
            / (len(y_train) + len(y_valid) + len(y_test))
        ),
        "feature_count": len(FEATURES),
        "features": FEATURES,
        "split": {
            "train": int(len(X_train)),
            "validation": int(len(X_valid)),
            "test": int(len(X_test)),
        },
        "threshold_selection": (
            "Maximum F1 on validation sample; "
            "reported metrics use held-out test sample."
        ),
        "test_metrics": metrics,
        "feature_importance": importance,
        "environment": {
            "python": platform.python_version(),
            "pandas": pd.__version__,
            "numpy": np.__version__,
            "scikit_learn": sklearn.__version__,
            "xgboost": xgboost.__version__,
            "joblib": joblib.__version__,
        },
        "limitations": [
            "This is a sampled benchmark, not a full-dataset training run.",
            "IEEE-CIS is historical competition data, not GadgetHub merchant data.",
            "Anonymized features do not directly map to GadgetHub checkout fields.",
            "TransactionAmt is not assumed to be INR.",
            "The unlabeled test_transaction.csv is not used.",
            "Do not blend this benchmark into live checkout risk without validation.",
        ],
    }

    REPORT_PATH.write_text(
        json.dumps(report, indent=2),
        encoding="utf-8",
    )

    print("\n========== TRAINING COMPLETED ==========")
    print("Model:", MODEL_PATH)
    print("Report:", REPORT_PATH)
    print("\nHeld-out test metrics:")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    train()
