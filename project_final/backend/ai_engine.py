import numpy as np
import re

# =========================
# MODEL WEIGHTS
# =========================

MODEL_WEIGHTS = {
    "tfidf": 0.25,
    "use": 0.35,
    "bert": 0.40
}

# =========================
# BLOOM BONUS
# =========================

BLOOM_BONUS = {
    "Remember": 0.05,
    "Understand": 0.10,
    "Apply": 0.15,
    "Analyze": 0.20,
    "Evaluate": 0.25,
    "Create": 0.30
}

# =========================
# PO WEIGHTS
# =========================

AICTE_PO_WEIGHTS = {
    "PO1": 1.0,
    "PO2": 1.1,
    "PO3": 1.15,
    "PO4": 1.2,
    "PO5": 1.25,
    "PO6": 1.15,
    "PO7": 1.1,
    "PO8": 1.05,
    "PO9": 1.0,
    "PO10": 1.05,
    "PO11": 1.0
}

# =========================
# HYBRID SCORE
# =========================

def hybrid_ai_score(tfidf, use, bert, bloom, po_code):
    score = (
        MODEL_WEIGHTS["tfidf"] * tfidf +
        MODEL_WEIGHTS["use"] * use +
        MODEL_WEIGHTS["bert"] * bert
    )

    score += BLOOM_BONUS.get(bloom, 0)
    score *= AICTE_PO_WEIGHTS.get(po_code, 1.0)

    return min(score, 1.0)

# =========================
# AUTO THRESHOLD
# =========================

def auto_threshold(scores):
    avg = np.mean(scores)
    return max(0.55, avg * 0.9)

# =========================
# FEEDBACK LEARNING
# =========================

def feedback_learning(ai_level, faculty_level):
    if faculty_level > ai_level:
        MODEL_WEIGHTS["bert"] += 0.02
        MODEL_WEIGHTS["tfidf"] -= 0.01
    elif faculty_level < ai_level:
        MODEL_WEIGHTS["tfidf"] += 0.02
        MODEL_WEIGHTS["bert"] -= 0.01

    total = sum(MODEL_WEIGHTS.values())
    for k in MODEL_WEIGHTS:
        MODEL_WEIGHTS[k] /= total

# =========================
# MAPPING LEVEL
# =========================

def mapping_level(score):
    if score < 0.4:
        return 0
    elif score < 0.6:
        return 1
    elif score < 0.75:
        return 2
    else:
        return 3

# =========================
# TEXT CLEANING
# =========================

def clean_text(text):
    return re.sub(r'[^\w\s]', '', text.lower())

# =========================
# KEYWORD BOOST
# =========================

def keyword_boost(q, co):
    important = [
        "analysis", "design", "algorithm",
        "system", "security", "network",
        "data", "model", "process"
    ]

    bonus = 0
    for word in important:
        if word in q and word in co:
            bonus += 0.08

    return bonus

# =========================
# SIMPLE SIMILARITY (NO SKLEARN)
# =========================

def simple_similarity(text1, text2):
    words1 = set(re.findall(r'\w+', text1))
    words2 = set(re.findall(r'\w+', text2))

    common = words1.intersection(words2)

    return len(common) / max(len(words1), 1)

# =========================
# MAIN FUNCTION
# =========================

def map_questions_to_co(questions, cos_data):

    co_texts = [clean_text(co["co_text"]) for co in cos_data]
    co_ids = [co["co_id"] for co in cos_data]

    results = []

    for question in questions:

        q_clean = clean_text(question)

        scores = []

        for i, co_text in enumerate(co_texts):

            sim = simple_similarity(q_clean, co_text)

            boost = keyword_boost(q_clean, co_text)

            score = hybrid_ai_score(
                tfidf=sim + boost,
                use=sim,
                bert=sim,
                bloom="Understand",
                po_code="PO1"
            )

            scores.append(score)

        best_index = int(np.argmax(scores))
        best_score = float(scores[best_index])

        # 🔥 Confidence scaling
        confidence = best_score * 100

        if confidence < 40:
            confidence += 20
        elif confidence < 60:
            confidence += 10

        confidence = min(confidence, 95)

        results.append({
            "question": question,
            "co": co_ids[best_index],
            "confidence": round(confidence, 2),
            "level": mapping_level(best_score)
        })

    return results