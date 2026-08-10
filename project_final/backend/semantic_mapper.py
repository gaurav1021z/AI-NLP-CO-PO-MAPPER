import re

import numpy as np
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS

from bert_model import bert_similarity, is_bert_available
from bloom import BLOOM_ORDER, bloom_alignment_score, detect_bloom_details
from tfidf_model import tfidf_similarity
from trained_mapping_model import (
    predict_mapping_probabilities,
    trained_model_available,
)


TOKEN_PATTERN = re.compile(r"[a-z0-9]+")
GENERIC_REASON_TERMS = {
    "apply",
    "analyze",
    "assess",
    "build",
    "compare",
    "construct",
    "create",
    "define",
    "design",
    "describe",
    "develop",
    "evaluate",
    "explain",
    "formulate",
    "gain",
    "identify",
    "implement",
    "solve",
    "understand",
    "use",
}
DEFAULT_LEVEL_THRESHOLDS = {
    "level_2_min": 0.40,
    "level_3_min": 0.60,
    "confidence_medium_min": 0.45,
    "confidence_high_min": 0.70,
}
BLOOM_LABEL_TO_ID = {
    "Remember": 1,
    "Understand": 2,
    "Apply": 3,
    "Analyze": 4,
    "Evaluate": 5,
    "Create": 6,
}
DOMAIN_MATCH_RULES = [
    {
        "triggers": {"database", "dbms", "sql", "schema", "schemas", "query", "queries", "normalization", "er", "relational"},
        "phrases": {"entity relationship", "relational schema"},
        "expansions": ["database", "sql", "query", "schema", "normalization", "table", "relation", "attribute", "entity", "relational"],
    },
    {
        "triggers": {"operating", "system", "process", "processes", "thread", "threads", "scheduling", "deadlock", "memory", "filesystem", "synchronization"},
        "phrases": {"operating system", "file system", "memory management"},
        "expansions": ["operating", "system", "process", "thread", "scheduling", "deadlock", "memory", "filesystem", "synchronization", "resource", "concurrency"],
    },
    {
        "triggers": {"algorithm", "algorithms", "complexity", "optimization", "graph", "tree", "sorting", "searching"},
        "phrases": {"data structures", "algorithm analysis"},
        "expansions": ["algorithm", "data", "structure", "complexity", "optimization", "graph", "tree", "sorting", "searching", "analysis"],
    },
    {
        "triggers": {"network", "protocol", "routing", "switching", "tcp", "ip", "communication", "wireless"},
        "phrases": {"computer network", "data communication"},
        "expansions": ["network", "protocol", "routing", "switching", "communication", "tcp", "ip", "packet", "transmission"],
    },
    {
        "triggers": {"software", "engineering", "testing", "requirement", "requirements", "maintenance", "design", "development"},
        "phrases": {"software engineering", "software design"},
        "expansions": ["software", "engineering", "design", "development", "testing", "requirement", "maintenance", "quality", "implementation"],
    },
    {
        "triggers": {"machine", "learning", "classification", "regression", "prediction", "dataset", "training", "model"},
        "phrases": {"machine learning", "data mining"},
        "expansions": ["machine", "learning", "model", "training", "prediction", "dataset", "classification", "regression", "intelligence"],
    },
    {
        "triggers": {"compiler", "compilers", "assembler", "assemblers", "loader", "loaders", "linker", "linkers", "macro", "lexical", "syntax", "semantic", "intermediate", "target", "optimization"},
        "phrases": {"system programming", "compiler design", "code optimization", "target code", "intermediate code"},
        "expansions": ["compiler", "assembler", "loader", "linker", "macro", "lexical", "syntax", "semantic", "intermediate", "target", "optimization", "translation", "system", "programming", "toolchain", "code"],
    },
    {
        "triggers": {"security", "cryptography", "authentication", "authorization", "attack", "threat", "privacy", "vulnerability"},
        "phrases": {"information security", "cyber security"},
        "expansions": ["security", "cryptography", "authentication", "authorization", "privacy", "attack", "threat", "vulnerability", "protection"],
    },
    {
        "triggers": {"mathematics", "math", "statistics", "probability", "numerical", "analysis", "calculus", "algebra"},
        "phrases": {"numerical analysis", "formal aspects"},
        "expansions": ["mathematics", "statistics", "probability", "numerical", "analysis", "calculus", "algebra", "modelling", "computation"],
    },
]
CODE_CONTEXT_HINTS = {
    "PO1": "engineering knowledge mathematics natural science computing fundamentals specialization",
    "PO2": "problem analysis research literature analytical thinking solution identification",
    "PO3": "design development system component process societal environmental needs",
    "PO4": "investigation experiments data analysis interpretation synthesis conclusions",
    "PO5": "modern tool usage it tools modeling simulation prediction engineering practice",
    "PO6": "society environment sustainability health safety legal cultural impact",
    "PO7": "ethics human values diversity inclusion professional responsibility",
    "PO8": "individual collaborative teamwork leadership multidisciplinary contribution",
    "PO9": "communication reports documentation presentation listening language clarity",
    "PO10": "project management finance teamwork leadership planning execution",
    "PO11": "lifelong learning adaptability independent continuous learning",
    "WK1": "natural sciences scientific fundamentals discipline awareness",
    "WK2": "mathematics numerical analysis statistics computer information science modelling",
    "WK3": "engineering fundamentals theory formulation foundation",
    "WK4": "specialist engineering knowledge theoretical frameworks discipline practice",
    "WK5": "resource use environmental impacts sustainable design operations",
    "WK6": "engineering practice technology tools implementation",
    "WK7": "engineering society professional responsibility public safety sustainability",
    "WK8": "research literature critical thinking creative approaches emerging issues",
    "WK9": "ethics inclusive behaviour conduct professional responsibilities diversity respect",
}


