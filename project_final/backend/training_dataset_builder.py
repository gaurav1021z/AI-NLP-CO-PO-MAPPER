import json
import re
from pathlib import Path
from typing import Dict, List
from xml.etree import ElementTree as ET
from zipfile import ZipFile

from pypdf import PdfReader

from aicte_pos import AICTE_POS
from bloom import bloom_alignment_score, detect_bloom_details
from semantic_mapper import (
    _rank_texts_against_candidates,
    _round_percent,
    apply_po_context_bonus,
    combine_similarity_scores,
)


DEFAULT_REFERENCE_FILES = [
    r"C:\Users\gaura\Downloads\file no 16 spcc.pdf",
    r"C:\Users\gaura\Downloads\17.EM CO_PO_PSO_Justification.docx",
    r"C:\Users\gaura\Downloads\17 - CG CO-PO & CO-PSO mapping justification (1).docx",
    r"C:\Users\gaura\Downloads\17.EG CO_PO_PSO_Justification_SH2022-23.doc.pdf",
]
REFERENCE_MANIFEST_PATH = Path(__file__).resolve().parent / "teacher_reference_files.json"

OLD_TO_NEW_PO_MAP = {
    "PO1": "PO1",
    "PO2": "PO2",
    "PO3": "PO3",
    "PO4": "PO4",
    "PO5": "PO5",
    "PO6": "PO6",
    "PO7": "PO6",
    "PO8": "PO7",
    "PO9": "PO8",
    "PO10": "PO9",
    "PO11": "PO10",
    "PO12": "PO11",
}

DOCX_NAMESPACE = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
SECTION_STOP_MARKERS = {
    "co-pso",
    "co pso",
    "course outcomes and program specific outcomes",
    "ii) co – po justification",
    "ii) co-po justification",
    "iii) co – po justification",
    "iii) co-po justification",
}
SECTION_HEADING_MARKERS = {
    "co-po mapping",
    "co-po matrix",
    "co – po mapping",
    "co – po matrix",
    "co-po mapping:",
    "co-po matrix:",
    "co – po mapping:",
    "co – po matrix:",
    "co-po mapping justification",
    "co – po mapping justification",
    "course objectives",
    "course outcomes",
}


def _safe_text(value):
    return (value or "").strip()


def _normalize_whitespace(value):
    return re.sub(r"\s+", " ", _safe_text(value))


def _clean_lines(text):
    return [_normalize_whitespace(line) for line in (text or "").splitlines() if _safe_text(line)]


def _extract_docx_text(path: Path):
    with ZipFile(path) as archive:
        xml = archive.read("word/document.xml")
    root = ET.fromstring(xml)
    paragraphs = []

    for paragraph in root.findall(".//w:p", DOCX_NAMESPACE):
        texts = [node.text for node in paragraph.findall(".//w:t", DOCX_NAMESPACE) if node.text]
        line = "".join(texts).strip()
        if line:
            paragraphs.append(line)

    return "\n".join(paragraphs)


def _extract_pdf_text(path: Path):
    reader = PdfReader(str(path))
    return "\n".join((page.extract_text() or "") for page in reader.pages)


def extract_text_from_reference(path: Path):
    suffix = path.suffix.lower()

    if suffix == ".docx":
        return _extract_docx_text(path)
    if suffix == ".pdf":
        return _extract_pdf_text(path)

    raise ValueError(f"Unsupported file type: {path.suffix}")


def normalize_po_code(raw_code):
    digits = re.findall(r"\d+", _safe_text(raw_code))

    if not digits:
        return ""

    return f"PO{int(digits[-1])}"


def normalize_co_code(raw_code):
    raw = _safe_text(raw_code)
    dot_match = re.search(r"\.(\d{1,2})$", raw)

    if dot_match:
        return f"CO{int(dot_match.group(1))}"

    digits = re.findall(r"\d+", raw)
    if digits:
        return f"CO{int(digits[-1])}"

    return ""


def _is_section_heading(line):
    lowered = _safe_text(line).lower()
    return any(marker in lowered for marker in SECTION_HEADING_MARKERS)


