# faculty_memory.py

FACULTY_CORRECTIONS = {}

def store_feedback(co, po, faculty_level, ai_level):
    key = f"{co}_{po}"

    if key not in FACULTY_CORRECTIONS:
        FACULTY_CORRECTIONS[key] = {
            "total": 0,
            "match": 0
        }

    FACULTY_CORRECTIONS[key]["total"] += 1

    if faculty_level == ai_level:
        FACULTY_CORRECTIONS[key]["match"] += 1


def get_confidence_boost(co, po):
    key = f"{co}_{po}"

    if key not in FACULTY_CORRECTIONS:
        return 0.0

    data = FACULTY_CORRECTIONS[key]
    accuracy = data["match"] / data["total"]

    if accuracy > 0.8:
        return 0.05
    elif accuracy > 0.6:
        return 0.03
    else:
        return 0.0