def _safe_text(text):
    return (text or "").strip()


def _raw_tokens(text):
    return [token for token in TOKEN_PATTERN.findall((text or "").lower()) if token]


def _dedupe_terms(terms):
    unique = []
    seen = set()

    for term in terms:
        cleaned = _safe_text(term).lower()
        if cleaned and cleaned not in seen:
            unique.append(cleaned)
            seen.add(cleaned)

    return unique


def enrich_text_for_matching(text, code=""):
    original = _safe_text(text)
    lowered = original.lower()
    tokens = set(_raw_tokens(original))
    additions = []

    for rule in DOMAIN_MATCH_RULES:
        phrase_match = any(phrase in lowered for phrase in rule.get("phrases", set()))
        token_match = bool(tokens.intersection(rule.get("triggers", set())))

        if phrase_match or token_match:
            additions.extend(rule.get("expansions", []))

    code_hint = CODE_CONTEXT_HINTS.get(_safe_text(code).upper())
    if code_hint:
        additions.extend(code_hint.split())

    for token in list(tokens):
        if token.endswith("s") and len(token) > 3:
            additions.append(token[:-1])
        if token.endswith("ing") and len(token) > 5:
            additions.append(token[:-3])

    expanded = _dedupe_terms(additions)
    novel_terms = [term for term in expanded if term not in tokens]

    if not novel_terms:
        return original

    return f"{original} {' '.join(novel_terms)}".strip()


def preprocess_text(text):
    raw_text = _safe_text(text).lower()
    tokens = [
        token
        for token in TOKEN_PATTERN.findall(raw_text)
        if token not in ENGLISH_STOP_WORDS
    ]
    return " ".join(tokens) or raw_text


def _ordered_tokens(text):
    seen = []

    for token in preprocess_text(text).split():
        if token and token not in seen:
            seen.append(token)

    return seen


def _token_set(text):
    return set(_ordered_tokens(text))


def _format_items(items):
    values = [value for value in items if value]

    if not values:
        return ""
    if len(values) == 1:
        return values[0]
    if len(values) == 2:
        return f"{values[0]} and {values[1]}"

    return f"{', '.join(values[:-1])}, and {values[-1]}"


def _top_terms(text, limit=4):
    return _ordered_tokens(text)[:limit]


def _lower_first(text):
    cleaned = _safe_text(text)

    if not cleaned:
        return ""

    return cleaned[0].lower() + cleaned[1:]


def detect_bloom_level(text):
    return detect_bloom_details(text)["label"]


def lexical_similarity_matrix(source_texts, target_texts):
    matrix = np.zeros((len(source_texts), len(target_texts)))

    for source_index, source_text in enumerate(source_texts):
        source_tokens = _token_set(source_text)

        for target_index, target_text in enumerate(target_texts):
            target_tokens = _token_set(target_text)

            if not source_tokens or not target_tokens:
                score = 0.0
            else:
                union = source_tokens.union(target_tokens)
                score = len(source_tokens.intersection(target_tokens)) / max(len(union), 1)

            matrix[source_index, target_index] = score

    return matrix


