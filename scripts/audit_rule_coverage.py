import json
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "src" / "lib" / "mge" / "rule-registry-198.json"
CLAUSES_PATH = ROOT / "src" / "lib" / "mge" / "rule-registry-198-clauses.json"
CROSSWALK_PATH = ROOT / "src" / "lib" / "mge" / "canonical-registry.ts"
OUTPUT_PATH = ROOT / "docs" / "RULE-COVERAGE-GAP-REPORT.md"

CORE_RUNTIME_FILES = {
    "src/lib/mge/engine.ts": ROOT / "src" / "lib" / "mge" / "engine.ts",
    "src/lib/certification/service.ts": ROOT / "src" / "lib" / "certification" / "service.ts",
    "src/components/sentry/caar-engine.ts": ROOT / "src" / "components" / "sentry" / "caar-engine.ts",
}

SUPPORTING_FILES = {
    "src/components/sentry/overlays/CaarReportModal.tsx": ROOT
    / "src"
    / "components"
    / "sentry"
    / "overlays"
    / "CaarReportModal.tsx",
    "src/app/api/caars/route.ts": ROOT / "src" / "app" / "api" / "caars" / "route.ts",
}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def build_clause_map():
    clauses_doc = read_json(CLAUSES_PATH)
    return {row["ruleId"]: row for row in clauses_doc["rules"]}


def build_crosswalk_map():
    text = CROSSWALK_PATH.read_text(encoding="utf-8")
    pattern = re.compile(
        r'runtimeRuleId:\s*"(?P<runtime>[^"]+)"[\s\S]*?canonicalRuleIds:\s*\[(?P<ids>[^\]]*)\]',
        re.MULTILINE,
    )
    rule_map = defaultdict(list)
    for match in pattern.finditer(text):
        runtime = match.group("runtime")
        ids = re.findall(r'"(R\d{3})"', match.group("ids"))
        for rule_id in ids:
            rule_map[rule_id].append(runtime)
    return dict(rule_map)


def build_file_hits(files):
    hits = defaultdict(list)
    for label, path in files.items():
        text = path.read_text(encoding="utf-8")
        for rule_id in sorted(set(re.findall(r"\bR\d{3}\b", text))):
            hits[rule_id].append(label)
    return dict(hits)


def classify_rule(rule_id, core_hits, crosswalk_hits, supporting_hits):
    if rule_id in core_hits:
        return "implemented"
    if rule_id in crosswalk_hits or rule_id in supporting_hits:
        return "partially_implemented"
    return "registry_only"


def summarize_status(counter):
    return (
        f"implemented `{counter['implemented']}` | "
        f"partially implemented `{counter['partially_implemented']}` | "
        f"registry-only `{counter['registry_only']}`"
    )


def human_status(status):
    if status == "implemented":
        return "Live runtime branch exists"
    if status == "partially_implemented":
        return "Grouped / partial runtime coverage"
    return "Registry only / not runtime-wired"


def section_bucket(sections, rule):
    return next(
        section
        for section in sections
        if section["sectionNumber"] == rule["sectionNumber"]
    )


