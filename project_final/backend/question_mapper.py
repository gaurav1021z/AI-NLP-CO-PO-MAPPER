import re

from bloom import detect_question_bloom_details
from semantic_mapper import (
    bert_similarity_matrix,
    confidence_label_from_score,
    enrich_text_for_matching,
    lexical_similarity_matrix,
    mapping_level_from_score,
    preprocess_text,
    tfidf_similarity_matrix,
)


QUESTION_PREFIX_PATTERNS = [
    r"^\s*with\s+(a\s+)?neat\s+diagram\s+",
    r"^\s*write\s+(a\s+)?short\s+note\s+on\s+",
    r"^\s*write\s+note\s+on\s+",
    r"^\s*what\s+is\s+",
    r"^\s*define\s+",
    r"^\s*describe\s+",
    r"^\s*explain\s+",
    r"^\s*discuss\s+",
    r"^\s*list\s+",
    r"^\s*identify\s+",
    r"^\s*state\s+",
    r"^\s*mention\s+",
]
QUESTION_TRAILING_PATTERNS = [
    r"\s+in\s+brief\s*$",
    r"\s+briefly\s*$",
    r"\s+with\s+example(s)?\s*$",
    r"\s+with\s+neat\s+diagram\s*$",
]
QUESTION_TERM_EXPANSIONS = [
    {
        "phrases": {"digital forensic", "digital forensics"},
        "expansions": "digital forensic phases methodology investigation security incident",
    },
    {
        "phrases": {"computer security incident", "incident response", "incident response methodology", "csirt"},
        "expansions": "computer security incident incident response methodology phases handling response team csirt",
    },
    {
        "phrases": {"digital evidence", "chain of custody", "evidence collection"},
        "expansions": "digital evidence collection recovery analysis chain custody handling forensic evidence",
    },
    {
        "phrases": {"ram forensic image", "hard drive", "malware", "virus", "forensic image"},
        "expansions": "malware virus ram forensic image acquired image hard drive analysis tools",
    },
    {
        "phrases": {"mobile device", "mobile devices", "smartphone"},
        "expansions": "mobile device investigation digital forensic mobile evidence",
    },
    {
        "phrases": {"email", "emails", "browser", "browsers", "authentication"},
        "expansions": "email browser authentication source content validation",
    },
    {
        "phrases": {"report", "reports", "conclusion", "conclusions"},
        "expansions": "report investigation report valid conclusion findings",
    },
    {
        "phrases": {"router investigation", "rooter investigation"},
        "expansions": "digital evidence investigation collection analysis recovery",
    },
]
GENERIC_QUESTION_TOKENS = {
    "a",
    "an",
    "and",
    "any",
    "brief",
    "briefly",
    "diagram",
    "give",
    "in",
    "is",
    "list",
    "neat",
    "note",
    "on",
    "short",
    "the",
    "what",
    "with",
    "write",
}


def _safe_text(text):
    return (text or "").strip()


def _normalize_space(text):
    return re.sub(r"\s+", " ", _safe_text(text)).strip()


def _normalize_question_topic(question_text):
    cleaned = _normalize_space(question_text.lower())

    for pattern in QUESTION_PREFIX_PATTERNS:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)

    for pattern in QUESTION_TRAILING_PATTERNS:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)

    cleaned = cleaned.strip(" .:?")
    return cleaned or _normalize_space(question_text.lower())


def _expand_question_topic(question_text):
    topic = _normalize_question_topic(question_text)
    additions = []

    for rule in QUESTION_TERM_EXPANSIONS:
        if any(phrase in topic for phrase in rule["phrases"]):
            additions.extend(rule["expansions"].split())

    if "virus" in topic and "malware" not in additions:
        additions.extend(["malware", "analysis"])
    if "csirt" in topic and "incident" not in additions:
        additions.extend(["incident", "response", "methodology"])

    additions_text = " ".join(dict.fromkeys(additions))
    base = topic if topic else _safe_text(question_text).lower()
    return f"{base} {additions_text}".strip()


def _candidate_text(co):
    co_text = _safe_text(co.get("co_text") or co.get("description") or "")
    co_id = _safe_text(co.get("co_id") or co.get("co") or "")
    return enrich_text_for_matching(co_text, code=co_id)


def _token_set(text):
    return {
        token
        for token in preprocess_text(text).split()
        if token and token not in GENERIC_QUESTION_TOKENS
    }


def _keyword_score(question_text, candidate_text):
    question_tokens = _token_set(question_text)
    candidate_tokens = _token_set(candidate_text)

    if not question_tokens or not candidate_tokens:
        return 0.0, []

    shared = sorted(question_tokens.intersection(candidate_tokens))
    return len(shared) / max(len(question_tokens), 1), shared