def tfidf_similarity_matrix(source_texts, target_texts):
    processed_sources = [preprocess_text(text) for text in source_texts]
    processed_targets = [preprocess_text(text) for text in target_texts]

    if not any(processed_sources + processed_targets):
        return np.zeros((len(source_texts), len(target_texts)))

    return tfidf_similarity(processed_sources, processed_targets)


def _normalize_cosine_score(score):
    return min(max(float(score), 0.0), 1.0)


def bert_similarity_matrix(source_texts, target_texts):
    if not source_texts or not target_texts:
        return np.zeros((len(source_texts), len(target_texts))), False

    raw_scores = bert_similarity(source_texts, target_texts)
    normalized_scores = np.vectorize(_normalize_cosine_score)(raw_scores)
    return normalized_scores, is_bert_available()


def bloom_alignment_from_details(source_details, target_details):
    source_level = source_details["level"]
    target_level = target_details["level"]
    source_keywords = set(source_details["keywords"])
    target_keywords = set(target_details["keywords"])

    alignment = max(0.0, 1.0 - (abs(source_level - target_level) / 5.0))
    source_strength = source_level / max(len(BLOOM_ORDER), 1)
    target_strength = target_level / max(len(BLOOM_ORDER), 1)
    keyword_overlap = (
        len(source_keywords.intersection(target_keywords))
        / max(len(source_keywords.union(target_keywords)), 1)
        if source_keywords and target_keywords
        else 0.0
    )
    keyword_coverage = min(len(source_keywords) / 3.0, 1.0)

    score = (
        (0.35 * alignment)
        + (0.25 * source_strength)
        + (0.15 * target_strength)
        + (0.15 * keyword_overlap)
        + (0.10 * keyword_coverage)
    )

    return min(max(score, 0.0), 1.0)


def normalize_level_thresholds(level_thresholds=None):
    thresholds = dict(DEFAULT_LEVEL_THRESHOLDS)

    if isinstance(level_thresholds, dict):
        for key in thresholds:
            value = level_thresholds.get(key)
            if value is not None:
                thresholds[key] = float(value)

    thresholds["level_2_min"] = min(max(thresholds["level_2_min"], 0.20), 0.70)
    thresholds["level_3_min"] = min(
        max(thresholds["level_3_min"], thresholds["level_2_min"] + 0.10),
        0.95,
    )
    thresholds["confidence_medium_min"] = min(
        max(thresholds["confidence_medium_min"], 0.25),
        thresholds["level_3_min"] - 0.05,
    )
    thresholds["confidence_high_min"] = min(
        max(
            thresholds["confidence_high_min"],
            thresholds["confidence_medium_min"] + 0.10,
        ),
        0.98,
    )

    return thresholds


def apply_signal_agreement_bonus(score, tfidf_score, lexical_score, bert_score, bloom_score, bert_available):
    strong_signal_count = sum(
        [
            tfidf_score >= 0.22,
            lexical_score >= 0.12,
            bloom_score >= 0.55,
            bert_available and bert_score >= 0.42,
        ]
    )
    bonus = 0.0

    if strong_signal_count >= 3:
        bonus += 0.03
    if bert_available and bert_score >= 0.55 and tfidf_score >= 0.22:
        bonus += 0.03
    if bloom_score >= 0.75 and lexical_score >= 0.12:
        bonus += 0.02

    return min(max(score + bonus, 0.0), 1.0)


