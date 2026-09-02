export type MonthlyEvidenceRow = {
  artifact_key: string;
  evidence_month: string | null;
  validation_summary?: unknown;
};

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

export function getM02MonthlyFinalEvidenceBlockers(
  uploads: MonthlyEvidenceRow[],
  certificationMonth: string,
  vendorKey?: string | null,
) {
  const [year, month] = certificationMonth.split("-").map(Number);
  const followingDate = new Date(Date.UTC(year, month, 1));
  const followingMonth = `${followingDate.getUTCFullYear()}-${String(followingDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const requiresUberBankTail = vendorKey?.toLowerCase().replace(/[^a-z0-9]/g, "") === "ubereats";
  const requirements = [
    { artifactPrefix: "m02-settlement", evidenceMonth: certificationMonth, label: "DSP settlement", requiresDatedRows: true },
    { artifactPrefix: "m02-pos", evidenceMonth: certificationMonth, label: "POS summary by channel", requiresDatedRows: true },
    { artifactPrefix: "m02-agreement", evidenceMonth: null, label: "signed DSP agreement", requiresDatedRows: false },
    { artifactPrefix: "m02-bank", evidenceMonth: certificationMonth, label: "bank statement", requiresDatedRows: false },
    ...(requiresUberBankTail ? [
      { artifactPrefix: "m02-settlement", evidenceMonth: followingMonth, label: "DSP settlement bank-reconciliation tail", requiresDatedRows: true },
      { artifactPrefix: "m02-bank", evidenceMonth: followingMonth, label: "bank statement bank-reconciliation tail", requiresDatedRows: false },
    ] : []),
  ];

  return requirements.flatMap((requirement) => {
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
      !hasActivityForMonth(matchingUpload, requirement.evidenceMonth ?? certificationMonth)
    ) {
      return [`${requirement.label} export for ${requirement.evidenceMonth} contains no dated activity rows for ${requirement.evidenceMonth}.`];
    }
    return [];
  });
}
