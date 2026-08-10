import os
from functools import lru_cache
from pathlib import Path

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity


MODEL_CANDIDATES = [
    Path(__file__).resolve().parent / "models" / "all-MiniLM-L6-v2",
    "sentence-transformers/all-MiniLM-L6-v2",
    "all-MiniLM-L6-v2",
]


def _iter_model_candidates():
    env_path = os.getenv("BERT_MODEL_PATH")

    if env_path:
        yield env_path

    for candidate in MODEL_CANDIDATES:
        yield candidate


def _try_load_model(model_name, local_files_only):
    from sentence_transformers import SentenceTransformer

    try:
        return SentenceTransformer(str(model_name), local_files_only=local_files_only)
    except Exception:
        return None


@lru_cache(maxsize=1)
def _load_model():
    for candidate in _iter_model_candidates():
        model = _try_load_model(candidate, local_files_only=True)
        if model is not None:
            return model

    if os.getenv("BERT_ALLOW_DOWNLOAD", "1").strip().lower() not in {"0", "false", "no"}:
        for candidate in _iter_model_candidates():
            model = _try_load_model(candidate, local_files_only=False)
            if model is not None:
                return model

    return None


def is_bert_available():
    return _load_model() is not None


@lru_cache(maxsize=64)
def _encode_texts(texts):
    model = _load_model()

    if model is None:
        return None

    try:
        return model.encode(list(texts), show_progress_bar=False, normalize_embeddings=True)
    except TypeError:
        return model.encode(list(texts), show_progress_bar=False)


def bert_similarity(cos, pos):
    if _load_model() is None:
        return np.zeros((len(cos), len(pos)))

    co_emb = _encode_texts(tuple(cos))
    po_emb = _encode_texts(tuple(pos))

    if co_emb is None or po_emb is None:
        return np.zeros((len(cos), len(pos)))

    return cosine_similarity(co_emb, po_emb)
