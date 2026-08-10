import re


bloom_verbs = {
    "Level 1-Remember": [
        "define", "find", "how", "label", "list", "match", "name",
        "omit", "recall", "relate", "select", "show", "spell",
        "tell", "what", "when", "where", "which", "who", "why",
        "identify"
    ],
    "Level 2-Understand": [
        "classify", "compare", "contrast", "demonstrate", "explain",
        "extend", "illustrate", "infer", "interpret", "outline",
        "relate", "rephrase", "show", "summarize", "translate",
        "describe"
    ],
    "Level 3-Apply": [
        "apply", "build", "choose", "construct", "develop",
        "experiment with", "identify", "interview", "make use of",
        "model", "organize", "plan", "select", "solve", "utilize",
        "implement", "use"
    ],
    "Level 4-Analyze": [
        "analyze", "assume", "categorize", "classify", "compare",
        "conclusion", "contrast", "discover", "dissect", "distinguish",
        "divide", "examine", "function", "inference", "inspect",
        "list", "motive", "relationships", "simplify", "survey",
        "take part in", "test for", "theme"
    ],
    "Level 5-Evaluate": [
        "agree", "appraise", "assess", "award", "choose", "compare",
        "conclude", "criteria", "criticize", "decide", "deduct",
        "defend", "determine", "disprove", "dispute", "estimate",
        "evaluate", "explain", "importance", "influence", "interpret",
        "judge", "justify", "mark", "measure", "opinion", "perceive",
        "prioritize", "prove", "rate", "recommend", "rule on",
        "select", "support", "value"
    ],
    "Level 6-Create": [
        "adapt", "build", "change", "choose", "combine", "compile",
        "compose", "construct", "create", "delete", "design",
        "develop", "discuss", "elaborate", "estimate", "formulate",
        "happen", "imagine", "improve", "invent", "make up",
        "maximize", "minimize", "modify", "original", "originate",
        "plan", "predict", "propose", "solution", "solve",
        "suppose", "test", "theory"
    ]
}

BLOOM_ORDER = {
    "Remember": 1,
    "Understand": 2,
    "Apply": 3,
    "Analyze": 4,
    "Evaluate": 5,
    "Create": 6,
}

DEFAULT_BLOOM_LABEL = "Understand"
QUESTION_LEADING_PATTERNS = [
    (r"^\s*what\s+is\b", "Remember", ["what"]),
    (r"^\s*define\b", "Remember", ["define"]),
    (r"^\s*list\b", "Remember", ["list"]),
    (r"^\s*name\b", "Remember", ["name"]),
    (r"^\s*identify\b", "Remember", ["identify"]),
    (r"^\s*write\s+(a\s+)?short\s+note\s+on\b", "Understand", ["write short note"]),
    (r"^\s*with\s+(a\s+)?neat\s+diagram\s+explain\b", "Understand", ["explain"]),
    (r"^\s*explain\b", "Understand", ["explain"]),
    (r"^\s*describe\b", "Understand", ["describe"]),
    (r"^\s*discuss\b", "Understand", ["discuss"]),
    (r"^\s*illustrate\b", "Understand", ["illustrate"]),
    (r"^\s*apply\b", "Apply", ["apply"]),
    (r"^\s*use\b", "Apply", ["use"]),
    (r"^\s*solve\b", "Apply", ["solve"]),
    (r"^\s*implement\b", "Apply", ["implement"]),
    (r"^\s*analy[sz]e\b", "Analyze", ["analyze"]),
    (r"^\s*compare\b", "Analyze", ["compare"]),
    (r"^\s*differentiate\b", "Analyze", ["differentiate"]),
    (r"^\s*justify\b", "Evaluate", ["justify"]),
    (r"^\s*evaluate\b", "Evaluate", ["evaluate"]),
    (r"^\s*design\b", "Create", ["design"]),
    (r"^\s*create\b", "Create", ["create"]),
]


def normalize_bloom_label(label):
    if not label:
        return DEFAULT_BLOOM_LABEL

    if "-" in label:
        return label.split("-", 1)[1].strip()

    return label.strip()


def _verb_pattern(verb):
    return r"(?<!\w){}(?!\w)".format(re.escape(verb.lower()))


def detect_bloom_details(text):
    lowered = (text or "").lower()
    matched = {}
    first_positions = {}

    for raw_label, verbs in bloom_verbs.items():
        normalized = normalize_bloom_label(raw_label)
        for verb in sorted(verbs, key=len, reverse=True):
            hit = re.search(_verb_pattern(verb), lowered)

            if hit:
                matched.setdefault(normalized, [])
                if verb not in matched[normalized]:
                    matched[normalized].append(verb)
                first_positions[normalized] = min(
                    first_positions.get(normalized, hit.start()),
                    hit.start(),
                )

    if not matched:
        return {
            "label": DEFAULT_BLOOM_LABEL,
            "level": BLOOM_ORDER[DEFAULT_BLOOM_LABEL],
            "keywords": [],
            "primary_keywords": [],
            "matched_levels": {},
        }

    label = max(
        matched.keys(),
        key=lambda bloom_label: (
            len(matched[bloom_label]),
            -first_positions.get(bloom_label, len(lowered)),
            -BLOOM_ORDER[bloom_label],
        ),
    )
    all_keywords = []

    for matched_label in sorted(matched.keys(), key=lambda bloom_label: BLOOM_ORDER[bloom_label]):
        for verb in matched[matched_label]:
            if verb not in all_keywords:
                all_keywords.append(verb)

    return {
        "label": label,
        "level": BLOOM_ORDER[label],
        "keywords": all_keywords,
        "primary_keywords": matched[label],
        "matched_levels": matched,
    }


def detect_question_bloom_details(text):
    lowered = (text or "").lower().strip()

    if re.search(r"^\s*(with\s+(a\s+)?neat\s+diagram\s+)?explain\b", lowered):
        if re.search(r"\binvestigation\b", lowered):
            return {
                "label": "Apply",
                "level": BLOOM_ORDER["Apply"],
                "keywords": ["explain", "investigation"],
                "primary_keywords": ["explain", "investigation"],
                "matched_levels": {"Apply": ["explain", "investigation"]},
            }

    for pattern, label, keywords in QUESTION_LEADING_PATTERNS:
        if re.search(pattern, lowered):
            return {
                "label": label,
                "level": BLOOM_ORDER[label],
                "keywords": keywords,
                "primary_keywords": keywords,
                "matched_levels": {label: keywords},
            }

    return detect_bloom_details(text)


def bloom_alignment_score(source_text, target_text):
    source_details = detect_bloom_details(source_text)
    target_details = detect_bloom_details(target_text)

    source_level = source_details["level"]
    target_level = target_details["level"]
    source_keywords = set(source_details["keywords"])
    target_keywords = set(target_details["keywords"])

    alignment = max(0.0, 1.0 - (abs(source_level - target_level) / 5.0))
    source_strength = source_level / max(len(BLOOM_ORDER), 1)
    target_strength = target_level / max(len(BLOOM_ORDER), 1)
    keyword_overlap = (
        len(source_keywords.intersection(target_keywords)) / max(len(source_keywords.union(target_keywords)), 1)
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

    return min(max(score, 0.0), 1.0), source_details, target_details


def get_bloom_level(co):
    return detect_bloom_details(co)["label"]