def apply_po_context_bonus(score, source_text, po_code, bloom_label, subject_name=""):
    combined_text = f"{source_text} {subject_name}".strip() if subject_name else source_text
    text = _safe_text(combined_text).lower()
    tokens = set(_raw_tokens(combined_text))
    bonus = 0.0

    if po_code == "PO1":
        if tokens.intersection({"understand", "describe", "explain", "concept", "concepts", "fundamental", "fundamentals", "role", "functionality", "knowledge", "principle", "principles"}):
            bonus += 0.07
        if bloom_label in {"Remember", "Understand"}:
            bonus += 0.02

    elif po_code == "PO2":
        if tokens.intersection({"analyze", "analysis", "algorithm", "algorithms", "optimize", "optimization", "syntax", "semantic", "lexical", "problem", "problems"}):
            bonus += 0.07
        if bloom_label in {"Analyze", "Evaluate"}:
            bonus += 0.03

    elif po_code == "PO3":
        if tokens.intersection({"design", "develop", "generate", "create", "target", "intermediate", "code", "compiler", "component", "components", "phase", "phases"}):
            bonus += 0.06
        if bloom_label in {"Apply", "Create"}:
            bonus += 0.02

    elif po_code == "PO4":
        if tokens.intersection({"analyze", "analysis", "investigate", "investigation", "experiments", "interpretation", "evaluate", "semantic", "syntax", "lexical"}):
            bonus += 0.06
        if bloom_label in {"Analyze", "Evaluate"}:
            bonus += 0.02

    elif po_code == "PO5":
        if tokens.intersection({"tool", "tools", "implement", "implementation", "program", "programs", "compiler", "assembler", "loader", "linker", "macro", "code", "optimization"}):
            bonus += 0.08
        if "system programming" in text or "compiler design" in text:
            bonus += 0.03

    elif po_code == "PO6":
        if tokens.intersection({"society", "societal", "environment", "environmental", "sustainability", "sustainable", "economy", "economic", "health", "safety", "legal", "social", "public", "impact"}):
            bonus += 0.07

    elif po_code == "PO7":
        if tokens.intersection({"ethics", "ethical", "professional", "diversity", "inclusion", "human", "values", "law", "laws", "legal", "standard", "standards", "rule", "rules", "guideline", "guidelines", "compliance", "regulatory", "plagiarism", "copyright", "integrity", "responsibility", "responsibilities", "conduct", "safety", "protocol", "protocols"}):
            bonus += 0.08

    elif po_code == "PO8":
        if tokens.intersection({"team", "teams", "teamwork", "member", "leader", "leadership", "group", "collaborative", "collaboration", "cooperative", "individual", "diverse", "multidisciplinary", "coordinate", "coordination"}):
            bonus += 0.08

    elif po_code == "PO9":
        if tokens.intersection({"report", "reports", "present", "presentation", "document", "documentation", "communicate", "communication"}):
            bonus += 0.08

    elif po_code == "PO10":
        if tokens.intersection({"project", "projects", "manage", "management", "finance", "planning"}):
            bonus += 0.08

    elif po_code == "PO11":
        if tokens.intersection({"learning", "lifelong", "continuous", "independent", "adapt", "adaptability", "career", "self-learning", "trends", "evolution", "technological", "change"}):
            bonus += 0.07

    return min(max(score + bonus, 0.0), 1.0)


def build_trained_model_features(
    source_text,
    target_text,
    tfidf_score,
    lexical_score,
    bert_score,
    bloom_score,
    combined_score,
    source_bloom_label,
    target_bloom_label,
):
    return {
        "tfidf_score": tfidf_score,
        "lexical_score": lexical_score,
        "bert_score": bert_score,
        "bloom_alignment": bloom_score,
        "combined_score": combined_score,
        "co_bloom_id": BLOOM_LABEL_TO_ID.get(source_bloom_label, 0),
        "po_bloom_id": BLOOM_LABEL_TO_ID.get(target_bloom_label, 0),
        "co_text_length": len(_safe_text(source_text).split()),
        "po_text_length": len(_safe_text(target_text).split()),
    }


def blend_with_trained_model(score, model_probability):
    if model_probability is None:
        return score

    # Keep the live system stable: use the trained model as a gentle reranking
    # signal instead of letting a small teacher dataset fully dominate the score.
    adjusted = (0.88 * float(score)) + (0.12 * float(model_probability))

    if model_probability >= 0.80 and score >= 0.18:
        adjusted += 0.02
    elif model_probability <= 0.20:
        adjusted -= 0.02

    return min(max(adjusted, 0.0), 1.0)


def combine_similarity_scores(tfidf_score, lexical_score, bert_score, bloom_score, bert_available):
    component_weights = {
        "tfidf": 0.25,
        "lexical": 0.15,
        "bloom": 0.20,
    }

    if bert_available:
        component_weights["bert"] = 0.40
    else:
        component_weights["tfidf"] = 0.45
        component_weights["lexical"] = 0.25
        component_weights["bloom"] = 0.30

    total_weight = sum(component_weights.values()) or 1.0
    score = (
        component_weights["tfidf"] * tfidf_score
        + component_weights["lexical"] * lexical_score
        + component_weights["bloom"] * bloom_score
        + component_weights.get("bert", 0.0) * bert_score
    )

    normalized_score = min(max(score / total_weight, 0.0), 1.0)
    return apply_signal_agreement_bonus(
        normalized_score,
        tfidf_score=tfidf_score,
        lexical_score=lexical_score,
        bert_score=bert_score,
        bloom_score=bloom_score,
        bert_available=bert_available,
    )


def mapping_level_from_score(score, level_thresholds=None):
    current_score = min(max(float(score), 0.0), 1.0)

    if current_score >= 0.60:
        return 3
    if current_score >= 0.40:
        return 2
    return 1


