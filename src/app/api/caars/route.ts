import { NextResponse } from "next/server";
import { requireManagerSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import type {
  CaarEvidenceTrace,
  CaarFieldAudit,
  CaarProvenanceKind,
  CaarRecord,
  CaarRuleCitationSummary,
  CaarScoreDeduction,
} from "@/components/sentry/types";
import { getScopedRestaurantIds } from "@/lib/auth/team-access";
import {
  getExplicitCitationDisposition,
  isInformationalRuleCitation,
} from "@/lib/mge/citation-disposition";

function parseCurrencyToCents(value: string) {
  const numeric = Number(value.replace(/[^0-9.-]/g, "")) || 0;
  return Math.round(numeric * 100);
}

function formatCentsToCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: "currency",
  }).format(cents / 100);
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

type ReferenceRow = {
  amount?: number;
  candidateAmounts?: number[];
  externalRefId?: string;
  lineText?: string;
  rowNumber?: number;
  postedDate?: string;
  settledDate?: string;
};

type UploadMetricsLike = {
  depositReferenceRows?: ReferenceRow[];
  payoutReferenceRows?: ReferenceRow[];
};

function isCaarDimensionArray(value: unknown): value is CaarRecord["dimensions"] {
  return Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function formatVarianceDisplay(cents: bigint | number | null | undefined) {
  const numeric = typeof cents === "bigint" ? Number(cents) : Number(cents ?? 0);
  return formatCentsToCurrency(numeric);
}

function parseCitationSamples(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "samples" in value
  ) {
    const samples = (value as { samples?: unknown }).samples;
    return Array.isArray(samples)
      ? samples.filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
        )
      : [];
  }

  return Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
      )
    : [];
}

function normalizeCitationSampleValue(value: unknown): string | number | boolean | null {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return null;
}

function normalizeCitationSamples(value: unknown) {
  return parseCitationSamples(value).map((entry) =>
    Object.fromEntries(
      Object.entries(entry).map(([key, sampleValue]) => [key, normalizeCitationSampleValue(sampleValue)]),
    ),
  );
}

function normalizeReferenceId(value: string | undefined | null) {
  const normalized = String(value ?? "")
    .replace(/[^0-9A-Za-z]/g, "")
    .toUpperCase();
  return normalized.replace(/^0+/, "");
}

function amountsMatch(left: number, right: number) {
  return Math.abs(left - right) <= 0.01;
}

function referenceIdsMatch(left: string, right: string) {
  if (!left || !right) return false;
  if (left === right) return true;
  const leftTrimmed = left.replace(/^0+/, "");
  const rightTrimmed = right.replace(/^0+/, "");
  return (
    leftTrimmed === rightTrimmed ||
    left.endsWith(rightTrimmed) ||
    right.endsWith(leftTrimmed) ||
    leftTrimmed.endsWith(rightTrimmed) ||
    rightTrimmed.endsWith(leftTrimmed)
  );
}

function referenceRowSupportsAmount(row: ReferenceRow, targetAmount: number) {
  return resolveReferenceRowMatchedAmount(row, targetAmount) !== null;
}

function resolveReferenceRowMatchedAmount(row: ReferenceRow, targetAmount: number) {
  if (typeof row.amount === "number" && amountsMatch(row.amount, targetAmount)) {
    return row.amount;
  }

  const candidateMatch = (row.candidateAmounts ?? []).find(
    (candidate) => typeof candidate === "number" && amountsMatch(candidate, targetAmount),
  );
  if (candidateMatch !== undefined) {
    return targetAmount;
  }

  return null;
}

function parseUploadMetrics(value: unknown): UploadMetricsLike | null {
  if (!value || typeof value !== "object") return null;
  const metrics = (value as { metrics?: unknown }).metrics;
  return metrics && typeof metrics === "object" ? (metrics as UploadMetricsLike) : null;
}

