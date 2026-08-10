from functools import lru_cache

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity


@lru_cache(maxsize=1)
def _load_model():
    try:
        import tensorflow_hub as hub

        return hub.load("https://tfhub.dev/google/universal-sentence-encoder/4")
    except Exception:
        return None

def use_similarity(cos, pos):
    model = _load_model()

    if model is None:
        return np.zeros((len(cos), len(pos)))

    co_emb = model(cos)
    po_emb = model(pos)
    return cosine_similarity(co_emb, po_emb)