def confidence_label_from_score(score, level_thresholds=None):
    thresholds = normalize_level_thresholds(level_thresholds)

    if score >= thresholds["confidence_high_min"]:
        return "High"
    if score >= thresholds["confidence_medium_min"]:
        return "Medium"
    return "Low"


def _round_percent(score):
    return round(float(score) * 100, 2)


def calibrate_display_confidence(raw_score, ranked_scores, rank_index):
    if not ranked_scores:
        return min(max(raw_score, 0.0), 1.0)

    current_score = min(max(float(raw_score), 0.0), 1.0)
    top_score = float(ranked_scores[0])
    next_score = (
        float(ranked_scores[rank_index + 1])
        if rank_index + 1 < len(ranked_scores)
        else max(current_score - 0.08, 0.0)
    )
    margin_to_next = max(current_score - next_score, 0.0)
    gap_from_top = max(top_score - current_score, 0.0)
    calibrated = current_score

    if rank_index == 0:
        calibrated += 0.04 + min(margin_to_next * 0.35, 0.08)
        if current_score >= 0.50:
            calibrated += 0.03
        elif current_score >= 0.35:
            calibrated += 0.02
    elif rank_index == 1:
        calibrated += 0.02 + min(margin_to_next * 0.18, 0.04)
    else:
        calibrated += min(margin_to_next * 0.10, 0.02)

    calibrated -= min(gap_from_top * 0.15, 0.04)

    return min(max(calibrated, current_score), 0.95)


def select_meaningful_matches(ranked, thresholds, limit):
    if not ranked:
        return []

    top_ranked = ranked[: max(1, limit)]
    best_score = float(top_ranked[0]["raw_score"])
    base_threshold = max(thresholds["level_2_min"] - 0.20, 0.16)
    relative_gap_limit = 0.26 if best_score >= thresholds["level_3_min"] else 0.22
    step_gap_limit = 0.16
    selected = []
    previous_score = None

    for index, item in enumerate(top_ranked):
        score = float(item["raw_score"])

        if index == 0:
            selected.append(item)
            previous_score = score
            continue

        if score < base_threshold:
            break

        if (best_score - score) > relative_gap_limit:
            break

        if previous_score is not None and (previous_score - score) > step_gap_limit:
            if score < (thresholds["level_2_min"] + 0.04):
                break

        selected.append(item)
        previous_score = score

    if len(selected) == 1:
        fallback_floor = max(base_threshold, min(best_score * 0.38, best_score - 0.10))
        for item in top_ranked[1:]:
            if float(item["raw_score"]) >= fallback_floor:
                selected.append(item)
            if len(selected) >= min(3, len(top_ranked)):
                break

    if len(selected) == 2 and len(top_ranked) > 2:
        third_score = float(top_ranked[2]["raw_score"])
        second_score = float(selected[1]["raw_score"])
        if third_score >= max(base_threshold, second_score - 0.08):
            selected.append(top_ranked[2])

    return selected or top_ranked[:1]


def shared_keywords(source_text, target_text, limit=4):
    target_tokens = _token_set(target_text)
    common = []

    for token in _ordered_tokens(source_text):
        if token in target_tokens and token not in common:
            common.append(token)

    return common[:limit]


def _dedupe_reason_options(options):
    unique = []
    seen = set()

    for option in options:
        text = _safe_text(option.get("text"))
        label = _safe_text(option.get("label")) or f"Reason {len(unique) + 1}"

        if text and text not in seen:
            unique.append({"label": label, "text": text})
            seen.add(text)

    return unique


def _topic_phrase(shared, co_terms, po_terms):
    if shared:
        return _format_items(shared)
    if co_terms:
        return _format_items(co_terms)
    if po_terms:
        return _format_items(po_terms)

    return "the relevant subject concepts"


def _co_action_phrase(source_text, bloom_label, topic_phrase):
    cleaned = _lower_first(source_text.rstrip("."))

    if cleaned.startswith("understand "):
        return f"gain a clear understanding of {cleaned[len('understand '):]}"
    if cleaned.startswith("analyze "):
        return f"analyze {cleaned[len('analyze '):]}"
    if cleaned.startswith("apply "):
        return f"apply {cleaned[len('apply '):]}"
    if cleaned.startswith("identify "):
        return f"identify {cleaned[len('identify '):]}"
    if cleaned.startswith("design "):
        return f"design {cleaned[len('design '):]}"
    if cleaned.startswith("create "):
        return f"create {cleaned[len('create '):]}"
    if cleaned.startswith("implement "):
        return f"implement {cleaned[len('implement '):]}"
    if cleaned.startswith("evaluate "):
        return f"evaluate {cleaned[len('evaluate '):]}"

    if bloom_label in {"Remember", "Understand"}:
        return f"gain a sound understanding of {topic_phrase}"

    return cleaned or f"work effectively with {topic_phrase}"