function deriveReconciliationExceptions({
  certificationPeriod,
  moduleId,
  uploads,
}: {
  certificationPeriod: string;
  moduleId: "M01" | "M02";
  uploads: Array<{
    artifact_key: string;
    file_name: string;
    id: number;
    location_id: number;
    module: string;
    page_count: number | null;
    row_count: number | null;
    sha256: string;
    uploaded_at: Date | null;
    validation_summary: unknown;
    vendor: string | null;
  }>;
}) {
  const posUpload = uploads.find((upload) => upload.artifact_key.endsWith("pos"));
  const bankUpload = uploads.find((upload) => upload.artifact_key.endsWith("bank"));
  if (!posUpload || !bankUpload) {
    return { exceptions: [], notes: [], warnings: [] };
  }

  const posValidation = posUpload.validation_summary && typeof posUpload.validation_summary === "object"
    ? posUpload.validation_summary as { detectedFormatKey?: unknown; detectedFormatName?: unknown }
    : null;
  const settlementTimingWarning = moduleId === "M01" &&
    typeof posValidation?.detectedFormatKey === "string" &&
    posValidation.detectedFormatKey.includes("payout")
    ? [`The file in the POS slot was detected as ${String(posValidation.detectedFormatName ?? "a payout export")}. Its gross settled-batch total is grouped by settlement date, while the processor card-volume total is grouped by fee-charge timing. Their difference is timing context, not a POS discrepancy or proven loss.`]
    : [];
  const posMetrics = parseUploadMetrics(posUpload.validation_summary);
  const bankMetrics = parseUploadMetrics(bankUpload.validation_summary);
  const payoutRows = posMetrics?.payoutReferenceRows ?? [];
  const depositRows = bankMetrics?.depositReferenceRows ?? [];
  if (payoutRows.length === 0 && depositRows.length === 0) {
    return { exceptions: [], notes: [], warnings: settlementTimingWarning };
  }

  const exceptions: string[] = [];
  const notes: string[] = [];
  const warnings: string[] = [...settlementTimingWarning];
  const usedDepositIndexes = new Set<number>();

  for (const payoutRow of payoutRows) {
    const payoutRef = normalizeReferenceId(payoutRow.externalRefId);
    const payoutAmount = typeof payoutRow.amount === "number" ? payoutRow.amount : 0;
    if (!payoutRef || payoutAmount <= 0) continue;

    const matchingDepositIndexes = depositRows
      .map((depositRow, index) => ({ depositRow, index }))
      .filter(({ depositRow, index }) => {
        if (usedDepositIndexes.has(index)) return false;
        return referenceIdsMatch(payoutRef, normalizeReferenceId(depositRow.externalRefId));
      });

    if (matchingDepositIndexes.length === 0) {
      exceptions.push(
        `${moduleId} payout ID ${payoutRef} for ${formatAmount(payoutAmount)} is missing in bank statement evidence.`,
      );
      continue;
    }

    const exactAmountMatch = matchingDepositIndexes.find(({ depositRow }) =>
      resolveReferenceRowMatchedAmount(depositRow, payoutAmount) !== null,
    );

    if (exactAmountMatch) {
      usedDepositIndexes.add(exactAmountMatch.index);
      const payoutMonth = getReferenceMonth(payoutRow.settledDate);
      const depositMonth = getReferenceMonth(getDepositSettlementDate(exactAmountMatch.depositRow));
      if (payoutMonth && depositMonth && payoutMonth !== depositMonth) {
        warnings.push(
          `${moduleId} payout ID ${payoutRef} is dated ${formatReferenceMonth(payoutMonth)} in the payout export but ${formatReferenceMonth(depositMonth)} in the bank description. The reference and amount match, so this is treated as a timing warning rather than a reconciliation error.`,
        );
      }
      continue;
    }

    const unresolvedButPresent = matchingDepositIndexes.find(
      ({ depositRow }) =>
        (depositRow.amount ?? 0) <= 0 ||
        ((depositRow.candidateAmounts?.length ?? 0) > 0 && typeof depositRow.amount !== "number"),
    );
    if (unresolvedButPresent) {
      usedDepositIndexes.add(unresolvedButPresent.index);
      continue;
    }

    const firstMismatch = matchingDepositIndexes[0];
    usedDepositIndexes.add(firstMismatch.index);
    exceptions.push(
      `${moduleId} payout ID ${payoutRef} amount mismatch: payout export shows ${formatAmount(payoutAmount)} but bank statement shows ${formatAmount(firstMismatch.depositRow.amount ?? 0)}.`,
    );
  }

  depositRows.forEach((depositRow, index) => {
    if (usedDepositIndexes.has(index)) return;
    const depositRef = normalizeReferenceId(depositRow.externalRefId);
    const depositAmount = typeof depositRow.amount === "number" ? depositRow.amount : 0;
    if (!depositRef || depositAmount <= 0) return;
    const depositMonth = getReferenceMonth(getDepositSettlementDate(depositRow));
    const targetMonth = getCertificationPeriodMonth(certificationPeriod);
    if (depositMonth && targetMonth && depositMonth < targetMonth) {
      notes.push(
        `${moduleId} deposit ID ${depositRef} for ${formatAmount(depositAmount)} is a ${formatReferenceMonth(depositMonth)} payout posted in the ${certificationPeriod} bank statement. It is retained as prior-period carryover context and does not block certification.`,
      );
    } else {
      exceptions.push(
        `${moduleId} deposit ID ${depositRef} for ${formatAmount(depositAmount)} appears in bank statement evidence but not in the payout export.`,
      );
    }
  });

  return {
    exceptions: [...new Set(exceptions)],
    notes: [...new Set(notes)],
    warnings: [...new Set(warnings)],
  };
}