def _should_stop_course_outcome_capture(line):
    lowered = _safe_text(line).lower()
    return any(
        marker in lowered
        for marker in {"co-po mapping", "co-po matrix", "co – po mapping", "co – po matrix", "co-pso", "co pso"}
    )


def _parse_course_metadata(lines):
    metadata = {
        "subject_name": "",
        "course_name": "",
        "course_code": "",
        "semester": "",
        "academic_year": "",
        "faculty_name": "",
        "subject_incharge": "",
        "source_file": "",
    }

    patterns = {
        "subject_name": r"^Subject:\s*(.+)$",
        "course_name": r"^Course Name\s*:\s*(.+)$",
        "course_code": r"^Course Code\s*:\s*(.+)$",
        "semester": r"^Semester\s*:\s*(.+)$",
        "academic_year": r"^(?:Academic Year|Year)\s*:\s*(.+)$",
        "faculty_name": r"^Faculty Name\s*:\s*(.+)$",
        "subject_incharge": r"^Subject In-charge\s*:\s*(.+)$",
    }

    for line in lines:
        for key, pattern in patterns.items():
            if metadata[key]:
                continue
            match = re.match(pattern, line, flags=re.IGNORECASE)
            if match:
                metadata[key] = _safe_text(match.group(1))

    return metadata


def parse_course_outcomes(text):
    lines = _clean_lines(text)
    outcomes = {}
    capture = False
    current_code = ""
    current_parts: List[str] = []

    def flush():
        nonlocal current_code, current_parts
        if current_code and current_parts:
            outcomes[current_code] = _normalize_whitespace(" ".join(current_parts))
        current_code = ""
        current_parts = []

    for line in lines:
        lowered = line.lower()

        if "course outcomes" in lowered:
            capture = True
            continue

        if not capture:
            continue

        if _should_stop_course_outcome_capture(line):
            if "course outcomes" not in lowered:
                break

        if line.lower() in {"co no.", "co no", "course outcome", "cos no.", "cos description", "cos no", "cos description"}:
            continue

        code_match = re.match(r"^((?:[A-Z]{2,}\d+\.\d+)|(?:CO\s*\d+))\s*(.*)$", line)
        if code_match:
            flush()
            current_code = normalize_co_code(code_match.group(1))
            remainder = _safe_text(code_match.group(2))
            if remainder:
                current_parts.append(remainder)
            continue

        if current_code:
            current_parts.append(line)

    flush()
    if outcomes:
        return outcomes

    normalized_text = _normalize_whitespace(text)
    section_match = re.search(
        r"Course Outcomes:?(.*?)(?:CO-PO Mapping|CO\s*-\s*PO Mapping|CO – PO Mapping|CO-PO Matrix|CO\s*-\s*PO Matrix|CO – PO Matrix|CO-PO Mapping Justification|CO-PSO|$)",
        normalized_text,
        flags=re.IGNORECASE,
    )
    if not section_match:
        return outcomes

    section = section_match.group(1)
    pattern = re.compile(
        r"((?:[A-Z]{2,}\d+\.\d+)|(?:CO\s*\d+))\s+(.*?)(?=(?:[A-Z]{2,}\d+\.\d+)|(?:CO\s*\d+)|CO-PO Mapping|CO\s*-\s*PO Mapping|CO – PO Mapping|CO-PO Matrix|CO\s*-\s*PO Matrix|CO – PO Matrix|CO-PO Mapping Justification|CO-PSO|$)",
        flags=re.IGNORECASE,
    )
    for match in pattern.finditer(section):
        co_code = normalize_co_code(match.group(1))
        co_text = _normalize_whitespace(match.group(2))
        if co_code and co_text:
            outcomes[co_code] = co_text

    return outcomes


def _extract_section(text, start_markers, stop_markers):
    normalized_text = _normalize_whitespace(text)
    lowered = normalized_text.lower()
    start_index = -1

    for marker in start_markers:
        marker_index = lowered.find(marker)
        if marker_index != -1 and (start_index == -1 or marker_index < start_index):
            start_index = marker_index

    if start_index == -1:
        return ""

    end_index = len(normalized_text)
    for marker in stop_markers:
        marker_index = lowered.find(marker, start_index + 1)
        if marker_index != -1 and marker_index < end_index:
            end_index = marker_index

    return normalized_text[start_index:end_index]


