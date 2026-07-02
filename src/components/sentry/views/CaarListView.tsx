import type { CaarRecord } from "../types";
import { HelpTip, SectionCard } from "../ui/primitives";

export function CaarListView({
  onDownloadPdf,
  onOpenCaar,
  records,
}: {
  onDownloadPdf: (record: CaarRecord) => void;
  onOpenCaar: (record: CaarRecord) => void;
  records: CaarRecord[];
}) {
  const total = records.length;
  const certified = records.filter((record) => record.status === "Court Admissible").length;
  const filed = Math.max(0, certified - 1);
  const courtAdmissible = certified;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total CAARs" tone="accent" value={String(total)} />
        <StatCard label="Certified" tone="success" value={String(certified)} />
        <StatCard label="Filed with Processor" tone="info" value={String(filed)} />
        <StatCard label="Court-Admissible" tone="success" value={String(courtAdmissible)} />
      </div>

      <SectionCard className="overflow-hidden p-0">
        <div className="hidden grid-cols-[140px_160px_120px_1fr_110px_140px_150px] gap-3 bg-[var(--panel-soft)] px-5 py-3 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)] lg:grid">
          <HeaderWithTip
            label="CAAR ID"
            title="CAARs / Table"
            sections={[
              {
                label: "What It Is",
                text: "Unique identifier for this Certified Audit and Analysis Report. Formatted as CAAR-[PERIOD]-[LOC]-[SEQ].",
              },
              {
                label: "What It Does",
                text: "Use this ID to reference the report in legal filings, vendor dispute letters, and communications with your WGS Advisor.",
              },
              {
                label: "Why It Matters",
                text: "The CAAR ID is permanent and immutable. It ties the report to its Vault Snapshot and can be verified at any future date.",
              },
            ]}
            footerLabel="Format"
            footerValue="CAAR-[Period]-[Location]-[Seq]"
          />
          <HeaderWithTip
            label="Location"
            title="CAARs / Table"
            sections={[
              {
                label: "What It Is",
                text: "The enrolled location this CAAR was generated for.",
              },
              {
                label: "What It Does",
                text: "Links the report back to the Location Waterfall row for the current trust and module posture.",
              },
              {
                label: "Why It Matters",
                text: "Each CAAR belongs to one location for one period. Multi-location output is split into separate CAARs per location.",
              },
            ]}
            footerLabel="Scope"
            footerValue="One location / one period"
          />
          <HeaderWithTip
            label="Status"
            title="CAARs / Table"
            sections={[
              {
                label: "What It Is",
                text: "The current certification status of this CAAR: Active, Superseded, or Archived.",
              },
              {
                label: "What It Does",
                text: "Only the current active report should be treated as the operative record for downstream submission.",
              },
              {
                label: "Why It Matters",
                text: "Never submit a superseded CAAR. The newer certification is the operative record even though both remain in the audit trail.",
              },
            ]}
            footerLabel="Status"
            footerValue="Active is the operative record"
          />
          <span>Description</span>
          <HeaderWithTip
            label="Court Adm."
            title="CAARs / Col"
            sections={[
              {
                label: "What It Is",
                text: "Whether this CAAR meets FRE 803(6), 902(11), and 1002, the standards required for court admissibility.",
              },
              {
                label: "How To Use It",
                text: "Only present court-admissible CAARs as evidence. Non-admissible reports are useful for internal tracking only.",
              },
              {
                label: "Why It Matters",
                text: "A court-admissible CAAR self-authenticates and does not require live witness testimony. The SHA-256 hash chain is the proof.",
              },
            ]}
            footerLabel="Legal Standard"
            footerValue="FRE 803(6) / 902(11) / 1002"
          />
          <span>Seal Hash</span>
          <span>Action</span>
        </div>

        <div>
          {records.map((record) => {
            const courtReady = record.status === "Court Admissible";
            const sealHash = buildSealHash(record.id);

            return (
              <div
                key={record.id}
                className="grid gap-3 border-t border-[var(--border)] px-5 py-4 first:border-t-0 lg:grid-cols-[140px_160px_120px_1fr_110px_140px_150px]"
              >
                <span className="font-[family-name:var(--font-mono)] text-[12px] text-[var(--info)]">{record.id}</span>
                <span className="text-[12px] text-[var(--text)]">{record.locationName}</span>
                <span>
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                      courtReady
                        ? "bg-[rgba(0,200,83,0.08)] text-[var(--success)]"
                        : "bg-[var(--panel-soft)] text-[var(--muted)]"
                    }`}
                  >
                    Active
                  </span>
                </span>
                <span className="text-[12px] text-[var(--muted)]">{buildDescription(record)}</span>
                <span>
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${
                      courtReady
                        ? "bg-[rgba(0,200,83,0.08)] text-[var(--success)]"
                        : "bg-[rgba(214,48,49,0.08)] text-[var(--accent)]"
                    }`}
                  >
                    {courtReady ? "Yes" : "-"}
                  </span>
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--muted)]">{sealHash}</span>
                <span className="flex gap-2 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => onOpenCaar(record)}
                    className="rounded-lg bg-[var(--text)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
                  >
                    View Report
                  </button>
                  <button
                    type="button"
                    onClick={() => onDownloadPdf(record)}
                    className="rounded-lg border border-[rgba(214,48,49,0.3)] px-3 py-2 text-sm text-[var(--accent)] transition hover:bg-[rgba(214,48,49,0.08)]"
                  >
                    PDF
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

function HeaderWithTip({
  label,
  title,
  sections,
  footerLabel,
  footerValue,
}: {
  label: string;
  title: string;
  sections: { label: string; text: string }[];
  footerLabel?: string;
  footerValue?: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span>{label}</span>
      <HelpTip
        title={title}
        sections={sections}
        footerLabel={footerLabel}
        footerValue={footerValue}
      />
    </span>
  );
}

function StatCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "accent" | "success" | "info";
  value: string;
}) {
  const valueClass =
    tone === "success"
      ? "text-[var(--success)]"
      : tone === "info"
        ? "text-[var(--info)]"
        : "text-[var(--accent)]";

  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      <div className={`font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-[-0.06em] ${valueClass}`}>
        {value}
      </div>
      <div className="mt-1 text-[12px] text-[var(--muted)]">{label}</div>
    </div>
  );
}

function buildDescription(record: CaarRecord) {
  return `${record.period} / ${record.amount} / TS ${record.trustScore}`;
}

function buildSealHash(id: string) {
  const base = id.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  return `${base.slice(0, 10)}...`;
}
