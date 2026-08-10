def bloom_weight(bloom_level):
    weights = {
        "Remember": 0.95,
        "Understand": 1.0,
        "Apply": 1.05,
        "Analyze": 1.08,
        "Evaluate": 1.1,
        "Create": 1.12
    }
    return weights.get(bloom_level, 1.0)


def safe_boost(score):
    if score > 0.85:
        return min(score + 0.03, 1.0)
    if score > 0.70:
        return score + 0.02
    return score

def safe_level(score):
    if score >= 0.6:
        return 3
    elif score >= 0.4:
        return 2
    elif score >= 0.25:   # 🔥 NEW
        return 1
    else:
        return 0

# =========================
# ACCURACY EVALUATION API   