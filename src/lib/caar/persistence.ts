import { createHash } from "crypto";
import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";
import type {
  CertificationResult,
  ModuleAssessment,
} from "@/components/sentry/caar-engine";
import type { CaarRecord } from "@/components/sentry/types";
import { readArtifactBlob, readUploadBlob, persistArtifactBlob } from "@/lib/uploads/storage";

type TxClient = PrismaClient | Prisma.TransactionClient;

type RunRecord = {
  assessment: ModuleAssessment;
  id: number;
  module: "M01" | "M02" | "M03";
  vendor?: string;
  schemaRegistryIds: number[];
  uploadIds: number[];
  varianceCents: bigint;
};

type PersistCaarArgs = {
  certification: CertificationResult;
  customerId: number;
  locationId: number;
  record: CaarRecord;
  runRecords: RunRecord[];
};

type GenerateClaimPackArgs = {
  caarExternalId: string;
  customerId: number | null;
  locationId: number;
  uploadLocationId?: number | null;
};

type ProducedArtifact = {
  bytes: Buffer;
  contentType: string;
  name: string;
  seq: number;
  sha256: string;
  type: string;
};

function toJsonValue(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function pickPrimaryRun(runRecords: RunRecord[]) {
  return [...runRecords].sort((left, right) => {
    if (right.varianceCents !== left.varianceCents) {
      return right.varianceCents > left.varianceCents ? 1 : -1;
    }
    if (right.assessment.score !== left.assessment.score) {
      return right.assessment.score - left.assessment.score;
    }
    return left.module.localeCompare(right.module);
  })[0];
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",")}}`;
}

function toIsoMinute(value: Date) {
  return `${value.toISOString().slice(0, 19)}Z`;
}

function deriveCertificationClass({
  cadence,
  ready,
  trustScore,
}: {
  cadence: CertificationResult["cadence"];
  ready: boolean;
  trustScore: number;
}) {
  if (ready && cadence === "monthly_final" && trustScore >= 85) {
    return "Certified";
  }
  if (trustScore >= 70) {
    return "Qualified";
  }
  if (trustScore >= 50) {
    return "At Risk";
  }
  return "Not Certifiable";
}

function normalizeFindingClass(record: CaarRecord, amountValue: number) {
  if (amountValue > 100) return "BREACH_OVERCHARGE";
  if (amountValue < -100) return "BREACH_UNDERCHARGE";
  return record.status === "Certified" ? "NO_FINDING" : "INCONCLUSIVE";
}

function normalizeMq6Label(name: string) {
  return name.toLowerCase().replace(/\s+/g, "_").replace(/[^\w]/g, "");
}

function buildCanonicalPayload({
  customerId,
  locationId,
  prevCaarSha256,
  certification,
  record,
  runRecords,
  sealedAt,
}: {
  customerId: number;
  locationId: number;
  prevCaarSha256: string | null;
  certification: CertificationResult;
  record: CaarRecord;
  runRecords: RunRecord[];
  sealedAt: Date;
}) {
  const certificationClass = deriveCertificationClass({
    cadence: certification.cadence,
    ready: certification.ready,
    trustScore: certification.trustScore,
  });
  const moduleLabel =
    runRecords[0]?.module === "M01"
      ? "Merchant Fee Recovery"
      : runRecords[0]?.module === "M02"
        ? "Delivery Fee Recovery"
        : "Royalty Recovery";
  const mq6Entries = Object.fromEntries(
    record.dimensions.map((dimension) => [
      normalizeMq6Label(dimension.name),
      {
        badge:
          dimension.score >= 85 ? "PASS" : dimension.score >= 60 ? "PARTIAL" : "FAIL",
        detail: `${dimension.name} scored ${dimension.score} with weight ${dimension.weight}.`,
        score_pct: dimension.score,
      },
    ]),
  );
  const remediationSteps =
    certification.ready
      ? []
      : certification.assessments.flatMap((assessment) =>
          assessment.findings.map((finding, index) => ({
            action: finding,
            owner:
              finding.toLowerCase().includes("contract") || finding.toLowerCase().includes("schema")
                ? "WGS Manager"
                : finding.toLowerCase().includes("missing")
                  ? "Operator"
                  : "System",
            step_id: `${assessment.moduleId}-R-${String(index + 1).padStart(3, "0")}`,
          })),
        );
  const ruleCitations = runRecords.flatMap((run) =>
    run.assessment.ruleCitations.map((citation) => ({
      disposition: citation.disposition,
      fired_count: citation.firedCount,
      module: run.module,
      rule_id: citation.ruleId,
      rule_version: citation.ruleVersion,
      sample_evidence: citation.sampleEvidence.map((sample) => ({
        ...sample,
        run_id: run.id,
      })),
      variance_cents: citation.varianceCents,
    })),
  );
  const overallRuleCitations = certification.overallRuleCitations.map((citation) => ({
    disposition: citation.disposition,
    fired_count: citation.firedCount,
    module: "CAAR",
    rule_id: citation.ruleId,
    rule_version: citation.ruleVersion,
    sample_evidence: citation.sampleEvidence.map((sample) => ({
      ...sample,
      scope: "overall_caar",
    })),
    variance_cents: citation.varianceCents,
  }));

  const evidenceTrace = runRecords.flatMap((run) => [
    ...run.uploadIds.map((uploadId) => ({
      artifact: `Upload #${uploadId}`,
      module: run.module,
      source: "Persisted source artifact",
      trace: `uploads_v2#${uploadId} -> cert_runs_v2#${run.id}`,
    })),
    ...run.schemaRegistryIds.map((schemaId) => ({
      artifact: `Schema #${schemaId}`,
      module: run.module,
      source: "Sealed schema registry",
      trace: `schema_registry_v2#${schemaId} -> cert_runs_v2#${run.id}`,
    })),
  ]);

  return {
    attestation: {
      integrity_hash: "PENDING",
      sealed_by_actor: "system",
      timestamp: toIsoMinute(sealedAt),
    },
    calculation_trace: {
      fields: [
        { label: "Certified Variance", value: certification.amountValue },
        { label: "Trust Score", value: certification.trustScore },
        { label: "Cadence", value: certification.cadence },
      ],
      formula:
        runRecords[0]?.module === "M01"
          ? "Variance = Actual processor fees - Expected processor fees"
          : "Variance = Actual DSP fees - Expected DSP fees",
    },
    evidence_trace: evidenceTrace,
    field_audit: [
      { field: "CAAR ID", source: "Persisted CAAR record", value: record.id },
      { field: "Module", source: "Certification run", value: runRecords[0]?.module ?? "M01" },
      { field: "Certification Period", source: "Certification request", value: record.period },
      { field: "Trust Score", source: "Deterministic trust engine", value: String(certification.trustScore) },
      { field: "Certified Variance", source: "Deterministic calculation trace", value: record.amount },
      { field: "Rule Set", source: "Locked certification run", value: certification.ruleSetVersion },
      { field: "Seal Timestamp", source: "Immutable CAAR artifact", value: toIsoMinute(sealedAt) },
    ],
    caar_external_id: record.id,
    certification_class: certificationClass,
    chain_of_custody: [
      {
        assessment: "Certification request recorded and scoped to a persisted location.",
        event: "Submission Received",
        status: "RECORDED",
      },
      {
        assessment: "Source artifacts were loaded from persisted upload records.",
        event: "Evidence Loaded",
        status: "VERIFIED",
      },
      {
        assessment: "Deterministic rule engine executed against locked governed inputs.",
        event: "Rule Evaluation",
        status: "ATTESTED",
      },
      {
        assessment: "Canonical CAAR payload sealed and stored as immutable artifact.",
        event: "Payload Sealed",
        status: "SEALED",
      },
      {
        assessment: certification.ready
          ? "Certified Automated Audit & Recovery package completed."
          : "Certification completed with unresolved release gates.",
        event: "Certification Complete",
        status: certification.ready ? "COMPLETE" : "PENDING",
      },
    ],
    composite_trust_score: certification.trustScore,
    composite_trust_gates: certification.overallTrustGates,
    cross_module: {
      aggregate_variance: certification.crossModule.aggregateVariance,
      conflict: certification.crossModule.conflict,
      findings: certification.crossModule.findings,
      module_weight_imbalance: certification.crossModule.moduleWeightImbalance,
      reviewed_fee_weights: certification.crossModule.reviewedFeeWeights,
      total_recovery_eligible: certification.crossModule.totalRecoveryEligible,
    },
    court_admissible: certification.ready,
    customer: {
      id: customerId,
      name: record.accountId,
    },
    engine: {
      name: "MGE",
      rule_set_version: certification.ruleSetVersion,
      version: "v1.0",
    },
    exhibits: [
      {
        description: `${moduleLabel} evidence package`,
        exhibit_id: "EX-001",
        integrity: "sealed",
        source: record.locationName,
        status: "SEALED",
      },
      ...record.findings.slice(0, 4).map((finding, index) => ({
        description: finding,
        exhibit_id: `EX-${String(index + 2).padStart(3, "0")}`,
        integrity: "verified",
        source: runRecords[index % runRecords.length]?.module ?? "MGE",
        status: certification.ready ? "VERIFIED" : "PROVIDED",
      })),
    ],
    exportpack: null,
    finding_class:
      runRecords[0]?.assessment.findingClass ?? normalizeFindingClass(record, certification.amountValue),
    limits_text:
      certification.ready
        ? "This CAAR is certified for external submission based on the persisted evidence package and locked rule execution recorded for this run."
        : "This CAAR is suitable for internal review and remediation planning only until the unresolved evidence and reconciliation controls are remediated.",
    limitations_text:
      certification.ready
        ? "Certified output is bounded by the uploaded evidence package, the sealed governed configurations, and the locked rule set version captured at certification time."
        : "This output is not externally deliverable until the missing evidence, provenance, or reconciliation gaps identified in the report are resolved and a monthly final run succeeds.",
    location: {
      address: null,
      external_id: record.locationId,
      id: locationId,
      name: record.locationName,
    },
    loop_a: {
      items: runRecords.map(
        (run) =>
          `${run.module} executed with ${run.uploadIds.length} uploads, ${run.schemaRegistryIds.length} schema references, and variance ${Number(run.varianceCents)} cents.`,
      ),
      status: "COMPLETE",
    },
    loop_b: {
      baseline_hash: certification.loopB.baselineHash,
      findings: certification.loopB.findings.map((finding) => ({
        affected_periods: finding.affectedPeriods,
        caar_eligible: finding.caarEligible,
        confidence_score: finding.confidenceScore,
        detail: finding.detail,
        impacts_certification: finding.impactsCertification,
        module: finding.moduleId,
        pattern_code: finding.patternCode,
        rule_id: finding.ruleId,
      })),
      items:
        certification.loopB.findings.length > 0
          ? certification.loopB.findings.map(
              (finding) =>
                `${finding.ruleId} | ${finding.patternCode} | confidence=${finding.confidenceScore} | ${finding.detail}`,
            )
          : ["No pattern findings promoted from the active 13-week historical window."],
      status: certification.loopB.status,
      window_size: certification.loopB.windowSize,
    },
    module: runRecords[0]?.module ?? "M01",
    module_label: moduleLabel,
    mq6: mq6Entries,
    period: record.period,
    prev_caar_sha256: prevCaarSha256,
    reconciliation_proof: [
      {
        assessment: "Source statement and truth-source evidence were evaluated together.",
        control: "Source vs Truth Source",
        status: "REVIEWED",
      },
      {
        assessment:
          certification.cadence === "weekly_preliminary"
            ? "Final bank tie-out intentionally deferred for preliminary cadence."
            : "Bank reconciliation is required for monthly final release.",
        control: "Bank Reconciliation Gate",
        status:
          certification.cadence === "weekly_preliminary"
            ? "REVIEWED"
            : certification.ready
              ? "PROVEN"
              : "NOT PROVEN",
      },
    ],
    recoverable_variance_cents: Math.round(certification.amountValue * 100),
    remediation_steps: remediationSteps,
    rule_citations: [...ruleCitations, ...overallRuleCitations],
    score_deductions: record.dimensions
      .filter((dimension) => dimension.score < 100)
      .map((dimension) => {
        const weightPercent = Number.parseFloat(dimension.weight) || 0;
        const pointsLost = weightPercent * (1 - dimension.score / 100);
        return {
          calculation: `${dimension.score}/100 x ${weightPercent}% = ${(weightPercent - pointsLost).toFixed(2)} earned; ${pointsLost.toFixed(2)} lost`,
          dimension: dimension.name,
          points_lost: Number(pointsLost.toFixed(2)),
          score: dimension.score,
          weight_percent: weightPercent,
        };
      }),
    trust_gates: Object.entries(certification.overallTrustGates).map(([gate, result]) => ({
      detail: result.detail,
      gate,
      rule_ids: result.canonicalRuleIds,
      score: result.scorePct,
    })),
    schema_version: "1.0",
    sealed_at: toIsoMinute(sealedAt),
    system_health: {
      detail: certification.overallSystemHealth.detail,
      flags: certification.overallSystemHealth.flags,
      master_system_healthy: certification.overallSystemHealth.masterSystemHealthy,
      penalty_points: certification.overallSystemHealth.penaltyPoints,
    },
    vault: {
      contract_config_version: Math.max(...runRecords.map((run) => run.id), 0),
      schema_registry_versions: runRecords.map((run) => ({
        vendor: run.module,
        version: Math.max(...run.schemaRegistryIds, 0),
      })),
    },
    workflow: {
      authenticated: certification.workflow.authenticated,
      authorized: certification.workflow.authorized,
      dispute_eligible: certification.workflow.disputeEligible,
      manual_review_required: certification.workflow.manualReviewRequired,
      notifications: certification.workflow.notifications,
      state: certification.workflow.state,
    },
  };
}