def _po_action_phrase(target_text):
    cleaned = _lower_first(target_text.rstrip("."))
    return cleaned or "achieve the relevant program outcome"


def _compact_po_phrase(target_text, po_terms, shared_terms):
    useful_terms = [term for term in (shared_terms + po_terms) if term and term not in GENERIC_REASON_TERMS]

    if useful_terms:
        return _format_items(useful_terms[:3])

    cleaned = _safe_text(target_text)
    if not cleaned:
        return "the related program outcome"

    words = cleaned.split()
    return " ".join(words[:7]).strip(" ,.;:") or "the related program outcome"


def _build_reason_options(source_text, target_text, bloom_details, target_bloom_details, score, debug):
    shared = shared_keywords(source_text, target_text)
    co_terms = _top_terms(source_text)
    po_terms = _top_terms(target_text)
    excluded_terms = (
        set(bloom_details.get("keywords", []))
        | set(target_bloom_details.get("keywords", []))
        | GENERIC_REASON_TERMS
    )
    excluded_terms.update({"student", "students", "course", "outcome"})
    filtered_shared = [term for term in shared if term not in excluded_terms]
    filtered_co_terms = [term for term in co_terms if term not in excluded_terms]
    filtered_po_terms = [term for term in po_terms if term not in excluded_terms]
    topic_text = _topic_phrase(filtered_shared, filtered_co_terms, filtered_po_terms)
    co_action = _co_action_phrase(source_text, bloom_details["label"], topic_text)
    po_action = _po_action_phrase(target_text)
    compact_po = _compact_po_phrase(target_text, filtered_po_terms, filtered_shared)
    shared_text = _format_items(filtered_shared)

    if co_action.startswith("gain "):
        teacher_style_text = (
            f"Students will {co_action}, supporting {compact_po}."
        )
    else:
        teacher_style_text = (
            f"Students will be able to {co_action}, supporting {compact_po}."
        )

    if shared_text:
        conceptual_text = (
            f"This outcome links {shared_text} with {compact_po}."
        )
    else:
        conceptual_text = (
            f"This outcome focuses on {topic_text}, aligning with {compact_po}."
        )

    attainment_text = (
        f"Attaining this outcome helps learners address {compact_po} through {topic_text}."
    )

    return _dedupe_reason_options(
        [
            {"label": "Reason 1", "text": teacher_style_text},
            {"label": "Reason 2", "text": conceptual_text},
            {"label": "Reason 3", "text": attainment_text},
        ]
    )


def _select_reason_index(reason_options, debug, source_text, target_text):
    return 0


def _rank_texts_against_candidates(source_texts, candidate_texts, source_codes=None, candidate_codes=None, subject_name=""):
    prepared_sources = [
        enrich_text_for_matching(
            f"{text} {subject_name}".strip() if subject_name else text,
            code=source_codes[index] if source_codes and index < len(source_codes) else "",
        )
        for index, text in enumerate(source_texts)
    ]
    prepared_candidates = [
        enrich_text_for_matching(
            text,
            code=candidate_codes[index] if candidate_codes and index < len(candidate_codes) else "",
        )
        for index, text in enumerate(candidate_texts)
    ]
    tfidf_scores = tfidf_similarity_matrix(prepared_sources, prepared_candidates)
    lexical_scores = lexical_similarity_matrix(prepared_sources, prepared_candidates)
    bert_scores, bert_available = bert_similarity_matrix(prepared_sources, prepared_candidates)

    return {
        "tfidf": tfidf_scores,
        "lexical": lexical_scores,
        "bert": bert_scores,
        "bert_available": bert_available,
        "prepared_sources": prepared_sources,
        "prepared_candidates": prepared_candidates,
    }