def parse_old_matrix_scores(text):
    section = _extract_section(
        text,
        start_markers=["co-po mapping", "co-po matrix", "co – po mapping", "co – po matrix"],
        stop_markers=["co-po mapping justification", "co – po mapping justification", "co – po justification", "co-pso", "course outcomes and program specific outcomes"],
    )
    rows = {}

    line_pattern = re.compile(
        r"((?:[A-Z]{2,}\d+\.\d+)|(?:CO\s*\d+))\s+((?:[0-3-]\s+){11}[0-3-])",
        flags=re.IGNORECASE,
    )

    for match in line_pattern.finditer(section):
        co_code = normalize_co_code(match.group(1))
        values = re.findall(r"[0-3-]", match.group(2))

        if co_code and len(values) == 12:
            rows[co_code] = {f"PO{index + 1}": values[index] for index in range(12)}

    if rows:
        return rows

    tokens = _clean_lines(section)
    header_index = None

    for index in range(len(tokens) - 12):
        if tokens[index].upper() == "CO":
            candidate_headers = [normalize_po_code(token) for token in tokens[index + 1:index + 13]]
            if candidate_headers == [f"PO{po_index}" for po_index in range(1, 13)]:
                header_index = index
                break

    if header_index is None:
        return rows

    cursor = header_index + 13
    while cursor < len(tokens):
        co_token = tokens[cursor]
        co_code = normalize_co_code(co_token)

        if not co_code:
            cursor += 1
            continue

        values = tokens[cursor + 1:cursor + 13]
        if len(values) < 12:
            break

        normalized_values = []
        for value in values:
            cleaned = _safe_text(value)
            if cleaned not in {"0", "1", "2", "3", "-"}:
                normalized_values = []
                break
            normalized_values.append(cleaned)

        if len(normalized_values) == 12:
            rows[co_code] = {f"PO{index + 1}": normalized_values[index] for index in range(12)}
            cursor += 13
        else:
            cursor += 1

    return rows


def parse_old_justifications(text):
    section = _extract_section(
        text,
        start_markers=["co-po mapping justification", "co – po mapping justification", "co – po justification", "co-po justification"],
        stop_markers=["co-pso", "course outcomes and program specific outcomes"],
    )
    lines = _clean_lines(section)
    data: Dict[str, Dict[str, List[str]]] = {}
    current_co = ""
    current_po = ""

    def append_reason(line):
        if current_co and current_po and line:
            data.setdefault(current_co, {}).setdefault(current_po, []).append(line)

    for line in lines:
        lowered = line.lower()
        if lowered in {"co", "po", "justification"}:
            continue
        if any(marker in lowered for marker in SECTION_STOP_MARKERS):
            break

        co_inline = re.match(r"^(CO\s*\d+)\s*(.*)$", line, flags=re.IGNORECASE)
        if co_inline:
            current_co = normalize_co_code(co_inline.group(1))
            current_po = ""
            remainder = _safe_text(co_inline.group(2))
            if not remainder:
                continue
            line = remainder

        po_inline = re.match(r"^(P(?:O)?\s*0*\d{1,2})\s*(.*)$", line, flags=re.IGNORECASE)
        if po_inline:
            current_po = normalize_po_code(po_inline.group(1))
            remainder = _safe_text(po_inline.group(2))
            if remainder:
                append_reason(remainder)
            continue

        append_reason(line)

    normalized = {}
    for co_code, po_map in data.items():
        normalized[co_code] = {}
        for po_code, reasons in po_map.items():
            reason_text = _normalize_whitespace(" ".join(reasons))
            if reason_text:
                normalized[co_code][po_code] = reason_text

    if normalized:
        return normalized

    normalized_text = _normalize_whitespace(section)
    pair_pattern = re.compile(
        r"(CO\s*\d+)\s+(P(?:O)?\s*0*\d{1,2})\s+(.*?)(?=(?:CO\s*\d+\s+P(?:O)?\s*0*\d{1,2})|(?:P(?:O)?\s*0*\d{1,2}\s+)|$)",
        flags=re.IGNORECASE,
    )
    current_co = ""

    for match in pair_pattern.finditer(normalized_text):
        co_code = normalize_co_code(match.group(1))
        po_code = normalize_po_code(match.group(2))
        reason = _normalize_whitespace(match.group(3))
        if co_code and po_code and reason:
            normalized.setdefault(co_code, {})[po_code] = reason
            current_co = co_code

    if normalized:
        return normalized

    split_tokens = re.split(r"\b(CO\s*\d+)\b", normalized_text, flags=re.IGNORECASE)
    for index in range(1, len(split_tokens), 2):
        co_code = normalize_co_code(split_tokens[index])
        co_block = split_tokens[index + 1] if index + 1 < len(split_tokens) else ""
        if not co_code or not co_block:
            continue
        po_pattern = re.compile(
            r"(P(?:O)?\s*0*\d{1,2})\s+(.*?)(?=(?:P(?:O)?\s*0*\d{1,2}\s+)|$)",
            flags=re.IGNORECASE,
        )
        for match in po_pattern.finditer(co_block):
            po_code = normalize_po_code(match.group(1))
            reason = _normalize_whitespace(match.group(2))
            if po_code and reason:
                normalized.setdefault(co_code, {})[po_code] = reason

    return normalized


