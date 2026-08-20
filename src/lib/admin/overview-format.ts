export function truncateDecimal(value: number, fractionDigits = 2) {
  if (!Number.isFinite(value)) return 0;

  const factor = 10 ** Math.max(0, fractionDigits);
  return Math.trunc((value + Number.EPSILON) * factor) / factor;
}

export function formatOverviewDecimal(value: number, fractionDigits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
    useGrouping: true,
  }).format(truncateDecimal(value, fractionDigits));
}

export function formatCurrencyFromCents(value: number | bigint) {
  const cents = typeof value === "bigint" ? value : BigInt(Math.trunc(value));
  const zero = BigInt(0);
  const oneHundred = BigInt(100);
  const sign = cents < zero ? "-" : "";
  const absoluteCents = cents < zero ? -cents : cents;
  const dollars = absoluteCents / oneHundred;
  const remainder = absoluteCents % oneHundred;

  return `${sign}$${new Intl.NumberFormat("en-US").format(dollars)}.${remainder.toString().padStart(2, "0")}`;
}