def map_course_outcomes_to_pos(course_outcomes, po_catalog, top_k=3, level_thresholds=None, subject_name=""):
    cleaned_cos = [_safe_text(co) for co in course_outcomes if _safe_text(co)]
    valid_pos = [
        {"code": _safe_text(po.get("code")), "text": _safe_text(po.get("text"))}
        for po in po_catalog
        if _safe_text(po.get("code")) and _safe_text(po.get("text"))
    ]

    if not cleaned_cos or not valid_pos:
        return []

    po_texts = [po["text"] for po in valid_pos]
    po_bloom_details = [detect_bloom_details(po_text) for po_text in po_texts]
    thresholds = normalize_level_thresholds(level_thresholds)
    model_available = trained_model_available()
    scores = _rank_texts_against_candidates(
        cleaned_cos,
        po_texts,
        source_codes=[f"CO{index + 1}" for index in range(len(cleaned_cos))],
        candidate_codes=[po["code"] for po in valid_pos],
        subject_name=subject_name,
    )

    results = []
    limit = max(1, min(top_k, len(valid_pos)))

    for co_index, co_text in enumerate(cleaned_cos):
        ranked = []
        co_bloom = detect_bloom_details(co_text)
        feature_rows = []

        for po_index, po in enumerate(valid_pos):
            tfidf_score = float(scores["tfidf"][co_index, po_index])
            lexical_score = float(scores["lexical"][co_index, po_index])
            bert_score = float(scores["bert"][co_index, po_index])
            po_bloom = po_bloom_details[po_index]
            bloom_score = bloom_alignment_from_details(co_bloom, po_bloom)
            pre_model_score = combine_similarity_scores(
                tfidf_score=tfidf_score,
                lexical_score=lexical_score,
                bert_score=bert_score,
                bloom_score=bloom_score,
                bert_available=scores["bert_available"],
            )
            pre_model_score = apply_po_context_bonus(
                pre_model_score,
                source_text=co_text,
                po_code=po["code"],
                bloom_label=co_bloom["label"],
                subject_name=subject_name,
            )
            feature_row = build_trained_model_features(
                source_text=co_text,
                target_text=po["text"],
                tfidf_score=tfidf_score,
                lexical_score=lexical_score,
                bert_score=bert_score,
                bloom_score=bloom_score,
                combined_score=pre_model_score,
                source_bloom_label=co_bloom["label"],
                target_bloom_label=po_bloom["label"],
            )
            feature_rows.append(feature_row)
            ranked.append(
                {
                    "po_code": po["code"],
                    "po_text": po["text"],
                    "base_score": pre_model_score,
                    "tfidf_score": tfidf_score,
                    "lexical_score": lexical_score,
                    "bert_score": bert_score,
                    "bloom_score": bloom_score,
                    "po_bloom": po_bloom,
                    "feature_row": feature_row,
                }
            )

        model_probabilities = (
            predict_mapping_probabilities(feature_rows)
            if model_available and feature_rows
            else [None] * len(ranked)
        )

        for item, model_probability in zip(ranked, model_probabilities):
            final_score = blend_with_trained_model(item["base_score"], model_probability)

            debug = {
                "tfidf": _round_percent(item["tfidf_score"]),
                "lexical": _round_percent(item["lexical_score"]),
                "bert": _round_percent(item["bert_score"]),
                "semantic": _round_percent(item["bert_score"]),
                "bloom": _round_percent(item["bloom_score"]),
                "combined": _round_percent(final_score),
                "bloom_keywords": co_bloom["keywords"],
                "bloom_primary_keywords": co_bloom["primary_keywords"],
                "bloom_matches": co_bloom["matched_levels"],
                "po_bloom": item["po_bloom"]["label"],
                "po_bloom_keywords": item["po_bloom"]["primary_keywords"],
                "bert_used": scores["bert_available"],
                "trained_model_used": model_available,
                "trained_model_probability": _round_percent(model_probability or 0.0),
                "level_thresholds": thresholds,
                "use": 0.0,
            }
            reason_options = _build_reason_options(
                source_text=co_text,
                target_text=item["po_text"],
                bloom_details=co_bloom,
                target_bloom_details=item["po_bloom"],
                score=final_score,
                debug=debug,
            )
            selected_reason_index = _select_reason_index(
                reason_options=reason_options,
                debug=debug,
                source_text=co_text,
                target_text=item["po_text"],
            )
            item["raw_score"] = final_score
            item["reason_options"] = reason_options
            item["selected_reason_index"] = selected_reason_index
            item["debug"] = debug

        ranked.sort(key=lambda item: item["raw_score"], reverse=True)
        bloom_level = co_bloom["label"]
        mapping = []
        ranked_scores = [item["raw_score"] for item in ranked]
        selected_ranked = select_meaningful_matches(ranked, thresholds, limit)

        for rank_index, item in enumerate(selected_ranked):
            raw_score = item["raw_score"]
            display_score = calibrate_display_confidence(raw_score, ranked_scores, rank_index)
            reason_options = item["reason_options"]
            selected_reason_index = min(item["selected_reason_index"], max(len(reason_options) - 1, 0))
            selected_reason = (
                reason_options[selected_reason_index]["text"]
                if reason_options
                else "Reason could not be generated for this mapping."
            )

            mapping.append(
                {
                    "po_code": item["po_code"],
                    "po_text": item["po_text"],
                    "final_score": _round_percent(display_score),
                    "level": mapping_level_from_score(raw_score, thresholds),
                    "confidence_label": confidence_label_from_score(display_score, thresholds),
                    "reason": selected_reason,
                    "justification": selected_reason,
                    "reason_options": reason_options,
                    "justification_options": reason_options,
                    "selected_reason_index": selected_reason_index,
                    "selected_justification_index": selected_reason_index,
                    "debug": {
                        **item["debug"],
                        "combined_raw": _round_percent(raw_score),
                        "combined_display": _round_percent(display_score),
                    },
                }
            )

        results.append(
            {
                "co": f"CO{co_index + 1}",
                "objective": co_text,
                "bloom": bloom_level,
                "bloom_keywords": co_bloom["keywords"],
                "bloom_primary_keywords": co_bloom["primary_keywords"],
                "bloom_matches": co_bloom["matched_levels"],
                "mapping": mapping,
            }
        )

    return results