def convert_old_po_records(matrix_scores, justification_map):
    converted = {}
    co_codes = set(matrix_scores.keys()) | set(justification_map.keys())

    for co_code in co_codes:
        aggregated = {}
        old_row = matrix_scores.get(co_code, {})
        old_justifications = justification_map.get(co_code, {})

        for old_po in set(old_row.keys()) | set(old_justifications.keys()):
            new_po = OLD_TO_NEW_PO_MAP.get(old_po)
            if not new_po:
                continue

            old_value = old_row.get(old_po, "-")
            level = 0 if old_value in {"-", "0", ""} else int(old_value)
            justification = old_justifications.get(old_po, "")
            entry = aggregated.setdefault(
                new_po,
                {
                    "mapped": False,
                    "level": 0,
                    "old_po_codes": [],
                    "justifications": [],
                },
            )
            if level > 0 or justification:
                entry["mapped"] = True
            entry["level"] = max(entry["level"], level)
            if old_po not in entry["old_po_codes"]:
                entry["old_po_codes"].append(old_po)
            if justification and justification not in entry["justifications"]:
                entry["justifications"].append(justification)

        converted[co_code] = aggregated

    return converted


def build_training_rows_from_reference(path: Path):
    text = extract_text_from_reference(path)
    lines = _clean_lines(text)
    metadata = _parse_course_metadata(lines)
    metadata["source_file"] = str(path)
    course_outcomes = parse_course_outcomes(text)
    old_matrix = parse_old_matrix_scores(text)
    old_justifications = parse_old_justifications(text)
    converted = convert_old_po_records(old_matrix, old_justifications)

    if not course_outcomes:
        return []

    co_codes = list(course_outcomes.keys())
    co_texts = [course_outcomes[co_code] for co_code in co_codes]
    po_catalog = AICTE_POS
    po_texts = [po["text"] for po in po_catalog]
    scores = _rank_texts_against_candidates(
        co_texts,
        po_texts,
        source_codes=co_codes,
        candidate_codes=[po["code"] for po in po_catalog],
    )
    rows = []

    for co_index, co_code in enumerate(co_codes):
        co_text = course_outcomes[co_code]
        co_bloom = detect_bloom_details(co_text)
        converted_map = converted.get(co_code, {})

        for po_index, po in enumerate(po_catalog):
            po_code = po["code"]
            tfidf_score = float(scores["tfidf"][co_index, po_index])
            lexical_score = float(scores["lexical"][co_index, po_index])
            bert_score = float(scores["bert"][co_index, po_index])
            bloom_score, _, po_bloom = bloom_alignment_score(co_text, po["text"])
            base_score = combine_similarity_scores(
                tfidf_score=tfidf_score,
                lexical_score=lexical_score,
                bert_score=bert_score,
                bloom_score=bloom_score,
                bert_available=scores["bert_available"],
            )
            adjusted_score = apply_po_context_bonus(
                base_score,
                source_text=co_text,
                po_code=po_code,
                bloom_label=co_bloom["label"],
            )
            converted_entry = converted_map.get(
                po_code,
                {"mapped": False, "level": 0, "old_po_codes": [], "justifications": []},
            )

            rows.append(
                {
                    **metadata,
                    "co_code": co_code,
                    "co_text": co_text,
                    "new_po_code": po_code,
                    "new_po_text": po["text"],
                    "label": int(converted_entry["mapped"]),
                    "mapping_level": int(converted_entry["level"]),
                    "old_po_codes": converted_entry["old_po_codes"],
                    "teacher_justification": " | ".join(converted_entry["justifications"]),
                    "co_bloom": co_bloom["label"],
                    "po_bloom": po_bloom["label"],
                    "tfidf_score": round(tfidf_score, 6),
                    "lexical_score": round(lexical_score, 6),
                    "bert_score": round(bert_score, 6),
                    "bloom_alignment": round(float(bloom_score), 6),
                    "combined_score": round(float(adjusted_score), 6),
                    "combined_score_percent": _round_percent(adjusted_score),
                }
            )

    return rows


