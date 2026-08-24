/** Pure normalization and display helpers shared by deterministic engine phases. */
export function centsToDollars(value: number) {
  return value / 100;
}

export function dollarsToCents(value: number) {
  return Math.round(value * 100);
}

export function numberValue(value: number | string | undefined | null) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseDateValue(value: string | undefined | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function textValue(value: string | undefined | null) {
  return String(value ?? "").trim().toLowerCase();
}

export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function roundInteger(value: number) {
  return Math.round(value);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}
