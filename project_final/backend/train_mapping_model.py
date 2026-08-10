import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from training_dataset_builder import (
    build_conversion_summary,
    build_training_dataset,
    load_reference_paths,
)


MODELS_DIR = Path(__file__).resolve().parent / "models"
DATASET_PATH = MODELS_DIR / "teacher_reference_dataset.json"
MODEL_PATH = MODELS_DIR / "copo_mapping_model.joblib"
REPORT_PATH = MODELS_DIR / "copo_mapping_model_report.json"
CONVERSION_REPORT_PATH = MODELS_DIR / "teacher_reference_conversion_report.json"

FEATURE_COLUMNS = [
    "tfidf_score",
    "lexical_score",
    "bert_score",
    "bloom_alignment",
    "combined_score",
    "co_bloom_id",
    "po_bloom_id",
    "co_text_length",
    "po_text_length",
]

BLOOM_TO_ID = {
    "Remember": 1,
    "Understand": 2,
    "Apply": 3,
    "Analyze": 4,
    "Evaluate": 5,
    "Create": 6,
}


def _load_classifier():
    try:
        from xgboost import XGBClassifier

        classifier = XGBClassifier(
            n_estimators=220,
            max_depth=5,
            learning_rate=0.06,
            subsample=0.9,
            colsample_bytree=0.9,
            objective="binary:logistic",
            eval_metric="logloss",
            random_state=42,
        )
        return classifier, "xgboost"
    except Exception:
        classifier = GradientBoostingClassifier(
            learning_rate=0.06,
            max_depth=6,
            n_estimators=220,
            random_state=42,
        )
        return classifier, "gradient_boosting_fallback"


def _prepare_dataframe(dataset):
    frame = pd.DataFrame(dataset)

    if frame.empty:
        raise ValueError("Teacher reference dataset is empty.")

    frame["co_bloom_id"] = frame["co_bloom"].map(BLOOM_TO_ID).fillna(0).astype(int)
    frame["po_bloom_id"] = frame["po_bloom"].map(BLOOM_TO_ID).fillna(0).astype(int)
    frame["co_text_length"] = frame["co_text"].fillna("").map(lambda value: len(str(value).split()))
    frame["po_text_length"] = frame["new_po_text"].fillna("").map(lambda value: len(str(value).split()))
    frame["label"] = frame["label"].astype(int)

    return frame


def _build_pipeline():
    classifier, model_name = _load_classifier()
    pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="constant", fill_value=0.0)),
            ("classifier", classifier),
        ]
    )
    return pipeline, model_name


def train_mapping_model(reference_paths=None):
    resolved_reference_paths = load_reference_paths(reference_paths)
    dataset = build_training_dataset(reference_paths=resolved_reference_paths)
    frame = _prepare_dataframe(dataset)
    X = frame[FEATURE_COLUMNS]
    y = frame["label"]

    if y.nunique() < 2:
        raise ValueError("Training dataset must contain both positive and negative labels.")

    test_size = 0.2 if len(frame) >= 40 else 0.3
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        stratify=y,
        random_state=42,
    )

    pipeline, model_name = _build_pipeline()
    pipeline.fit(X_train, y_train)
    predictions = pipeline.predict(X_test)

    metrics = {
        "model_name": model_name,
        "dataset_rows": int(len(frame)),
        "positive_rows": int(y.sum()),
        "negative_rows": int((1 - y).sum()),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "accuracy": round(float(accuracy_score(y_test, predictions)), 4),
        "f1_score": round(float(f1_score(y_test, predictions, zero_division=0)), 4),
        "confusion_matrix": confusion_matrix(y_test, predictions).tolist(),
        "classification_report": classification_report(y_test, predictions, output_dict=True, zero_division=0),
        "feature_columns": FEATURE_COLUMNS,
        "reference_files": [str(Path(path)) for path in resolved_reference_paths],
    }
    conversion_summary = build_conversion_summary(dataset)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    DATASET_PATH.write_text(json.dumps(dataset, indent=2), encoding="utf-8")
    joblib.dump(
        {
            "model": pipeline,
            "feature_columns": FEATURE_COLUMNS,
            "bloom_to_id": BLOOM_TO_ID,
            "metrics": metrics,
        },
        MODEL_PATH,
    )
    REPORT_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    CONVERSION_REPORT_PATH.write_text(json.dumps(conversion_summary, indent=2), encoding="utf-8")

    return metrics


if __name__ == "__main__":
    metrics = train_mapping_model()
    print(json.dumps(metrics, indent=2))