type PdfSection = { title: string; subtitle?: string; rows: string[] };

function pdfSafe(value: unknown) {
  return String(value ?? "-")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pdfEscape(value: string) {
  return pdfSafe(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapPdfText(value: unknown, maxCharacters = 88) {
  const words = pdfSafe(value).split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= maxCharacters) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : ["-"];
}

function buildProfessionalPdfBuffer(
  payload: ReturnType<typeof buildCanonicalPayload>,
  sections: PdfSection[],
  metadata: Record<string, string>,
) {
  const pages: string[][] = [];
  let commands: string[] = [];
  let y = 742;
  const text = (value: unknown, x: number, size: number, font = "F1", color = "0.12 0.12 0.14") => {
    commands.push(`${color} rg BT /${font} ${size} Tf ${x} ${y} Td (${pdfEscape(String(value))}) Tj ET`);
  };
  const pageFrame = () => {
    commands.push("0.82 0.10 0.12 rg 0 782 612 10 re f", "0.96 0.96 0.95 rg 0 0 612 34 re f");
    y = 762;
    text("FOHBOH  |  CERTIFIED AUDIT & RECOVERY", 42, 7, "F2", "0.36 0.36 0.40");
    y = 18;
    text(`${payload.caar_external_id}  |  SEALED ${payload.sealed_at}`, 42, 7, "F1", "0.42 0.42 0.46");
    y = 716;
  };
  const finishPage = () => {
    pages.push(commands);
    commands = [];
    y = 716;
    pageFrame();
  };
  const ensure = (height: number) => {
    if (y - height < 50) finishPage();
  };
  const paragraph = (value: unknown, options?: { bold?: boolean; color?: string; indent?: number; size?: number }) => {
    const size = options?.size ?? 9;
    const lines = wrapPdfText(value, options?.indent ? 80 : 88);
    ensure(lines.length * 13 + 5);
    for (const line of lines) {
      text(line, 48 + (options?.indent ?? 0), size, options?.bold ? "F2" : "F1", options?.color);
      y -= 13;
    }
  };

  pageFrame();
  commands.push(
    "0.055 0.09 0.15 rg 0 548 612 202 re f",
    "0.82 0.10 0.12 rg 42 526 82 5 re f",
    "0.93 0.94 0.95 rg 42 443 165 62 re f",
    "0.93 0.94 0.95 rg 224 443 165 62 re f",
    "0.93 0.94 0.95 rg 406 443 164 62 re f",
  );
  y = 704;
  text("FOHBOH  /  MGE CERTIFICATION ENGINE", 42, 8, "F2", "0.92 0.25 0.27");
  y -= 34;
  text("CAAR REPORT", 42, 29, "F2", "1 1 1");
  y -= 38;
  text(payload.module_label, 42, 15, "F1", "0.88 0.90 0.93");
  y -= 25;
  text(`${payload.location.name}  /  ${payload.period}`, 42, 10, "F1", "0.70 0.75 0.82");
  y = 481;
  text("TRUST SCORE", 55, 7, "F2", "0.42 0.44 0.48");
  y -= 25;
  text(`${payload.composite_trust_score} / 100`, 55, 19, "F2", "0.08 0.12 0.18");
  y = 481;
  text("RELEASE STATUS", 237, 7, "F2", "0.42 0.44 0.48");
  y -= 25;
  text(payload.court_admissible ? "CERTIFIED" : "REMEDIATION", 237, 14, "F2", payload.court_admissible ? "0.08 0.45 0.25" : "0.76 0.12 0.14");
  y = 481;
  text("CERTIFIED VARIANCE", 419, 7, "F2", "0.42 0.44 0.48");
  y -= 25;
  text(`$${(payload.recoverable_variance_cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, 419, 14, "F2", "0.08 0.12 0.18");
  y = 408;
  text("REPORT CONTROL", 42, 8, "F2", "0.60 0.18 0.19");
  y -= 24;
  const overview = [
    ["Certification class", payload.certification_class],
    ["CAAR identifier", payload.caar_external_id],
    ["Rule set", payload.engine.rule_set_version],
    ["Sealed at", payload.sealed_at],
  ];
  for (const [label, value] of overview) {
    commands.push(`0.86 0.86 0.86 RG 42 ${y - 8} 528 1 re S`);
    text(label.toUpperCase(), 42, 7, "F2", "0.45 0.45 0.49");
    text(value, 190, 9, "F2", "0.14 0.14 0.17");
    y -= 29;
  }
  y -= 10;
  paragraph(payload.limits_text, { color: "0.30 0.30 0.34" });
  finishPage();

  text("REPORT CONTENTS", 42, 20, "F2", "0.08 0.12 0.18");
  y -= 20;
  paragraph("A structured record of certification status, score construction, source evidence, rule findings, and attestation.", { color: "0.42 0.42 0.46" });
  y -= 15;
  sections.forEach((section, index) => {
    ensure(35);
    commands.push(`0.82 0.10 0.12 rg 42 ${y - 4} 22 22 re f`);
    text(String(index + 1).padStart(2, "0"), 48, 8, "F2", "1 1 1");
    text(section.title, 78, 10, "F2", "0.12 0.14 0.18");
    commands.push(`0.87 0.87 0.87 RG 78 ${y - 11} 492 1 re S`);
    y -= 34;
  });
  finishPage();

  for (const [sectionIndex, section] of sections.entries()) {
    const minimumSectionHeight = section.title.includes("MQ6 Dimensions")
      ? 430
      : section.title === "Current Workflow"
        ? 340
        : section.title.includes("Certification")
          ? 250
          : section.title === "Exhibit Coverage"
            ? 300
            : section.title === "Attestation"
              ? 220
              : 140;
    ensure(minimumSectionHeight);
    text(`SECTION ${String(sectionIndex + 1).padStart(2, "0")}`, 42, 7, "F2", "0.72 0.14 0.16");
    y -= 25;
    text(section.title.toUpperCase(), 42, 16, "F2", "0.08 0.12 0.18");
    y -= 20;
    commands.push(`0.82 0.10 0.12 rg 42 ${y + 6} 72 3 re f`);
    y -= 7;
    if (section.subtitle) {
      paragraph(section.subtitle, { color: "0.42 0.42 0.46", size: 8 });
    }
    y -= 4;
    const sectionRows = section.rows.length > 0 ? section.rows : ["No findings recorded for this section."];
    for (const [rowIndex, row] of sectionRows.entries()) {
      if (section.title.includes("MQ6 Dimensions")) {
        const [label = "Dimension", rawScore = "0/100", badge = "REVIEW", detail = ""] = row.split(" | ");
        const score = Math.max(0, Math.min(100, Number.parseFloat(rawScore) || 0));
        const detailLines = wrapPdfText(detail, 78);
        ensure(55 + detailLines.length * 11);
        text(label.toUpperCase(), 48, 8, "F2", "0.16 0.18 0.22");
        text(`${score}/100`, 490, 8, "F2", score >= 85 ? "0.08 0.45 0.25" : score >= 60 ? "0.78 0.48 0.08" : "0.76 0.12 0.14");
        y -= 14;
        commands.push(`0.89 0.90 0.91 rg 48 ${y} 430 7 re f`);
        commands.push(`${score >= 85 ? "0.10 0.55 0.31" : score >= 60 ? "0.92 0.60 0.12" : "0.82 0.10 0.12"} rg 48 ${y} ${Math.max(3, 4.3 * score)} 7 re f`);
        commands.push(`${score >= 85 ? "0.90 0.97 0.92" : score >= 60 ? "1 0.96 0.84" : "1 0.91 0.91"} rg 493 ${y - 3} 65 14 re f`);
        y += 1;
        text(badge, 506, 7, "F2", score >= 85 ? "0.08 0.45 0.25" : score >= 60 ? "0.63 0.36 0.04" : "0.72 0.10 0.12");
        y -= 18;
        for (const line of detailLines) {
          text(line, 48, 7.5, "F1", "0.42 0.42 0.46");
          y -= 11;
        }
        y -= 12;
        continue;
      }

      if (section.title === "Current Workflow" && rowIndex >= 2) {
        const [event = row, assessment = ""] = row.split(" | ");
        ensure(47);
        commands.push("0.82 0.10 0.12 rg " + `48 ${y - 7} 22 22 re f`);
        text(String(rowIndex - 1).padStart(2, "0"), 54, 7, "F2", "1 1 1");
        text(event, 82, 8.5, "F2", "0.16 0.18 0.22");
        y -= 16;
        paragraph(assessment, { color: "0.42 0.42 0.46", indent: 34, size: 7.5 });
        if (rowIndex < sectionRows.length - 1) commands.push(`0.84 0.84 0.85 RG 59 ${y - 2} 1 13 re S`);
        y -= 9;
        continue;
      }

      if (section.title === "Score Deduction Ledger" && row.includes(" | ")) {
        const [dimension, calculation] = row.split(" | ");
        const lostMatch = calculation.match(/([0-9.]+) lost/i);
        const pointsLost = lostMatch ? Number.parseFloat(lostMatch[1]) : 0;
        ensure(48);
        commands.push("0.98 0.94 0.94 rg " + `42 ${y - 28} 528 38 re f`, "0.82 0.10 0.12 rg " + `42 ${y - 28} 4 38 re f`);
        text(dimension, 54, 8.5, "F2", "0.16 0.18 0.22");
        text(`-${pointsLost.toFixed(2)} PTS`, 488, 8, "F2", "0.76 0.12 0.14");
        y -= 16;
        text(calculation, 54, 7.5, "F1", "0.42 0.42 0.46");
        y -= 31;
        continue;
      }

      if ((section.title === "Blocking Rules" || section.title === "Score-Reducing Rules") && row.includes(" | ")) {
        const [ruleId, ...metadata] = row.split(" | ");
        ensure(39);
        const blockingRule = section.title === "Blocking Rules";
        commands.push(`${blockingRule ? "1 0.90 0.90" : "1 0.96 0.84"} rg 42 ${y - 21} 68 29 re f`);
        text(ruleId, 53, 8, "F2", blockingRule ? "0.72 0.10 0.12" : "0.62 0.36 0.04");
        text(metadata.join("  /  "), 122, 7.5, "F1", "0.28 0.28 0.32");
        commands.push(`0.88 0.88 0.87 RG 42 ${y - 25} 528 1 re S`);
        y -= 38;
        continue;
      }

      if (section.title === "Exhibit Coverage" && row.includes(" | ")) {
        const [exhibitId, status, source, description] = row.split(" | ");
        const verified = /SEALED|VERIFIED/i.test(status);
        const descriptionLines = wrapPdfText(description, 60);
        ensure(39 + descriptionLines.length * 10);
        commands.push(`${verified ? "0.90 0.97 0.92" : "0.94 0.94 0.94"} rg 42 ${y - 20} 68 27 re f`);
        text(exhibitId, 53, 8, "F2", verified ? "0.08 0.45 0.25" : "0.35 0.35 0.38");
        text(source, 122, 8, "F2", "0.16 0.18 0.22");
        text(status, 443, 7, "F2", verified ? "0.08 0.45 0.25" : "0.45 0.45 0.48");
        y -= 15;
        for (const line of descriptionLines) {
          text(line, 122, 7.5, "F1", "0.42 0.42 0.46");
          y -= 10;
        }
        commands.push(`0.88 0.88 0.87 RG 42 ${y - 3} 528 1 re S`);
        y -= 13;
        continue;
      }

      if (section.title === "Attestation" && rowIndex === 0) {
        ensure(82);
        commands.push(
          "0.055 0.09 0.15 rg " + `42 ${y - 62} 528 70 re f`,
          "0.82 0.10 0.12 RG 50 " + `${y - 54} 54 54 re S`,
        );
        text("SEALED", 58, 9, "F2", "0.92 0.25 0.27");
        y -= 18;
        text("CAAR", 60, 13, "F2", "1 1 1");
        y += 18;
        text("IMMUTABLE CERTIFICATION RECORD", 122, 9, "F2", "1 1 1");
        y -= 18;
        text(row, 122, 7.5, "F1", "0.76 0.80 0.86");
        y -= 62;
        continue;
      }

      const rowLines = wrapPdfText(row, 82);
      ensure(rowLines.length * 12 + 19);
      const boxHeight = rowLines.length * 12 + 11;
      commands.push(
        `0.985 0.985 0.98 rg 42 ${y - boxHeight + 7} 528 ${boxHeight} re f`,
        `0.88 0.88 0.87 RG 42 ${y - boxHeight + 7} 528 ${boxHeight} re S`,
        `0.82 0.10 0.12 rg 42 ${y - boxHeight + 7} 3 ${boxHeight} re f`,
      );
      for (const [index, line] of rowLines.entries()) {
        text(line, 54, 8.5, index === 0 ? "F2" : "F1", index === 0 ? "0.16 0.16 0.18" : "0.30 0.30 0.34");
        y -= 12;
      }
      y -= 10;
    }
    y -= 12;
  }
  if (commands.length > 0) pages.push(commands);

  const objects = ["<< /Type /Catalog /Pages 2 0 R >>"];
  const fontRegular = 3 + pages.length * 2;
  const fontBold = fontRegular + 1;
  const infoObjectNumber = fontBold + 1;
  objects.push(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] >>`);
  pages.forEach((pageCommands, index) => {
    const pageObjectNumber = 3 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    const content = [
      ...pageCommands,
      `0.42 0.42 0.46 rg BT /F1 7 Tf 530 18 Td (PAGE ${index + 1} / ${pages.length}) Tj ET`,
    ].join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjectNumber} 0 R /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> >>`);
    objects.push(`<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`);
  });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  objects.push(`<< ${Object.entries(metadata).map(([key, value]) => `/${key.replace(/[^A-Za-z0-9]/g, "_")} (${pdfEscape(value)})`).join(" ")} >>`);
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoObjectNumber} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function buildPdfSections(payload: ReturnType<typeof buildCanonicalPayload>): PdfSection[] {
  const mq6Rows = Object.entries(payload.mq6 as Record<string, { badge: string; detail: string; score_pct: number }>);
  const blocking = payload.rule_citations.filter((row) => row.disposition === "blocking");
  const scoreRuleIds = new Set(payload.trust_gates.filter((gate) => gate.score < 100).flatMap((gate) => gate.rule_ids));
  const scoreReducing = payload.rule_citations.filter((row) => row.disposition !== "blocking" && scoreRuleIds.has(row.rule_id));
  const citationRow = (row: (typeof payload.rule_citations)[number]) =>
    `${row.rule_id} | v${row.rule_version} | ${row.module ?? "CAAR"} | fired ${row.fired_count} time(s) | variance $${(row.variance_cents / 100).toFixed(2)}`;
  return [
    { title: "Current Workflow", subtitle: "The certified workflow state captured when this report was sealed.", rows: [
      `State: ${payload.workflow.state} | Authenticated: ${payload.workflow.authenticated ? "Yes" : "No"} | Authorized: ${payload.workflow.authorized ? "Yes" : "No"}`,
      `Dispute eligible: ${payload.workflow.dispute_eligible ? "Yes" : "No"} | Manual review required: ${payload.workflow.manual_review_required ? "Yes" : "No"}`,
      ...payload.chain_of_custody.map((row) => `${row.event} - ${row.status} | ${row.assessment}`),
    ] },
    { title: `${payload.module_label} Certification`, subtitle: "Certified outcome and deterministic calculation basis.", rows: [
      `Certification class: ${payload.certification_class} | Release: ${payload.court_admissible ? "Certified" : "Not certified"}`,
      ...payload.calculation_trace.fields.map((field) => `${field.label}: ${field.value}`),
      `Formula: ${payload.calculation_trace.formula}`,
      ...payload.reconciliation_proof.map((row) => `${row.control} - ${row.status} | ${row.assessment}`),
    ] },
    { title: "Score Deduction Ledger", subtitle: "Every displayed deduction shows the score, weight, earned points, and points not earned.", rows: payload.score_deductions.map((row) => `${row.dimension} | ${row.calculation}`) },
    { title: "Field Audit", subtitle: "Report fields and the persisted source used to support each value.", rows: payload.field_audit.map((row) => `${row.field}: ${row.value} | Source: ${row.source}`) },
    { title: "Evidence Trace", subtitle: "Lineage from persisted evidence and governed schemas into the certification run.", rows: payload.evidence_trace.map((row) => `${row.module} | ${row.artifact} | ${row.source} | ${row.trace}`) },
    { title: "Supporting Diagnostics | MQ6 Dimensions", subtitle: "The six evidence-quality dimensions that form the composite trust score.", rows: mq6Rows.map(([name, row]) => `${name.replace(/_/g, " ")} | ${row.score_pct}/100 | ${row.badge} | ${row.detail}`) },
    { title: "Evidence & Provenance", subtitle: "Governed configuration and historical chain used by this sealed report.", rows: [
      `Previous CAAR SHA-256: ${payload.prev_caar_sha256 ?? "None - first report in chain"}`,
      `Vault contract version: ${payload.vault.contract_config_version}`,
      ...payload.vault.schema_registry_versions.map((row) => `Schema registry | ${row.vendor} | version ${row.version}`),
    ] },
    { title: "Settlement Timing Context", subtitle: "Timing and bank tie-out requirements for the selected certification period.", rows: [
      `Certification period: ${payload.period} | Cadence: ${String(payload.calculation_trace.fields.find((row) => row.label === "Cadence")?.value ?? "monthly_final")}`,
      ...payload.reconciliation_proof.map((row) => `${row.control}: ${row.assessment}`),
      ...payload.loop_b.items,
    ] },
    { title: "Exhibit Coverage", subtitle: "Artifacts registered with this CAAR and their integrity state.", rows: payload.exhibits.map((row) => `${row.exhibit_id} | ${row.status} / ${row.integrity} | ${row.source} | ${row.description}`) },
    { title: "Attestation", subtitle: "Integrity statement for the immutable report artifact.", rows: [
      `Sealed by: ${payload.attestation.sealed_by_actor} | Timestamp: ${payload.attestation.timestamp}`,
      `Integrity hash: ${payload.attestation.integrity_hash}`,
      `Blocking rules: ${blocking.length} | Score-reducing rules: ${scoreReducing.length}`,
      payload.limitations_text,
    ] },
    { title: "Blocking Rules", subtitle: "Rules that independently prevent certified release.", rows: blocking.map(citationRow) },
    { title: "Score-Reducing Rules", subtitle: "Rules linked to a trust gate below 100 that reduce the score without independently blocking release.", rows: scoreReducing.map(citationRow) },
  ];
}

function normalizeCsvValue(value: string) {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCsvBuffer(buffer: Buffer) {
  const text = buffer.toString("utf8");
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [] as string[], rows: [] as string[][] };
  }
  return {
    headers: lines[0].split(",").map((header) => header.trim()),
    rows: lines.slice(1).map((line) => line.split(",").map((cell) => cell.trim())),
  };
}

function bufferToCsv(headers: string[], rows: string[][]) {
  const content = [
    headers.map(normalizeCsvValue).join(","),
    ...rows.map((row) => row.map((value) => normalizeCsvValue(String(value ?? ""))).join(",")),
  ].join("\n");
  return Buffer.from(content, "utf8");
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildStoredZip(entries: Array<{ bytes: Buffer; name: string }>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.bytes);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(entry.bytes.length, 18);
    localHeader.writeUInt32LE(entry.bytes.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuffer, entry.bytes);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(entry.bytes.length, 20);
    centralHeader.writeUInt32LE(entry.bytes.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + entry.bytes.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const localData = Buffer.concat(localParts);
  const endHeader = Buffer.alloc(22);
  endHeader.writeUInt32LE(0x06054b50, 0);
  endHeader.writeUInt16LE(0, 4);
  endHeader.writeUInt16LE(0, 6);
  endHeader.writeUInt16LE(entries.length, 8);
  endHeader.writeUInt16LE(entries.length, 10);
  endHeader.writeUInt32LE(centralDirectory.length, 12);
  endHeader.writeUInt32LE(localData.length, 16);
  endHeader.writeUInt16LE(0, 20);

  return Buffer.concat([localData, centralDirectory, endHeader]);
}

async function upsertArtifactRecord({
  byteCount,
  caarId,
  name,
  s3Key,
  seq,
  sha256,
  tx,
  type,
}: {
  byteCount: bigint;
  caarId: number;
  name: string;
  s3Key: string;
  seq: number;
  sha256: string;
  tx: TxClient;
  type: string;
}) {
  return tx.caar_artifacts_v2.upsert({
    where: {
      caar_id_seq: {
        caar_id: caarId,
        seq,
      },
    },
    update: {
      artifact_type: type,
      byte_count: byteCount,
      name,
      s3_key: s3Key,
      sha256,
    },
    create: {
      artifact_type: type,
      byte_count: byteCount,
      caar_id: caarId,
      name,
      s3_key: s3Key,
      seq,
      sha256,
    },
  });
}

export async function persistGeneratedCaar(
  tx: TxClient,
  {
    certification,
    customerId,
    locationId,
    record,
    runRecords,
  }: PersistCaarArgs,
) {
  const primaryRun = pickPrimaryRun(runRecords);
  if (!primaryRun) {
    throw new Error("No certification run records were created for this CAAR.");
  }

  const existing = await tx.caars_v2.findFirst({
    where: {
      caar_external_id: record.id,
    },
    select: {
      id: true,
      sha256: true,
    },
  });

  const previousActive = await tx.caars_v2.findFirst({
    where: {
      caar_external_id: {
        not: record.id,
      },
      location_id: locationId,
      module: primaryRun.module,
      vendor: primaryRun.vendor ?? null,
      period: record.period,
      superseded_by: null,
    },
    orderBy: [{ sealed_at: "desc" }, { id: "desc" }],
    select: {
      id: true,
      sha256: true,
    },
  });

  const sealedAt = new Date();
  const prevCaarSha256 = existing?.sha256 ?? previousActive?.sha256 ?? null;
  const pendingPayload = buildCanonicalPayload({
    customerId,
    locationId,
    prevCaarSha256,
    certification,
    record,
    runRecords,
    sealedAt,
  });
  const firstPassHash = createHash("sha256")
    .update(stableStringify(pendingPayload))
    .digest("hex");
  const canonicalPayload = {
    ...pendingPayload,
    attestation: {
      ...pendingPayload.attestation,
      integrity_hash: firstPassHash,
    },
  };
  const canonicalBuffer = Buffer.from(stableStringify(canonicalPayload), "utf8");
  const canonicalSha = createHash("sha256").update(canonicalBuffer).digest("hex");
  const pdfBuffer = buildProfessionalPdfBuffer(canonicalPayload, buildPdfSections(canonicalPayload), {
    Author: "FohBoh MGE v1.0",
    CAAR_ID: record.id,
    Keywords: "caar,fohboh,mge,sealed",
    Producer: "Sentry CAAR Renderer",
    SEALED_AT: canonicalPayload.sealed_at,
    SHA256_SEAL: canonicalSha,
    Subject: `Certified Automated Audit & Recovery Report - ${record.period}`,
    Title: `CAAR ${record.id} - ${canonicalPayload.module_label}`,
    VAULT_VERSION: "v1.0.0",
  });
  const pdfSha = createHash("sha256").update(pdfBuffer).digest("hex");
  const objectBase = `${locationId}/${record.id}`;
  const canonicalObjectKey = `${objectBase}/canonical-payload.json`;
  const pdfObjectKey = `${objectBase}/caar-report.pdf`;

  await persistArtifactBlob({
    buffer: canonicalBuffer,
    objectKey: canonicalObjectKey,
  });
  await persistArtifactBlob({
    buffer: pdfBuffer,
    objectKey: pdfObjectKey,
  });

  const findingClass = record.status === "Certified" ? "certified" : "needs_remediation";
  const caar = existing
    ? await tx.caars_v2.update({
        where: {
          id: existing.id,
        },
        data: {
          canonical_payload_s3_key: canonicalObjectKey,
          cert_run_id: primaryRun.id,
          court_admissible: record.status === "Certified",
          finding_class: findingClass,
          location_id: locationId,
          module: primaryRun.module,
          vendor: primaryRun.vendor ?? null,
          pdf_s3_key: pdfObjectKey,
          period: record.period,
          prev_sha256: existing.sha256,
          recoverable_variance_cents: BigInt(Math.round(certification.amountValue * 100)),
          sealed_at: sealedAt,
          sha256: canonicalSha,
          status: record.status === "Certified" ? "active" : "review",
          superseded_by: null,
          superseded_reason: null,
          trust_score: record.trustScore,
        },
        select: {
          caar_external_id: true,
          id: true,
        },
      })
    : await tx.caars_v2.create({
        data: {
          canonical_payload_s3_key: canonicalObjectKey,
          caar_external_id: record.id,
          cert_run_id: primaryRun.id,
          court_admissible: record.status === "Certified",
          finding_class: findingClass,
          location_id: locationId,
          module: primaryRun.module,
          vendor: primaryRun.vendor ?? null,
          pdf_s3_key: pdfObjectKey,
          period: record.period,
          prev_sha256: previousActive?.sha256 ?? null,
          recoverable_variance_cents: BigInt(Math.round(certification.amountValue * 100)),
          sha256: canonicalSha,
          sealed_at: sealedAt,
          status: record.status === "Certified" ? "active" : "review",
          trust_score: record.trustScore,
        },
        select: {
          caar_external_id: true,
          id: true,
        },
      });

  if (previousActive && previousActive.id !== caar.id) {
    await tx.caars_v2.update({
      where: {
        id: previousActive.id,
      },
      data: {
        status: "superseded",
        superseded_by: caar.id,
        superseded_reason: `Superseded by ${record.id}`,
      },
    });
  }

  await upsertArtifactRecord({
    byteCount: BigInt(canonicalBuffer.byteLength),
    caarId: caar.id,
    name: `${record.id}-canonical-payload.json`,
    s3Key: canonicalObjectKey,
    seq: 1,
    sha256: canonicalSha,
    tx,
    type: "canonical_payload_json",
  });
  await upsertArtifactRecord({
    byteCount: BigInt(pdfBuffer.byteLength),
    caarId: caar.id,
    name: `${record.id}-caar-report.pdf`,
    s3Key: pdfObjectKey,
    seq: 2,
    sha256: pdfSha,
    tx,
    type: "caar_pdf",
  });

  if (certification.loopB.findings.length > 0) {
    await tx.loop_b_findings_v2.createMany({
      data: certification.loopB.findings.map((finding) => ({
        affected_periods: toJsonValue(finding.affectedPeriods),
        caar_eligible: finding.caarEligible,
        caar_id: caar.id,
        confidence_bps: Math.round(finding.confidenceScore * 10000),
        detail: finding.detail,
        impacts_certification: finding.impactsCertification,
        location_id: locationId,
        metadata: toJsonValue({
          module: finding.moduleId,
          patternCode: finding.patternCode,
        }),
        module: finding.moduleId,
        pattern_code: finding.patternCode,
        rule_id: finding.ruleId,
        status:
          finding.caarEligible
            ? "caar_eligible"
            : finding.impactsCertification
              ? "review"
              : "observed",
      })),
    });
  }

  await tx.audit_log_v2.create({
    data: {
      action: "caar_generated",
      customer_id: customerId,
      entity_id: String(caar.id),
      entity_type: "caars_v2",
      location_id: locationId,
      metadata: toJsonValue({
        caarExternalId: record.id,
        certRunIds: runRecords.map((run) => run.id),
        certifiedRelease: record.status === "Certified",
      }),
      summary: `Generated CAAR ${record.id} from persisted certification runs.`,
    },
  });

  return caar;
}

export async function generateClaimPackForCaar(
  tx: TxClient,
  {
    caarExternalId,
    customerId,
    locationId,
    uploadLocationId = null,
  }: GenerateClaimPackArgs,
) {
  const caar = await tx.caars_v2.findFirst({
    where: {
      caar_external_id: caarExternalId,
      location_id: locationId,
    },
      select: {
        canonical_payload_s3_key: true,
        caar_external_id: true,
        cert_run_id: true,
        court_admissible: true,
        exportpack_s3_key: true,
        id: true,
      module: true,
      pdf_s3_key: true,
      period: true,
      recoverable_variance_cents: true,
      status: true,
      trust_score: true,
    },
  });

  if (!caar) {
    throw new Error("CAAR not found.");
  }

  if (!caar.court_admissible || !caar.pdf_s3_key) {
    throw new Error("ExportPack generation is blocked until the CAAR has passed certified release.");
  }

  const canonicalBuffer = await readArtifactBlob(caar.canonical_payload_s3_key);
  const uploadLocationIds = Array.from(
    new Set(
      [locationId, uploadLocationId].filter(
        (value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0,
      ),
    ),
  );
  const [uploadRows, ruleCitations, auditRows] = await Promise.all([
    tx.uploads_v2.findMany({
      where: {
        location_id: {
          in: uploadLocationIds,
        },
        module: caar.module,
        superseded_by: null,
      },
      orderBy: [{ uploaded_at: "desc" }, { id: "desc" }],
      select: {
        artifact_key: true,
        file_name: true,
        id: true,
        module: true,
        s3_key: true,
        sha256: true,
        validation_summary: true,
        vendor: true,
      },
    }),
    tx.rule_citations_v2.findMany({
      where: {
        cert_run_id: caar.cert_run_id,
      },
      orderBy: [{ rule_id: "asc" }],
      select: {
        fired_count: true,
        rule_id: true,
        rule_version: true,
        sample_evidence: true,
        variance_cents: true,
      },
    }),
    tx.audit_log_v2.findMany({
      where: {
        location_id: locationId,
      },
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
      select: {
        action: true,
        actor_user_id: true,
        created_at: true,
        entity_id: true,
        entity_type: true,
        metadata: true,
        summary: true,
      },
    }),
  ]);

  const scopedUploads = uploadRows.filter((upload) => {
    const key = upload.artifact_key;
    return (
      key === `${caar.module.toLowerCase()}-agreement` ||
      key === `${caar.module.toLowerCase()}-bank` ||
      key === `${caar.module.toLowerCase()}-pos` ||
      key === `${caar.module.toLowerCase()}-${caar.module === "M01" ? "processor" : "settlement"}`
    );
  });

  const latestByArtifact = new Map<string, (typeof scopedUploads)[number]>();
  for (const upload of scopedUploads) {
    const key = `${upload.artifact_key}:${upload.vendor ?? "global"}`;
    if (!latestByArtifact.has(key)) {
      latestByArtifact.set(key, upload);
    }
  }

  const statementUploads = [...latestByArtifact.values()].filter((upload) =>
    upload.artifact_key.endsWith(caar.module === "M01" ? "processor" : "settlement"),
  );
  const posUploads = [...latestByArtifact.values()].filter((upload) => upload.artifact_key.endsWith("pos"));
  const agreementUpload = [...latestByArtifact.values()].find((upload) => upload.artifact_key.endsWith("agreement"));
  const bankUpload = [...latestByArtifact.values()].find((upload) => upload.artifact_key.endsWith("bank"));

  if (!agreementUpload || !bankUpload) {
    throw new Error("Claim pack generation is blocked until the signed agreement and bank statement are both uploaded.");
  }

  const statementBuffers = await Promise.all(statementUploads.map((upload) => readUploadBlob(upload.s3_key)));
  const posBuffers = await Promise.all(posUploads.map((upload) => readUploadBlob(upload.s3_key)));
  const agreementBuffer = await readUploadBlob(agreementUpload.s3_key);
  const bankBuffer = await readUploadBlob(bankUpload.s3_key);
  const pdfBuffer = await readArtifactBlob(caar.pdf_s3_key);

  const truthHeaders = ["source_artifact", "vendor", "row_number", "raw_row"];
  const truthRows: string[][] = [];
  for (let uploadIndex = 0; uploadIndex < statementUploads.length; uploadIndex += 1) {
    const upload = statementUploads[uploadIndex];
    const parsed = parseCsvBuffer(statementBuffers[uploadIndex]);
    parsed.rows.forEach((row, rowIndex) => {
      truthRows.push([
        upload.file_name,
        upload.vendor ?? caar.module,
        String(rowIndex + 1),
        JSON.stringify(Object.fromEntries(parsed.headers.map((header, index) => [header, row[index] ?? ""]))),
      ]);
    });
  }
  for (let uploadIndex = 0; uploadIndex < posUploads.length; uploadIndex += 1) {
    const upload = posUploads[uploadIndex];
    const parsed = parseCsvBuffer(posBuffers[uploadIndex]);
    parsed.rows.forEach((row, rowIndex) => {
      truthRows.push([
        upload.file_name,
        upload.vendor ?? "pos",
        String(rowIndex + 1),
        JSON.stringify(Object.fromEntries(parsed.headers.map((header, index) => [header, row[index] ?? ""]))),
      ]);
    });
  }
  const truthSourceBuffer = bufferToCsv(truthHeaders, truthRows);

  const claimSourceRows = ruleCitations.map((citation, index) => [
    String(index + 1),
    citation.rule_id,
    citation.rule_version,
    String(citation.fired_count),
    String(citation.variance_cents),
    JSON.stringify(citation.sample_evidence ?? []),
  ]);
  const claimSourceBuffer = bufferToCsv(
    ["claim_row", "rule_id", "rule_version", "fired_count", "variance_cents", "sample_evidence"],
    claimSourceRows,
  );

  const auditTrailPayload = {
    caarExternalId,
    generatedAt: new Date().toISOString(),
    events: auditRows.map((row) => ({
      action: row.action,
      actorUserId: row.actor_user_id,
      createdAt: row.created_at?.toISOString() ?? null,
      entityId: row.entity_id,
      entityType: row.entity_type,
      metadata: row.metadata,
      summary: row.summary,
    })),
  };
  const auditTrailBuffer = Buffer.from(JSON.stringify(auditTrailPayload, null, 2), "utf8");

  const ruleCitationsBuffer = Buffer.from(
    JSON.stringify(
      ruleCitations.map((citation) => ({
        ...citation,
        variance_cents: Number(citation.variance_cents),
      })),
      null,
      2,
    ),
    "utf8",
  );

  const primaryArtifacts: ProducedArtifact[] = [
    {
      bytes: pdfBuffer,
      contentType: "application/pdf",
      name: `${caar.caar_external_id}_CAAR.pdf`,
      seq: 1,
      sha256: createHash("sha256").update(pdfBuffer).digest("hex"),
      type: "CAAR_PDF",
    },
    {
      bytes: truthSourceBuffer,
      contentType: "text/csv; charset=utf-8",
      name: `TruthSource_${caar.module}.csv`,
      seq: 2,
      sha256: createHash("sha256").update(truthSourceBuffer).digest("hex"),
      type: "TRUTH_SOURCE_CSV",
    },
    {
      bytes: claimSourceBuffer,
      contentType: "text/csv; charset=utf-8",
      name: "ClaimSource_Settlement.csv",
      seq: 3,
      sha256: createHash("sha256").update(claimSourceBuffer).digest("hex"),
      type: "CLAIM_SOURCE_CSV",
    },
    {
      bytes: agreementBuffer,
      contentType: "application/pdf",
      name: "SignedAgreement.pdf",
      seq: 4,
      sha256: createHash("sha256").update(agreementBuffer).digest("hex"),
      type: "CONTRACT_EXHIBIT",
    },
    {
      bytes: bankBuffer,
      contentType: "application/pdf",
      name: `BankStatement_${caar.period.replace(/[^0-9A-Za-z_-]+/g, "_")}.pdf`,
      seq: 5,
      sha256: createHash("sha256").update(bankBuffer).digest("hex"),
      type: "BANK_STATEMENT",
    },
  ];

  const merkleManifest = {
    schema: "merkle-v1",
    leaves: [
      ...primaryArtifacts.map((artifact) => ({
        path: artifact.name,
        sha256: artifact.sha256,
      })),
      {
        path: "canonical-caar.json",
        sha256: createHash("sha256").update(canonicalBuffer).digest("hex"),
      },
    ],
  };
  const merkleRoot = createHash("sha256")
    .update(merkleManifest.leaves.map((leaf) => `${leaf.path}:${leaf.sha256}`).join("|"))
    .digest("hex");
  const evidenceManifestBuffer = Buffer.from(
    JSON.stringify({ ...merkleManifest, merkle_root: merkleRoot }, null, 2),
    "utf8",
  );
  const evidenceManifestSha = createHash("sha256").update(evidenceManifestBuffer).digest("hex");
  const auditTrailSha = createHash("sha256").update(auditTrailBuffer).digest("hex");
  const ruleCitationsSha = createHash("sha256").update(ruleCitationsBuffer).digest("hex");

  const finalArtifacts: ProducedArtifact[] = [
    ...primaryArtifacts,
    {
      bytes: evidenceManifestBuffer,
      contentType: "application/json; charset=utf-8",
      name: "MerkleManifest.json",
      seq: 6,
      sha256: evidenceManifestSha,
      type: "EVIDENCE_MANIFEST",
    },
    {
      bytes: auditTrailBuffer,
      contentType: "application/json; charset=utf-8",
      name: `AuditTrail_${caar.caar_external_id}.json`,
      seq: 7,
      sha256: auditTrailSha,
      type: "CHAIN_OF_CUSTODY",
    },
    {
      bytes: ruleCitationsBuffer,
      contentType: "application/json; charset=utf-8",
      name: `RuleCitations_${ruleCitations.length}.json`,
      seq: 8,
      sha256: ruleCitationsSha,
      type: "RULE_CITATIONS",
    },
  ];

  const integrityManifestBuffer = Buffer.from(
    finalArtifacts
      .map((artifact) => `${artifact.sha256} *${artifact.name}`)
      .join("\n"),
    "utf8",
  );
  const integrityManifestSha = createHash("sha256").update(integrityManifestBuffer).digest("hex");
  finalArtifacts.push({
    bytes: integrityManifestBuffer,
    contentType: "text/plain; charset=utf-8",
    name: "IntegrityManifest.sha256",
    seq: 9,
    sha256: integrityManifestSha,
    type: "SHA256_MANIFEST",
  });

  const exportpackManifest = {
    artifactVersion: "phase8-exportpack-v1",
    artifacts: finalArtifacts.map((artifact) => ({
      name: artifact.name,
      seq: artifact.seq,
      sha256: artifact.sha256,
      type: artifact.type,
    })),
    caarExternalId,
    generatedAt: new Date().toISOString(),
    merkleRoot,
    module: caar.module,
    period: caar.period,
    trustScore: caar.trust_score,
  };

  for (const artifact of finalArtifacts) {
    const objectKey = `${locationId}/${caar.caar_external_id}/exportpack/${artifact.name}`;
    await persistArtifactBlob({
      buffer: artifact.bytes,
      objectKey,
    });
    await upsertArtifactRecord({
      byteCount: BigInt(artifact.bytes.byteLength),
      caarId: caar.id,
      name: artifact.name,
      s3Key: objectKey,
      seq: artifact.seq + 2,
      sha256: artifact.sha256,
      tx,
      type: artifact.type.toLowerCase(),
    });
  }

  const manifestBuffer = Buffer.from(JSON.stringify(exportpackManifest, null, 2), "utf8");
  const manifestObjectKey = `${locationId}/${caar.caar_external_id}/exportpack/ExportPackManifest.json`;
  await persistArtifactBlob({
    buffer: manifestBuffer,
    objectKey: manifestObjectKey,
  });

  const zipBuffer = buildStoredZip(
    [
      ...finalArtifacts.map((artifact) => ({ bytes: artifact.bytes, name: artifact.name })),
      { bytes: manifestBuffer, name: "ExportPackManifest.json" },
    ],
  );
  const zipSha = createHash("sha256").update(zipBuffer).digest("hex");
  const zipObjectKey = `${locationId}/${caar.caar_external_id}/exportpack/${caar.caar_external_id}_ExportPack.zip`;
  await persistArtifactBlob({
    buffer: zipBuffer,
    objectKey: zipObjectKey,
  });

  await tx.caars_v2.update({
    where: {
      id: caar.id,
    },
    data: {
      exportpack_s3_key: zipObjectKey,
    },
  });

  await upsertArtifactRecord({
    byteCount: BigInt(zipBuffer.byteLength),
    caarId: caar.id,
    name: `${caar.caar_external_id}_ExportPack.zip`,
    s3Key: zipObjectKey,
    seq: 12,
    sha256: zipSha,
    tx,
    type: "exportpack_zip",
  });

  await tx.audit_log_v2.create({
    data: {
      action: "exportpack_generated",
      customer_id: customerId,
      entity_id: String(caar.id),
      entity_type: "caars_v2",
      location_id: locationId,
      metadata: toJsonValue({
        caarExternalId,
        artifactCount: finalArtifacts.length,
        manifestObjectKey,
        merkleRoot,
        objectKey: zipObjectKey,
      }),
      summary: `Generated ExportPack for ${caarExternalId}.`,
    },
  });

  return {
    caarId: caar.id,
    manifestObjectKey,
    merkleRoot,
    objectKey: zipObjectKey,
  };
}