function getDepositSettlementDate(row: ReferenceRow) {
  if (row.settledDate) return row.settledDate;
  const descriptorMatch = row.lineText?.match(/\bDEP\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\b/i);
  const postedMatch = row.postedDate?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!descriptorMatch || !postedMatch) return undefined;
  const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
    .indexOf(descriptorMatch[1].toLowerCase()) + 1;
  const postedMonth = Number(postedMatch[1]);
  let year = Number(postedMatch[3]);
  if (month - postedMonth > 6) year -= 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(Number(descriptorMatch[2])).padStart(2, "0")}`;
}

function getReferenceMonth(value?: string) {
  if (!value) return null;
  const isoMatch = value.match(/^(\d{4})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;
  const usMatch = value.match(/^(\d{1,2})\/\d{1,2}\/(\d{4})$/);
  return usMatch ? `${usMatch[2]}-${String(Number(usMatch[1])).padStart(2, "0")}` : null;
}

function getCertificationPeriodMonth(period: string) {
  const match = period.match(/^([A-Za-z]+)\s+(\d{4})/);
  if (!match) return null;
  const month = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
    .indexOf(match[1].toLowerCase()) + 1;
  return month > 0 ? `${match[2]}-${String(month).padStart(2, "0")}` : null;
}

function formatReferenceMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC", year: "numeric" })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

function sampleSignalsProblem(sample: Record<string, unknown>) {
  for (const [key, value] of Object.entries(sample)) {
    if (
      (key === "high_variance_flag" || key === "duplicate_detected") &&
      value === true
    ) {
      return true;
    }

    if (
      (key === "source_hash" || key === "pos_hash") &&
      value === false
    ) {
      return true;
    }

    if (key === "contract_fields" && typeof value === "number" && value < 3) {
      return true;
    }

    if (
      (key === "contract_expired" || key === "formula_version_changed_during_period") &&
      value === true
    ) {
      return true;
    }

    if (typeof value === "string") {
      const normalized = value.toLowerCase();
      if (
        [
          "no parse failure blocked",
          "no blocking unmapped",
          "no blocking ",
          "no duplicate events were detected",
          "validation passed",
          "was not rejected",
          "did not prevent normalization",
          "no negative-value normalization flags",
          "no expired contract date is recorded",
          "no governed mid-period formula-version change is recorded",
          "no high-variance fee condition remains active",
          "no major period-gap penalty remains active",
          "advanced into deterministic certification",
          "completed and produced governed metrics",
          "has been applied to the governed source artifact",
        ].some((pattern) => normalized.includes(pattern))
      ) {
        continue;
      }

      if (
        [
          "blocked",
          "below the",
          "failed",
          "incomplete",
          "insufficient",
          "missing",
          "outside final tolerance",
          "penalty remains",
          "remains active",
          "remains below",
          "remains blocked",
          "stale",
        ].some((pattern) => normalized.includes(pattern))
      ) {
        return true;
      }
    }
  }

  return false;
}

function isProblemRuleCitation(row: {
  fired_count: number;
  rule_id: string;
  rule_version: string;
  sample_evidence: unknown;
  variance_cents: bigint;
}) {
  const explicitDisposition = getExplicitCitationDisposition(row.sample_evidence);
  if (explicitDisposition) {
    return explicitDisposition === "blocking";
  }

  if (row.fired_count <= 0) {
    return false;
  }

  return parseCitationSamples(row.sample_evidence).some(sampleSignalsProblem);
}

function getArtifactLabel(moduleId: "M01" | "M02", artifactKey: string) {
  const normalized = artifactKey.toLowerCase();
  if (normalized.endsWith("processor")) return "Processor Source Statement";
  if (normalized.endsWith("settlement")) return "DSP Settlement Source";
  if (normalized.endsWith("pos")) return moduleId === "M01" ? "POS Export CSV" : "POS Summary / Export";
  if (normalized.endsWith("agreement")) return moduleId === "M01" ? "Signed Merchant Agreement" : "Signed DSP Agreement";
  if (normalized.endsWith("bank")) return moduleId === "M01" ? "Bank Statement" : "Bank Deposit Evidence";
  return artifactKey;
}

function getExpectedArtifactKeys(moduleId: "M01" | "M02") {
  return moduleId === "M01"
    ? ["m01-processor", "m01-pos", "m01-agreement", "m01-bank"]
    : ["m02-settlement", "m02-pos", "m02-agreement", "m02-bank"];
}

function isMonetaryRuleCitation(row: { sample_evidence: unknown; variance_cents: bigint }) {
  const explicitDisposition = getExplicitCitationDisposition(row.sample_evidence);
  return explicitDisposition === "monetary" || (!explicitDisposition && Number(row.variance_cents) !== 0);
}

function parseNumericIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0);
}

function buildFieldAuditRows({
  amount,
  certCompletedAt,
  certRunId,
  courtAdmissible,
  moduleId,
  record,
  ruleCitationCount,
  ruleSetVersion,
  sealedAt,
  sealedContract,
  sealedSchema,
}: {
  amount: string;
  certCompletedAt: string | null;
  certRunId: number | null;
  courtAdmissible: boolean | null;
  moduleId: "M01" | "M02" | null;
  record: {
    caarId: string;
    period: string;
    status: string;
    trustScore: number;
  };
  ruleCitationCount: number;
  ruleSetVersion: string | null;
  sealedAt: string | null;
  sealedContract: { id: number; vendor: string; version: number } | null;
  sealedSchema: { id: number; vendor: string; version: number } | null;
}): CaarFieldAudit[] {
  return [
    {
      field: "CAAR ID",
      provenance: "rule_engine",
      supported: true,
      trace: "Persisted CAAR record",
      value: record.caarId,
    },
    {
      field: "Module",
      provenance: moduleId ? "rule_engine" : "synthetic",
      supported: Boolean(moduleId),
      trace: moduleId ? "caars_v2.module" : "Module could not be resolved from persisted CAAR state",
      value: moduleId ?? "Unknown",
    },
    {
      field: "Certification Period",
      provenance: "rule_engine",
      supported: true,
      trace: "Persisted CAAR period",
      value: record.period,
    },
    {
      field: "Trust Score",
      provenance: "rule_engine",
      supported: true,
      trace: certRunId ? `cert_runs_v2#${certRunId}` : "Persisted CAAR summary",
      value: String(record.trustScore),
    },
    {
      field: "Certified Variance",
      provenance: "rule_engine",
      supported: true,
      trace: certRunId ? `cert_runs_v2#${certRunId}` : "Persisted CAAR summary",
      value: amount,
    },
    {
      field: "Status",
      provenance: "rule_engine",
      supported: true,
      trace: courtAdmissible === null ? "Persisted CAAR summary" : "caars_v2.court_admissible + status",
      value: record.status,
    },
    {
      field: "Rule Set Version",
      provenance: ruleSetVersion ? "rule_engine" : "synthetic",
      supported: Boolean(ruleSetVersion),
      trace: ruleSetVersion && certRunId ? `cert_runs_v2#${certRunId}` : "No persisted cert run rule-set version found",
      value: ruleSetVersion ?? "Not persisted",
    },
    {
      field: "Certification Sealed At",
      provenance: sealedAt ? "rule_engine" : "synthetic",
      supported: Boolean(sealedAt),
      trace: sealedAt ? "caars_v2.sealed_at" : "No sealed CAAR timestamp found",
      value: sealedAt ?? certCompletedAt ?? "Not persisted",
    },
    {
      field: "Schema Registry",
      provenance: sealedSchema ? "sealed_config" : "synthetic",
      supported: Boolean(sealedSchema),
      trace: sealedSchema
        ? `schema_registry_v2#${sealedSchema.id}`
        : "No sealed schema registry record found for this module",
      value: sealedSchema
        ? `${sealedSchema.vendor} v${sealedSchema.version}`
        : "Not sealed for this module",
    },
    {
      field: "Contract Config",
      provenance: sealedContract ? "sealed_config" : "synthetic",
      supported: Boolean(sealedContract),
      trace: sealedContract
        ? `contract_configs_v2#${sealedContract.id}`
        : "No sealed contract config record found for this module",
      value: sealedContract
        ? `${sealedContract.vendor} v${sealedContract.version}`
        : "Not sealed for this module",
    },
    {
      field: "Rule Citations",
      provenance: "rule_engine",
      supported: true,
      trace: certRunId ? `rule_citations_v2 via cert_runs_v2#${certRunId}` : "No persisted cert run linked",
      value: `${ruleCitationCount} persisted rule citations`,
    },
  ];
}

