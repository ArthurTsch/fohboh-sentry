from __future__ import annotations

import json
import re
from pathlib import Path

from PyPDF2 import PdfReader


SOURCE_PDF = Path(
    "docs/SentryFiles/Trust Score Matters-Arthur/FohBoh MGE 198 Rule Registry DCLS v2 copy.pdf"
)
EXTRACT_TXT = Path("docs/rule-registry-198-extract.txt")
OUTPUT_JSON = Path("docs/rule-registry-198.json")

SECTION_RANGES = [
    (1, 1, 15, "Data Ingestion & Normalization"),
    (2, 16, 55, "Delivery Fee Recovery / DFR"),
    (3, 56, 95, "Merchant Fee Recovery / MFR"),
    (4, 96, 115, "Royalty / Spoke 3"),
    (5, 116, 135, "Trust Gate Evaluation"),
    (6, 136, 145, "Certification State & DCLS"),
    (7, 146, 152, "CAAR & Output Finalization"),
    (8, 153, 165, "Loop B Pattern Analysis & Anomaly Detection"),
    (9, 166, 175, "Cross-Module Reconciliation"),
    (10, 176, 185, "Operator Actions & Workflow"),
    (11, 186, 198, "System Health & Self-Diagnostic"),
]


def section_for_rule(rule_number: int) -> tuple[int, str]:
    for section_number, start, end, title in SECTION_RANGES:
        if start <= rule_number <= end:
            return section_number, title
    raise ValueError(f"Unexpected rule number: {rule_number}")


def extract_pdf_text() -> str:
    reader = PdfReader(str(SOURCE_PDF))
    return "\n".join((page.extract_text() or "") for page in reader.pages)


def parse_rules(text: str) -> list[dict[str, object]]:
    lines = [line.strip() for line in text.splitlines()]

    start_index = next(
        index
        for index, line in enumerate(lines)
        if "Page 4 of 20" in line and "Section 1" in line
    )
    lines = lines[start_index:]

    rule_start = re.compile(r"^(R\d{3})\s+(.*)$")
    skip_prefixes = ("FohBoh | MGE", "Rule ID", "Module", "Section ")

    parsed: list[dict[str, object]] = []
    current_rule_id: str | None = None
    current_parts: list[str] = []

    def flush_current() -> None:
        nonlocal current_rule_id, current_parts
        if not current_rule_id:
            return

        block = " ".join(part for part in current_parts if part)
        block = re.sub(r"\s+", " ", block).strip()

        if " IF " in block:
            rule_name = block.split(" IF ", 1)[0].strip()
        else:
            rule_name = block.strip()

        rule_number = int(current_rule_id[1:])
        section_number, section_title = section_for_rule(rule_number)

        parsed.append(
            {
                "ruleId": current_rule_id,
                "ruleName": rule_name,
                "sectionNumber": section_number,
                "sectionTitle": section_title,
            }
        )

        current_rule_id = None
        current_parts = []

    for line in lines:
        if not line or any(line.startswith(prefix) for prefix in skip_prefixes):
            continue

        match = rule_start.match(line)
        if match:
            rule_id = match.group(1)
            rule_number = int(rule_id[1:])
            if rule_number > 198:
                break

            flush_current()
            current_rule_id = rule_id
            current_parts = [match.group(2).strip()]
            continue

        if current_rule_id:
            current_parts.append(line)

    flush_current()

    return parsed


def build_registry(rules: list[dict[str, object]]) -> dict[str, object]:
    deduped_rules: list[dict[str, object]] = []
    seen: set[str] = set()

    for rule in sorted(rules, key=lambda item: int(str(item["ruleId"])[1:])):
        rule_id = str(rule["ruleId"])
        if rule_id in seen:
            continue
        seen.add(rule_id)
        deduped_rules.append(rule)

    sections: list[dict[str, object]] = []
    for section_number, start, end, title in SECTION_RANGES:
        sections.append(
            {
                "sectionNumber": section_number,
                "sectionTitle": title,
                "startRuleId": f"R{start:03d}",
                "endRuleId": f"R{end:03d}",
                "ruleCount": end - start + 1,
            }
        )

    return {
        "source": str(SOURCE_PDF).replace("\\", "/"),
        "ruleCount": len(deduped_rules),
        "sections": sections,
        "rules": deduped_rules,
    }


def main() -> None:
    text = extract_pdf_text()
    EXTRACT_TXT.write_text(text, encoding="utf-8")

    rules = parse_rules(text)
    registry = build_registry(rules)
    OUTPUT_JSON.write_text(json.dumps(registry, indent=2), encoding="utf-8")

    print(f"Extracted {registry['ruleCount']} rules to {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