def main():
    registry = read_json(REGISTRY_PATH)
    rules = registry["rules"]
    sections = registry["sections"]
    clause_map = build_clause_map()
    crosswalk_map = build_crosswalk_map()
    core_hits = build_file_hits(CORE_RUNTIME_FILES)
    supporting_hits = build_file_hits(SUPPORTING_FILES)

    status_counter = Counter()
    section_counters = defaultdict(Counter)
    section_rule_rows = defaultdict(list)

    for rule in rules:
        rule_id = rule["ruleId"]
        status = classify_rule(rule_id, core_hits, crosswalk_map, supporting_hits)
        status_counter[status] += 1
        section_counters[rule["sectionNumber"]][status] += 1

        clause = clause_map.get(rule_id, {})
        runtime_files = core_hits.get(rule_id, [])
        runtime_aliases = crosswalk_map.get(rule_id, [])
        supporting = supporting_hits.get(rule_id, [])

        if runtime_files:
            evidence = ", ".join(f"`{name}`" for name in runtime_files)
        elif runtime_aliases:
            evidence = "Grouped by runtime alias " + ", ".join(f"`{alias}`" for alias in runtime_aliases)
        elif supporting:
            evidence = "Referenced outside core runtime in " + ", ".join(f"`{name}`" for name in supporting)
        else:
            evidence = "Canonical registry only"

        if status == "implemented":
            note = "Direct canonical rule id is referenced in runtime execution or persisted certification assembly."
        elif status == "partially_implemented":
            if runtime_aliases:
                note = (
                    "Covered indirectly through grouped runtime logic; canonical rule exists in the crosswalk, "
                    "but not as a standalone executable branch."
                )
            else:
                note = "Referenced in reporting or supporting code, but not found in core runtime execution."
        else:
            note = "No executable or grouped runtime coverage was found in the audited runtime files."

        section_rule_rows[rule["sectionNumber"]].append(
            {
                "ruleId": rule_id,
                "ruleName": rule["ruleName"],
                "currentStatus": human_status(status),
                "status": status,
                "evidence": evidence,
                "ifCondition": clause.get("ifCondition", ""),
                "thenAction": clause.get("thenAction", ""),
                "note": note,
            }
        )

    biggest_gaps = []
    for section in sections:
        counts = section_counters[section["sectionNumber"]]
        biggest_gaps.append(
            (
                counts["registry_only"],
                counts["partially_implemented"],
                section["sectionNumber"],
                section["sectionTitle"],
            )
        )
    biggest_gaps.sort(reverse=True)

    lines = []
    lines.append("# R001-R198 Runtime Coverage Audit")
    lines.append("")
    lines.append(f"Generated on `2026-07-18` from the canonical registry in `{REGISTRY_PATH.as_posix()}`.")
    lines.append("")
    lines.append("## Overall Summary")
    lines.append("")
    lines.append(
        f"- Canonical rules audited: `{len(rules)}`"
    )
    lines.append(f"- Coverage status: {summarize_status(status_counter)}")
    lines.append("- Audit method:")
    lines.append("  - `implemented`: canonical rule id appears in core runtime files (`engine.ts`, `service.ts`, `caar-engine.ts`).")
    lines.append("  - `partially implemented`: no direct core runtime hit, but the rule is covered by grouped runtime aliases in `canonical-registry.ts` or only appears in supporting/reporting code.")
    lines.append("  - `registry-only`: no core runtime hit and no grouped alias coverage found.")
    lines.append("")
    lines.append("## Highest Gap Sections")
    lines.append("")
    for registry_only, partial, section_number, section_title in biggest_gaps[:5]:
        lines.append(
            f"- Section {section_number} `{section_title}`: registry-only `{registry_only}`, partially implemented `{partial}`"
        )
    lines.append("")
    lines.append("## Section Summary")
    lines.append("")
    lines.append("| Section | Title | Implemented | Partial | Registry-only |")
    lines.append("| --- | --- | ---: | ---: | ---: |")
    for section in sections:
        counts = section_counters[section["sectionNumber"]]
        lines.append(
            f"| {section['sectionNumber']} | {section['sectionTitle']} | {counts['implemented']} | {counts['partially_implemented']} | {counts['registry_only']} |"
        )
    lines.append("")
    lines.append("## Rule-by-Rule Audit")
    lines.append("")

    for section in sections:
        counts = section_counters[section["sectionNumber"]]
        lines.append(
            f"### Section {section['sectionNumber']} - {section['sectionTitle']} ({summarize_status(counts)})"
        )
        lines.append("")
        lines.append(
            "| Rule | Name | Audit Status | Current Runtime Status | Runtime Evidence | Canonical IF | Canonical THEN | Notes |"
        )
        lines.append("| --- | --- | --- | --- | --- | --- | --- | --- |")
        for row in section_rule_rows[section["sectionNumber"]]:
            if_condition = row["ifCondition"].replace("\n", " ").replace("|", "\\|")
            then_action = row["thenAction"].replace("\n", " ").replace("|", "\\|")
            evidence = row["evidence"].replace("|", "\\|")
            note = row["note"].replace("|", "\\|")
            current_status = row["currentStatus"].replace("|", "\\|")
            lines.append(
                f"| {row['ruleId']} | {row['ruleName']} | {row['status']} | {current_status} | {evidence} | {if_condition} | {then_action} | {note} |"
            )
        lines.append("")

    lines.append("## Immediate Implementation Priorities")
    lines.append("")
    lines.append("- Build the missing Royalty / M03 runtime (`R096-R115`), which is still a pure registry gap.")
    lines.append(
        "- Expand Delivery Fee Recovery rules that remain alias-only or registry-only, especially vendor-specific commission, promo, refund, and settlement branches not directly executed in `src/lib/mge/engine.ts`."
    )
    lines.append(
        "- Expand Merchant Fee Recovery coverage beyond grouped aliases so surcharge, assessment, compliance, and contract-change rules are backed by explicit runtime calculations instead of shared variance proxies."
    )
    lines.append(
        "- Deepen Loop B, cross-module, workflow, and system-health branches where the UI/reporting path exists but standalone canonical rule execution is still incomplete."
    )
    lines.append("")
    lines.append("## Audited Files")
    lines.append("")
    for label in CORE_RUNTIME_FILES:
        lines.append(f"- Core runtime: `{label}`")
    for label in SUPPORTING_FILES:
        lines.append(f"- Supporting/runtime-adjacent: `{label}`")

    OUTPUT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