def build_training_dataset(reference_paths=None):
    dataset = []
    valid_paths = []

    for raw_path in reference_paths or DEFAULT_REFERENCE_FILES:
        path = Path(raw_path)
        if path.exists():
            valid_paths.append(path)

    for path in valid_paths:
        dataset.extend(build_training_rows_from_reference(path))

    return dataset


def save_training_dataset(output_path, reference_paths=None):
    dataset = build_training_dataset(reference_paths=reference_paths)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(dataset, indent=2), encoding="utf-8")
    return dataset


def load_reference_paths(reference_paths=None):
    if reference_paths:
        return reference_paths

    if REFERENCE_MANIFEST_PATH.exists():
        try:
            manifest_items = json.loads(REFERENCE_MANIFEST_PATH.read_text(encoding="utf-8"))
            if isinstance(manifest_items, list):
                return manifest_items
        except Exception:
            pass

    return DEFAULT_REFERENCE_FILES


def build_conversion_summary(dataset):
    summary = {
        "subject_count": 0,
        "reference_files": [],
        "subjects": {},
        "old_to_new_po_conversion": OLD_TO_NEW_PO_MAP,
    }

    for row in dataset:
        subject_key = _safe_text(row.get("course_name")) or _safe_text(row.get("subject_name")) or "Unknown Subject"
        subject_summary = summary["subjects"].setdefault(
            subject_key,
            {
                "course_code": _safe_text(row.get("course_code")),
                "academic_year": _safe_text(row.get("academic_year")),
                "semester": _safe_text(row.get("semester")),
                "source_file": _safe_text(row.get("source_file")),
                "co_items": {},
                "positive_pairs": 0,
                "negative_pairs": 0,
            },
        )
        co_summary = subject_summary["co_items"].setdefault(
            row["co_code"],
            {
                "co_text": row["co_text"],
                "mapped_new_pos": [],
                "mapped_old_pos": [],
            },
        )

        if row["label"]:
            subject_summary["positive_pairs"] += 1
            if row["new_po_code"] not in co_summary["mapped_new_pos"]:
                co_summary["mapped_new_pos"].append(row["new_po_code"])
            for old_po in row.get("old_po_codes", []):
                if old_po not in co_summary["mapped_old_pos"]:
                    co_summary["mapped_old_pos"].append(old_po)
        else:
            subject_summary["negative_pairs"] += 1

        source_file = _safe_text(row.get("source_file"))
        if source_file and source_file not in summary["reference_files"]:
            summary["reference_files"].append(source_file)

    summary["subject_count"] = len(summary["subjects"])
    return summary