def map_texts_to_candidates(
    texts,
    candidates,
    code_key="code",
    text_key="text",
    result_key="match",
    level_thresholds=None,
):
    cleaned_texts = [_safe_text(text) for text in texts if _safe_text(text)]
    valid_candidates = [
        {
            "code": _safe_text(candidate.get(code_key)),
            "text": _safe_text(candidate.get(text_key)),
        }
        for candidate in candidates
        if _safe_text(candidate.get(code_key)) and _safe_text(candidate.get(text_key))
    ]

    if not cleaned_texts or not valid_candidates:
        return []

    candidate_texts = [candidate["text"] for candidate in valid_candidates]
    thresholds = normalize_level_thresholds(level_thresholds)
    scores = _rank_texts_against_candidates(
        cleaned_texts,
        candidate_texts,
        candidate_codes=[candidate["code"] for candidate in valid_candidates],
    )
    results = []

    for text_index, text in enumerate(cleaned_texts):
        ranked = []

        for candidate_index, candidate in enumerate(valid_candidates):
            tfidf_score = float(scores["tfidf"][text_index, candidate_index])
            lexical_score = float(scores["lexical"][text_index, candidate_index])
            bert_score = float(scores["bert"][text_index, candidate_index])
            bloom_score, text_bloom, candidate_bloom = bloom_alignment_score(
                text,
                candidate["text"],
            )
            final_score = combine_similarity_scores(
                tfidf_score=tfidf_score,
                lexical_score=lexical_score,
                bert_score=bert_score,
                bloom_score=bloom_score,
                bert_available=scores["bert_available"],
            )

            ranked.append(
                (
                    candidate_index,
                    final_score,
                    {
                        "tfidf": _round_percent(tfidf_score),
                        "lexical": _round_percent(lexical_score),
                        "bert": _round_percent(bert_score),
                        "semantic": _round_percent(bert_score),
                        "bloom": _round_percent(bloom_score),
                        "combined": _round_percent(final_score),
                        "bloom_keywords": text_bloom["keywords"],
                        "bloom_primary_keywords": text_bloom["primary_keywords"],
                        "bloom_matches": text_bloom["matched_levels"],
                        "candidate_bloom": candidate_bloom["label"],
                        "candidate_bloom_keywords": candidate_bloom["primary_keywords"],
                        "bert_used": scores["bert_available"],
                        "level_thresholds": thresholds,
                    },
                )
            )

        ranked.sort(key=lambda item: item[1], reverse=True)
        best_index, best_score, best_debug = ranked[0]
        text_bloom = detect_bloom_details(text)

        results.append(
            {
                result_key: valid_candidates[best_index]["code"],
                "text": text,
                "confidence": _round_percent(best_score),
                "confidence_label": confidence_label_from_score(best_score, thresholds),
                "level": mapping_level_from_score(best_score, thresholds),
                "bloom": text_bloom["label"],
                "bloom_keywords": text_bloom["keywords"],
                "bloom_primary_keywords": text_bloom["primary_keywords"],
                "bloom_matches": text_bloom["matched_levels"],
                "debug": best_debug,
            }
        )

    return results