function buildRuleCitationSummaries(
  rows: Array<{
    fired_count: number;
    rule_id: string;
    rule_version: string;
    sample_evidence: unknown;
    variance_cents: bigint;
  }>,
): CaarRuleCitationSummary[] {
  return rows.map((row) => ({
    firedCount: row.fired_count,
    ruleId: row.rule_id,
    ruleVersion: row.rule_version,
    sampleEvidence: normalizeCitationSamples(row.sample_evidence),
    sampleEvidenceCount: parseCitationSamples(row.sample_evidence).length,
    varianceDisplay: formatVarianceDisplay(row.variance_cents),
  }));
}

const TRUST_GATE_RULES: Record<string, string[]> = {
  TG01: ["R116", "R117"], TG02: ["R118", "R119"], TG03: ["R120", "R121"],
  TG04: ["R122", "R123"], TG05: ["R124", "R125"], TG06: ["R126", "R127"],
  TG07: ["R128", "R129", "R130"], TG08: ["R131", "R132"], TG09: ["R133"],
  TG10: ["R134"], TG11: ["R135", "R146"],
};

export function buildScoreDeductions(rows: Array<{
  rule_id: string;
  sample_evidence: unknown;
}>): CaarScoreDeduction[] {
  const scoreRow = rows.find((row) => row.rule_id === "R136");
  const scoreSample = parseCitationSamples(scoreRow?.sample_evidence)[0];
  const rawBreakdown = typeof scoreSample?.trust_gate_breakdown === "string"
    ? scoreSample.trust_gate_breakdown
    : null;
  let breakdown: Array<{ gate?: unknown; score?: unknown; weight_percent?: unknown }> = [];
  try {
    breakdown = rawBreakdown ? JSON.parse(rawBreakdown) : [];
  } catch {
    breakdown = [];
  }

  const deductions = breakdown.flatMap((entry): CaarScoreDeduction[] => {
    if (typeof entry.gate !== "string" || typeof entry.score !== "number" || typeof entry.weight_percent !== "number" || entry.score >= 100) {
      return [];
    }
    const ruleIds = TRUST_GATE_RULES[entry.gate] ?? [];
    const supportingRows = rows.filter((row) => ruleIds.includes(row.rule_id));
    const samples = supportingRows.flatMap((row) => parseCitationSamples(row.sample_evidence));
    const evidence = samples.flatMap((sample) => {
      if (
        entry.gate === "TG04" &&
        typeof sample.dsp_order_count === "number" &&
        typeof sample.pos_certified_order_count === "number"
      ) {
        const difference = typeof sample.order_count_difference === "number"
          ? sample.order_count_difference
          : Math.abs(sample.dsp_order_count - sample.pos_certified_order_count);
        const percent = typeof sample.order_count_difference_percent === "number"
          ? sample.order_count_difference_percent
          : null;
        const salesContext =
          typeof sample.processor_basis === "number" && typeof sample.pos_basis === "number"
            ? ` Supporting sales bases were $${sample.processor_basis.toLocaleString("en-US", { minimumFractionDigits: 2 })} and $${sample.pos_basis.toLocaleString("en-US", { minimumFractionDigits: 2 })}; those monetary values do not control the R122/R123 order-count gate.`
            : "";
        const deliveryOnly = sample.order_count_scope === "delivery_unique_orders";
        const dspLabel = deliveryOnly ? "DSP unique Delivery order count" : "DSP unique period order count";
        const posLabel = deliveryOnly ? "POS-certified Delivery order count" : "POS-certified DSP order count";
        return [`${dspLabel} ${sample.dsp_order_count}; ${posLabel} ${sample.pos_certified_order_count}; difference ${difference} orders${percent === null ? "" : ` (${percent.toFixed(2)}%)`}.${salesContext}`];
      }
      if (entry.gate === "TG04" && typeof sample.processor_basis === "number" && typeof sample.pos_basis === "number") {
        const difference = typeof sample.difference_amount === "number"
          ? sample.difference_amount
          : Math.abs(sample.processor_basis - sample.pos_basis);
        const percent = typeof sample.difference_percent === "number" ? sample.difference_percent : null;
        if (sample.settlement_timing_context === true) {
          const net = typeof sample.net_settled_batches === "number"
            ? `; net settled batches $${sample.net_settled_batches.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
            : "";
          return [`Gross card-processing volume $${sample.processor_basis.toLocaleString("en-US", { minimumFractionDigits: 2 })}; gross settled batches $${sample.pos_basis.toLocaleString("en-US", { minimumFractionDigits: 2 })}${net}; timing-basis difference $${difference.toLocaleString("en-US", { minimumFractionDigits: 2 })}${percent === null ? "" : ` (${percent.toFixed(2)}%)`}. This is timing context, not a proven loss.`];
        }
        return [`Processor basis $${sample.processor_basis.toLocaleString("en-US", { minimumFractionDigits: 2 })}; POS basis $${sample.pos_basis.toLocaleString("en-US", { minimumFractionDigits: 2 })}; difference $${difference.toLocaleString("en-US", { minimumFractionDigits: 2 })}${percent === null ? "" : ` (${percent.toFixed(2)}%)`}.`];
      }
      return typeof sample.detail === "string" ? [sample.detail] : [];
    });
    if (entry.gate === "TG11" && typeof scoreSample?.trust_gate_subtotal === "number") {
      evidence.push(
        `Pre-TG11 subtotal ${scoreSample.trust_gate_subtotal}; eligibility requires at least 85; TG11 therefore contributes 0 points.`,
      );
    }
    const pointsLost = Number((entry.weight_percent * (1 - entry.score / 100)).toFixed(2));
    const hasRequiredEvidence = entry.gate === "TG04"
      ? samples.some((sample) =>
          (
            typeof sample.dsp_order_count === "number" && sample.dsp_order_count > 0 &&
            typeof sample.pos_certified_order_count === "number" && sample.pos_certified_order_count > 0 &&
            typeof sample.order_count_difference === "number" &&
            typeof sample.order_count_difference_percent === "number"
          ) || (
            typeof sample.processor_basis === "number" && sample.processor_basis > 0 &&
            typeof sample.pos_basis === "number" && sample.pos_basis > 0 &&
            typeof sample.difference_amount === "number" &&
            typeof sample.difference_percent === "number"
          ),
        )
      : evidence.length > 0;
    return [{
      calculation: `${entry.gate}: ${entry.score}/100 × ${entry.weight_percent}% = ${(entry.weight_percent - pointsLost).toFixed(2)} points; ${pointsLost.toFixed(2)} points lost.`,
      consequential: entry.gate === "TG11",
      evidence: [...new Set(evidence)],
      gate: entry.gate,
      pointsLost,
      ruleIds: supportingRows.map((row) => row.rule_id),
      score: entry.score,
      supported: supportingRows.length > 0 && hasRequiredEvidence,
      weightPercent: entry.weight_percent,
    }];
  });

  const systemPenalty = typeof scoreSample?.system_health_penalty === "number"
    ? scoreSample.system_health_penalty
    : 0;
  if (systemPenalty > 0) {
    deductions.push({
      calculation: `Trust-gate subtotal minus ${systemPenalty.toFixed(2)} system-health penalty points.`,
      consequential: false,
      evidence: ["R136 records a system-health penalty, but the supporting system-health event must be inspected for the triggering condition."],
      gate: "SYS",
      pointsLost: systemPenalty,
      ruleIds: ["R136"],
      score: 0,
      supported: false,
      weightPercent: 0,
    });
  }
  return deductions;
}

function buildEvidenceRows({
  moduleId,
  uploads,
}: {
  moduleId: "M01" | "M02";
  uploads: Array<{
    artifact_key: string;
    file_name: string;
    id: number;
    page_count: number | null;
    row_count: number | null;
    sha256: string;
    uploaded_at: Date | null;
    validation_summary: unknown;
    vendor: string | null;
  }>;
}): CaarEvidenceTrace[] {
  const latestByArtifact = new Map<string, (typeof uploads)[number]>();
  for (const upload of uploads) {
    const key = `${upload.artifact_key}:${upload.vendor ?? "global"}`;
    if (!latestByArtifact.has(key)) {
      latestByArtifact.set(key, upload);
    }
  }

  const evidenceRows: CaarEvidenceTrace[] = [...latestByArtifact.values()].map((upload) => {
    const validation =
      upload.validation_summary && typeof upload.validation_summary === "object"
        ? (upload.validation_summary as {
            fields?: boolean;
            matchPct?: number;
            pageCount?: number;
            parseWarnings?: string[];
            rows?: number;
            schema?: boolean;
            unmatchedHeaders?: string[];
          })
        : null;
    const schemaOk = Boolean(validation?.schema);
    const fieldsOk = Boolean(validation?.fields);
    const notes = [
      ...(Array.isArray(validation?.parseWarnings) ? validation.parseWarnings : []),
      ...(Array.isArray(validation?.unmatchedHeaders)
        ? validation.unmatchedHeaders.slice(0, 8).map((header) => `Unmatched header: ${header}`)
        : []),
    ];
    const status: CaarEvidenceTrace["status"] =
      schemaOk && fieldsOk ? "provided" : upload.sha256 ? "review" : "missing";

    return {
      artifactKey: upload.artifact_key,
      fileName: upload.file_name,
      label: getArtifactLabel(moduleId, upload.artifact_key),
      matchPct: typeof validation?.matchPct === "number" ? validation.matchPct : null,
      notes,
      pageCount: validation?.pageCount ?? upload.page_count ?? null,
      provenance: "direct_upload",
      rows: validation?.rows ?? upload.row_count ?? null,
      schemaOk,
      sha256: upload.sha256 ?? null,
      status,
      trace: `uploads_v2#${upload.id}`,
      uploadedAt: upload.uploaded_at?.toISOString() ?? null,
      vendor: upload.vendor ?? null,
    } satisfies CaarEvidenceTrace;
  });

  const existingKeys = new Set(evidenceRows.map((row) => row.artifactKey));
  for (const artifactKey of getExpectedArtifactKeys(moduleId)) {
    if (existingKeys.has(artifactKey)) continue;
    evidenceRows.push({
      artifactKey,
      fileName: null,
      label: getArtifactLabel(moduleId, artifactKey),
      matchPct: null,
      notes: ["Required source document is not persisted for this CAAR module."],
      pageCount: null,
      provenance: "direct_upload",
      rows: null,
      schemaOk: false,
      sha256: null,
      status: "missing",
      trace: "No persisted upload found",
      uploadedAt: null,
      vendor: null,
    });
  }

  return evidenceRows.sort((left, right) => left.label.localeCompare(right.label));
}

function getAuthErrorResponse(error: unknown) {
  if (!(error instanceof Error)) return null;
  if (error.message === "Unauthorized") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (error.message === "Forbidden") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  try {
    await request;
    const session = await requireManagerSession();
    const scopedRestaurantIds = await getScopedRestaurantIds(session);

    const reports = await prisma.caar_reports.findMany({
      where: {
        ...(session.role === "WGS Manager" || session.role === "SuperAdmin"
          ? {}
          : Array.isArray(scopedRestaurantIds)
            ? scopedRestaurantIds.length > 0
              ? { restaurant_id: { in: scopedRestaurantIds } }
              : { id: -1 }
            : { id: -1 }),
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      select: {
        account_id: true,
        amount_cents: true,
        amount_display: true,
        caar_id: true,
        created_at: true,
        created_by: true,
        dimensions: true,
        exhibits: true,
        findings: true,
        location_id: true,
        location_name: true,
        narrative: true,
        period: true,
        restaurant_id: true,
        status: true,
        trust_score: true,
      },
    });

    // Legacy databases may contain duplicate summary rows even though the current
    // Prisma model declares caar_id unique. Keep the newest row selected above.
    const seenCaarIds = new Set<string>();
    const canonicalReports = reports.filter((report) => {
      if (seenCaarIds.has(report.caar_id)) {
        return false;
      }
      seenCaarIds.add(report.caar_id);
      return true;
    });
    const caarIds = canonicalReports.map((report) => report.caar_id);
    const persistedCaars = caarIds.length
      ? await prisma.caars_v2.findMany({
          where: {
            caar_external_id: {
              in: caarIds,
            },
          },
          select: {
            caar_external_id: true,
            cert_run_id: true,
            court_admissible: true,
            location_id: true,
            module: true,
            sealed_at: true,
            status: true,
          },
        })
      : [];
    const persistedCaarById = new Map(persistedCaars.map((row) => [row.caar_external_id, row]));
    const certRunIds = persistedCaars.map((row) => row.cert_run_id);
    const governedLocationIds = [...new Set(persistedCaars.map((row) => row.location_id))];

    const [certRuns, ruleCitations, sealedSchemas, sealedContracts] = await Promise.all([
      certRunIds.length
        ? prisma.cert_runs_v2.findMany({
            where: {
              id: {
                in: certRunIds,
              },
            },
            select: {
              completed_at: true,
              id: true,
              module: true,
              rule_set_version: true,
              status: true,
              trust_score: true,
              upload_ids: true,
              variance_cents: true,
            },
          })
        : Promise.resolve([]),
      certRunIds.length
        ? prisma.rule_citations_v2.findMany({
            where: {
              cert_run_id: {
                in: certRunIds,
              },
            },
            orderBy: [{ rule_id: "asc" }],
            select: {
              cert_run_id: true,
              fired_count: true,
              rule_id: true,
              rule_version: true,
              sample_evidence: true,
              variance_cents: true,
            },
          })
        : Promise.resolve([]),
      governedLocationIds.length
        ? prisma.schema_registry_v2.findMany({
            where: {
              location_id: {
                in: governedLocationIds,
              },
              status: {
                in: ["sealed", "seal"],
              },
            },
            orderBy: [{ version: "desc" }, { id: "desc" }],
            select: {
              id: true,
              location_id: true,
              module: true,
              vendor: true,
              version: true,
            },
          })
        : Promise.resolve([]),
      governedLocationIds.length
        ? prisma.contract_configs_v2.findMany({
            where: {
              location_id: {
                in: governedLocationIds,
              },
              status: {
                in: ["sealed", "seal"],
              },
            },
            orderBy: [{ version: "desc" }, { id: "desc" }],
            select: {
              id: true,
              location_id: true,
              module: true,
              vendor: true,
              version: true,
            },
          })
        : Promise.resolve([]),
    ]);
    const persistedUploadIds = [...new Set(certRuns.flatMap((run) => parseNumericIds(run.upload_ids)))];
    const uploads = persistedUploadIds.length
      ? await prisma.uploads_v2.findMany({
          where: {
            id: { in: persistedUploadIds },
          },
          orderBy: [{ uploaded_at: "desc" }, { id: "desc" }],
          select: {
            artifact_key: true,
            file_name: true,
            id: true,
            location_id: true,
            module: true,
            page_count: true,
            row_count: true,
            sha256: true,
            uploaded_at: true,
            validation_summary: true,
            vendor: true,
          },
        })
      : [];

    const certRunById = new Map(certRuns.map((row) => [row.id, row]));
    const ruleCitationsByRun = new Map<number, typeof ruleCitations>();
    for (const citation of ruleCitations) {
      const current = ruleCitationsByRun.get(citation.cert_run_id) ?? [];
      current.push(citation);
      ruleCitationsByRun.set(citation.cert_run_id, current);
    }

    const lineageBackedReports = canonicalReports.filter((report) => persistedCaarById.has(report.caar_id));
    const orphanCount = canonicalReports.length - lineageBackedReports.length;
    if (orphanCount > 0) {
      console.warn(`Filtered ${orphanCount} orphan CAAR report row(s) without persisted lineage.`);
    }

    return NextResponse.json({
      reports: lineageBackedReports.map((report) => {
        const persistedCaar = persistedCaarById.get(report.caar_id) ?? null;
        const moduleId =
          persistedCaar?.module === "M01" || persistedCaar?.module === "M02" ? persistedCaar.module : null;
        const certRun = persistedCaar ? certRunById.get(persistedCaar.cert_run_id) ?? null : null;
        const citations = certRun ? ruleCitationsByRun.get(certRun.id) ?? [] : [];
        const scoreDeductions = buildScoreDeductions(citations);
        const scoreReducingRuleIds = new Set(scoreDeductions.flatMap((deduction) => deduction.ruleIds));
        const problemCitations = citations.filter(isProblemRuleCitation);
        const monetaryCitations = citations.filter(isMonetaryRuleCitation);
        const problemCitationIds = new Set([
          ...problemCitations.map((citation) => citation.rule_id),
          ...monetaryCitations.map((citation) => citation.rule_id),
        ]);
        const scoreReducingCitations = citations.filter(
          (citation) => !problemCitationIds.has(citation.rule_id) && scoreReducingRuleIds.has(citation.rule_id),
        );
        const scoreReducingCitationIds = new Set(scoreReducingCitations.map((citation) => citation.rule_id));
        const scoreNeutralCitations = citations.filter(
          (citation) => !problemCitationIds.has(citation.rule_id) && !scoreReducingCitationIds.has(citation.rule_id),
        );
        const certRunUploadIds = new Set(parseNumericIds(certRun?.upload_ids));
        const moduleUploads =
          moduleId
            ? uploads.filter(
                (upload) =>
                  upload.module === moduleId &&
                  certRunUploadIds.has(upload.id),
              )
            : [];
        const reconciliation = moduleId
          ? deriveReconciliationExceptions({
              certificationPeriod: report.period,
              moduleId,
              uploads: moduleUploads,
            })
          : { exceptions: [], notes: [], warnings: [] };
        const sealedSchema =
          persistedCaar && moduleId
            ? sealedSchemas.find((row) => row.location_id === persistedCaar.location_id && row.module === moduleId) ?? null
            : null;
        const sealedContract =
          persistedCaar && moduleId
            ? sealedContracts.find((row) => row.location_id === persistedCaar.location_id && row.module === moduleId) ?? null
            : null;
        const amount = report.amount_display || formatCentsToCurrency(report.amount_cents);

        return {
          accountId: report.account_id,
          amount,
          createdAt: report.created_at?.toISOString() ?? null,
          createdBy: report.created_by,
          dimensions: isCaarDimensionArray(report.dimensions) ? report.dimensions : [],
          exhibits: report.exhibits ?? 0,
          findings: isStringArray(report.findings) ? report.findings : [],
          id: report.caar_id,
          locationId: report.location_id,
          locationName: report.location_name,
          narrative: report.narrative,
          period: report.period,
          restaurantId: report.restaurant_id,
          status: persistedCaar?.court_admissible ? "Certified" : "Needs Remediation",
          traceability: {
            blockingRuleCitations: buildRuleCitationSummaries(problemCitations),
            certCompletedAt: certRun?.completed_at?.toISOString() ?? null,
            certRunId: certRun?.id ?? null,
            courtAdmissible: persistedCaar?.court_admissible ?? null,
            evidence: moduleId ? buildEvidenceRows({ moduleId, uploads: moduleUploads }) : [],
            fieldAudit: buildFieldAuditRows({
              amount,
              certCompletedAt: certRun?.completed_at?.toISOString() ?? null,
              certRunId: certRun?.id ?? null,
              courtAdmissible: persistedCaar?.court_admissible ?? null,
              moduleId,
              record: {
                caarId: report.caar_id,
                period: report.period,
                status: report.status,
                trustScore: report.trust_score,
              },
              ruleCitationCount: problemCitations.length,
              ruleSetVersion: certRun?.rule_set_version ?? null,
              sealedAt: persistedCaar?.sealed_at?.toISOString() ?? null,
              sealedContract,
              sealedSchema,
            }),
            informationalRuleCitations: buildRuleCitationSummaries(scoreNeutralCitations.filter(isInformationalRuleCitation)),
            monetaryRuleCitations: buildRuleCitationSummaries(monetaryCitations),
            module: moduleId,
            passedRuleCitations: buildRuleCitationSummaries(scoreNeutralCitations.filter((citation) => !isInformationalRuleCitation(citation))),
            reconciliationExceptions: reconciliation.exceptions,
            reconciliationNotes: reconciliation.notes,
            reconciliationWarnings: reconciliation.warnings,
            ruleCitations: buildRuleCitationSummaries(problemCitations),
            scoreDeductions,
            scoreNeutralRuleCitations: buildRuleCitationSummaries(scoreNeutralCitations),
            scoreReducingRuleCitations: buildRuleCitationSummaries(scoreReducingCitations),
            ruleSetVersion: certRun?.rule_set_version ?? null,
            sealedAt: persistedCaar?.sealed_at?.toISOString() ?? null,
          },
          trustScore: report.trust_score,
        };
      }),
    });
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    console.error("Fetch CAAR reports failed:", error);
    return NextResponse.json(
      { error: "Unable to load CAAR reports right now." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireManagerSession();
    return NextResponse.json(
      {
        error:
          "Legacy direct CAAR saves are disabled. CAAR records must be created through the certification pipeline so persisted lineage is guaranteed.",
      },
      { status: 410 },
    );
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    console.error("Save CAAR report failed:", error);
    return NextResponse.json(
      { error: "Unable to save the CAAR report right now." },
      { status: 500 },
    );
  }
}
