import type { CaarRecord } from "../types";

export type CaarDateOrder = "newest" | "oldest";

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

export function getCaarPeriodKey(period: string) {
  const match = period.trim().toLowerCase().match(/^([a-z]+)\s+(\d{4})/);
  if (!match) return "unknown";
  const monthIndex = MONTHS.indexOf(match[1]);
  if (monthIndex < 0) return "unknown";
  return `${match[2]}-${String(monthIndex + 1).padStart(2, "0")}`;
}

export function getCaarPeriodLabel(periodKey: string) {
  if (periodKey === "unknown") return "Date unavailable";
  const [year, month] = periodKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function organizeCaarRecords(records: CaarRecord[], period: string, order: CaarDateOrder) {
  const filtered = period === "all"
    ? records
    : records.filter((record) => getCaarPeriodKey(record.period) === period);
  const direction = order === "newest" ? -1 : 1;
  return [...filtered].sort((left, right) => {
    const periodDifference = getCaarPeriodKey(left.period).localeCompare(getCaarPeriodKey(right.period));
    if (periodDifference !== 0) return periodDifference * direction;
    return left.id.localeCompare(right.id) * direction;
  });
}

export function getCaarPeriodOptions(records: CaarRecord[]) {
  return [...new Set(records.map((record) => getCaarPeriodKey(record.period)))]
    .filter((period) => period !== "unknown")
    .sort((left, right) => right.localeCompare(left));
}

export function CaarDateControls({
  count,
  location,
  locations,
  onLocationChange,
  onOrderChange,
  onPeriodChange,
  order,
  period,
  periods,
}: {
  count: number;
  location?: string;
  locations?: Array<{ id: string; name: string }>;
  onLocationChange?: (locationId: string) => void;
  onOrderChange: (order: CaarDateOrder) => void;
  onPeriodChange: (period: string) => void;
  order: CaarDateOrder;
  period: string;
  periods: string[];
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      <div className="flex flex-wrap gap-3">
        {locations && onLocationChange ? (
          <label className="text-xs font-semibold text-[var(--muted)]">
            Location
            <select
              aria-label="Filter CAARs by location"
              value={location ?? "all"}
              onChange={(event) => onLocationChange(event.target.value)}
              className="mt-1 block min-w-48 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-normal text-[var(--text)] outline-none focus:border-[var(--text)]"
            >
              <option value="all">All locations</option>
              {locations.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="text-xs font-semibold text-[var(--muted)]">
          Certification period
          <select
            aria-label="Filter CAARs by certification period"
            value={period}
            onChange={(event) => onPeriodChange(event.target.value)}
            className="mt-1 block min-w-48 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-normal text-[var(--text)] outline-none focus:border-[var(--text)]"
          >
            <option value="all">All periods</option>
            {periods.map((option) => (
              <option key={option} value={option}>{getCaarPeriodLabel(option)}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-[var(--muted)]">
          Organize
          <select
            aria-label="Order CAARs by certification period"
            value={order}
            onChange={(event) => onOrderChange(event.target.value as CaarDateOrder)}
            className="mt-1 block min-w-40 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-normal text-[var(--text)] outline-none focus:border-[var(--text)]"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>
      <div className="text-sm text-[var(--muted)]">{count} {count === 1 ? "CAAR" : "CAARs"}</div>
    </div>
  );
}
