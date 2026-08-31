export type MonthlyEvidenceRow = {
  artifact_key: string;
  evidence_month: string | null;
  validation_summary?: unknown;
};

function previousMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function hasActivityForMonth(upload: MonthlyEvidenceRow, certificationMonth: string) {
  if (!upload.validation_summary || typeof upload.validation_summary !== "object") return false;
  const metrics = (upload.validation_summary as { metrics?: unknown }).metrics;
  if (!metrics || typeof metrics !== "object") return false;
  const monthlyMetrics = (metrics as { monthlyMetrics?: unknown }).monthlyMetrics;
  return Boolean(
    monthlyMetrics &&
    typeof monthlyMetrics === "object" &&
    certificationMonth in monthlyMetrics,
  );
}

function hasMergeLineage(upload: MonthlyEvidenceRow) {
  if (!upload.validation_summary || typeof upload.validation_summary !== "object") return false;
  const validation = upload.validation_summary as { sourceHeaders?: unknown; sourceRows?: unknown };
  return Array.isArray(validation.sourceHeaders) && Array.isArray(validation.sourceRows);
}

export function getM02MonthlyFinalEvidenceBlockers(
  uploads: MonthlyEvidenceRow[],
  certificationMonth: string,
) {
  const priorMonth = previousMonth(certificationMonth);
  const requirements = [
    { artifactPrefix: "m02-settlement", evidenceMonth: certificationMonth, label: "DSP settlement", requiresDatedRows: true },
    { artifactPrefix: "m02-pos", evidenceMonth: certificationMonth, label: "POS summary by channel", requiresDatedRows: true },
    { artifactPrefix: "m02-agreement", evidenceMonth: null, label: "signed DSP agreement", requiresDatedRows: false },
    { artifactPrefix: "m02-bank", evidenceMonth: certificationMonth, label: "bank statement", requiresDatedRows: false },
  ];

  const blockers = requirements.flatMap((requirement) => {
    const matchingUpload = uploads.find((upload) =>
      upload.artifact_key.startsWith(requirement.artifactPrefix) &&
      (requirement.evidenceMonth === null || upload.evidence_month === requirement.evidenceMonth),
    );

    if (!matchingUpload) {
      return [
          requirement.evidenceMonth === null
            ? `${requirement.label} is missing.`
            : `${requirement.label} export for ${requirement.evidenceMonth} is missing.`,
      ];
    }

    if (
      requirement.requiresDatedRows &&
      !hasActivityForMonth(matchingUpload, certificationMonth)
    ) {
      return [`${requirement.label} export for ${requirement.evidenceMonth} contains no dated activity rows for ${certificationMonth}.`];
    }
    if (requirement.requiresDatedRows && !hasMergeLineage(matchingUpload)) {
      return [`${requirement.label} export for ${requirement.evidenceMonth} must be re-uploaded so overlapping rows can be deduplicated safely.`];
    }

    return [];
  });

  // A provider export may overlap the next activity month. Include that earlier
  // window when it contributes rows, but never require an unrelated prior file.
  for (const artifact of [
    { artifactPrefix: "m02-settlement", label: "DSP settlement" },
    { artifactPrefix: "m02-pos", label: "POS summary by channel" },
  ]) {
    const priorUpload = uploads.find((upload) =>
      upload.artifact_key.startsWith(artifact.artifactPrefix) &&
      upload.evidence_month === priorMonth,
    );
    if (
      priorUpload &&
      hasActivityForMonth(priorUpload, certificationMonth) &&
      !hasMergeLineage(priorUpload)
    ) {
      blockers.push(`${artifact.label} export for ${priorMonth} must be re-uploaded so its overlapping ${certificationMonth} rows can be deduplicated safely.`);
    }
  }

  return blockers;
}
