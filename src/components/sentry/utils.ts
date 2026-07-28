export function getInitials(email: string) {
  return email.slice(0, 1).toUpperCase();
}

export function getTrustTone(score: number) {
  if (score >= 90) return "text-[var(--success)]";
  if (score >= 85) return "text-[#c07500]";
  return "text-[var(--accent)]";
}

export function getScoreBar(score: number) {
  if (score >= 90) return "bg-[var(--success)]";
  if (score >= 85) return "bg-[#ff9800]";
  return "bg-[var(--accent)]";
}

export function getSupportReply(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("certification")) {
    return "Run certification from the dashboard or a waterfall row after all source files show as uploaded, hash-verified, and schema-matched. Trust Score updates when the run completes.";
  }

  if (lower.includes("caar")) {
    return "A CAAR is a Certified Automated Audit & Recovery report. It documents verified reconciliation findings and the certified recovery amount after all evidence controls pass.";
  }

  if (lower.includes("trust score") || lower.includes("low")) {
    return "Low Trust Score usually means missing bank evidence, stale schema mappings, or incomplete cross-system reconciliation. Start with Waterfall and the CAAR dimensions.";
  }

  if (lower.includes("schema")) {
    return "Use Schema Registry to review column mappings, contract terms, and vault state. Contract fields should be sealed only after verification is complete.";
  }

  return "Support mode in this port is focused on workflow guidance. Use Upload Center, Schema Registry, Onboarding, and WGS Admin for operational review.";
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

export function parseCurrency(value: string) {
  return Number(value.replace(/[^0-9.-]/g, "")) || 0;
}