def _phrase_score(question_text, candidate_text):
    question_lower = question_text.lower()
    candidate_lower = candidate_text.lower()
    score = 0.0

    for rule in QUESTION_TERM_EXPANSIONS:
        if any(phrase in question_lower for phrase in rule["phrases"]):
            if any(phrase in candidate_lower for phrase in rule["phrases"]):
                score = max(score, 1.0)
            else:
                expansion_hits = sum(
                    1 for token in rule["expansions"].split() if token in candidate_lower
                )
                score = max(score, min(expansion_hits / 5.0, 0.75))

    return min(score, 1.0)


def _normalize_confidence(score):
    return round(max(min(score, 1.0), 0.0) * 100, 2)


def _combine_question_scores(tfidf_score, lexical_score, bert_score, keyword_score, phrase_score, bert_available):
    if bert_available:
        combined = (
            (0.28 * tfidf_score)
            + (0.18 * lexical_score)
            + (0.18 * bert_score)
            + (0.24 * keyword_score)
            + (0.12 * phrase_score)
        )
    else:
        combined = (
            (0.35 * tfidf_score)
            + (0.25 * lexical_score)
            + (0.28 * keyword_score)
            + (0.12 * phrase_score)
        )

    if keyword_score >= 0.40 and phrase_score >= 0.50:
        combined += 0.08
    elif keyword_score >= 0.30:
        combined += 0.04

    return min(max(combined, 0.0), 0.98)


def _co_rank_key(co):
    co_number = co.get("co_number")

    try:
        order = int(co_number)
    except Exception:
        match = re.search(r"CO(\d+)", _safe_text(co.get("co_id") or co.get("co")))
        order = int(match.group(1)) if match else 999

    return order


def map_questions_to_co(questions, cos_data):
    candidates = []

    for index, co in enumerate(sorted(cos_data, key=_co_rank_key)):
        co_id = co.get("co_id") or co.get("co") or f"CO{index + 1}"
        co_text = co.get("co_text") or co.get("description") or ""

        if _safe_text(co_text):
            candidates.append(
                {
                    "code": co_id,
                    "text": _safe_text(co_text),
                    "prepared_text": _candidate_text(co),
                    "co_number": _co_rank_key(co),
                }
            )

    clean_questions = [_safe_text(question) for question in questions if _safe_text(question)]

    if not clean_questions or not candidates:
        return []

    prepared_questions = [_expand_question_topic(question) for question in clean_questions]
    prepared_candidates = [candidate["prepared_text"] for candidate in candidates]
    tfidf_scores = tfidf_similarity_matrix(prepared_questions, prepared_candidates)
    lexical_scores = lexical_similarity_matrix(prepared_questions, prepared_candidates)
    bert_scores, bert_available = bert_similarity_matrix(prepared_questions, prepared_candidates)

    results = []

    for question_index, question_text in enumerate(clean_questions):
        bloom_details = detect_question_bloom_details(question_text)
        ranked = []

        for candidate_index, candidate in enumerate(candidates):
            tfidf_score = float(tfidf_scores[question_index, candidate_index])
            lexical_score = float(lexical_scores[question_index, candidate_index])
            bert_score = float(bert_scores[question_index, candidate_index])
            keyword_score, shared_keywords = _keyword_score(
                prepared_questions[question_index],
                candidate["prepared_text"],
            )
            phrase_score = _phrase_score(
                prepared_questions[question_index],
                candidate["prepared_text"],
            )
            final_score = _combine_question_scores(
                tfidf_score=tfidf_score,
                lexical_score=lexical_score,
                bert_score=bert_score,
                keyword_score=keyword_score,
                phrase_score=phrase_score,
                bert_available=bert_available,
            )

            ranked.append(
                {
                    "candidate": candidate,
                    "score": final_score,
                    "debug": {
                        "prepared_question": prepared_questions[question_index],
                        "prepared_candidate": candidate["prepared_text"],
                        "tfidf": _normalize_confidence(tfidf_score),
                        "lexical": _normalize_confidence(lexical_score),
                        "bert": _normalize_confidence(bert_score),
                        "semantic": _normalize_confidence(bert_score),
                        "keyword": _normalize_confidence(keyword_score),
                        "phrase": _normalize_confidence(phrase_score),
                        "combined": _normalize_confidence(final_score),
                        "shared_keywords": shared_keywords,
                        "bloom_keywords": bloom_details["keywords"],
                        "bert_used": bert_available,
                    },
                }
            )

        ranked.sort(
            key=lambda item: (
                item["score"],
                -item["candidate"]["co_number"],
            ),
            reverse=True,
        )
        best = ranked[0]
        best_score = best["score"]

        results.append(
            {
                "question": question_text,
                "co": best["candidate"]["code"],
                "confidence": _normalize_confidence(best_score),
                "confidence_label": confidence_label_from_score(best_score),
                "level": mapping_level_from_score(best_score),
                "bloom": bloom_details["label"],
                "bloom_keywords": bloom_details["keywords"],
                "debug": best["debug"],
            }
        )

    return results
