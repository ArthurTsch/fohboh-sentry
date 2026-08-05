export type PersistedCitationLike = {
  rule_id: string;
  sample_evidence?: unknown;
};

export type CitationDisposition = "blocking" | "informational" | "monetary" | "passed";

export function getExplicitCitationDisposition(value: unknown): CitationDisposition | null {
  if (!value || typeof value !== "object" || !("disposition" in value)) return null;
  const disposition = (value as { disposition?: unknown }).disposition;
  return disposition === "blocking" ||
    disposition === "informational" ||
    disposition === "monetary" ||
    disposition === "passed"
    ? disposition
    : null;
}

function citationSamples(value: unknown): Array<Record<string, unknown>> {
  if (!value || typeof value !== "object") return [];
  const samples = "samples" in value ? (value as { samples?: unknown }).samples : value;
  if (!Array.isArray(samples)) return [];
  return samples.filter(
    (sample): sample is Record<string, unknown> => Boolean(sample) && typeof sample === "object",
  );
}

export function isInformationalRuleCitation(row: PersistedCitationLike) {
  const explicitDisposition = getExplicitCitationDisposition(row.sample_evidence);
  if (explicitDisposition) return explicitDisposition === "informational";

  if (
    row.rule_id === "R046" ||
    row.rule_id === "R051" ||
    row.rule_id === "R088" ||
    row.rule_id === "R089" ||
    row.rule_id === "R091" ||
    row.rule_id === "R092" ||
    row.rule_id === "R093" ||
    row.rule_id === "R094" ||
    row.rule_id === "R095"
  ) {
    return true;
  }

  const samples = citationSamples(row.sample_evidence);
  if (row.rule_id === "R121") {
    return !samples.some((sample) => sample.contract_expired === true);
  }
  if (row.rule_id === "R132") {
    return !samples.some((sample) => sample.formula_version_changed_during_period === true);
  }

  return false;
}
