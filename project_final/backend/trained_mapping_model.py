from functools import lru_cache
from pathlib import Path

import joblib
import pandas as pd


MODEL_PATH = Path(__file__).resolve().parent / "models" / "copo_mapping_model.joblib"


@lru_cache(maxsize=1)
def load_trained_model_bundle():
    if not MODEL_PATH.exists():
        return None

    try:
        return joblib.load(MODEL_PATH)
    except Exception:
        return None


def trained_model_available():
    return load_trained_model_bundle() is not None


def _build_feature_frame(feature_rows, feature_columns):
    normalized_rows = []

    for feature_row in feature_rows:
        normalized_rows.append(
            {
                column: float((feature_row or {}).get(column, 0.0) or 0.0)
                for column in feature_columns
            }
        )

    if not normalized_rows:
        return None

    return pd.DataFrame(normalized_rows)


def predict_mapping_probabilities(feature_rows):
    bundle = load_trained_model_bundle()
    if not bundle:
        return [None for _ in feature_rows]

    feature_columns = bundle.get("feature_columns") or []
    model = bundle.get("model")
    if model is None or not feature_columns:
        return [None for _ in feature_rows]

    frame = _build_feature_frame(feature_rows, feature_columns)
    if frame is None or frame.empty:
        return []

    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(frame)
        return [float(row[1]) for row in probabilities]

    prediction = model.predict(frame)
    if len(prediction):
        return [float(value) for value in prediction]

    return [None for _ in feature_rows]


def predict_mapping_probability(feature_row):
    probabilities = predict_mapping_probabilities([feature_row])
    if probabilities:
        return probabilities[0]

    return None
