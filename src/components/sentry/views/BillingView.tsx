"use client";

import { useMemo } from "react";
import type { CaarRecord, LocationRecord } from "../types";
import { HelpTip, SectionCard } from "../ui/primitives";

const DEFAULT_BILLING_RATE_BPS = 1250;
const BUNDLE_SUBSCRIPTION_CENTS = 29900;
const SINGLE_MODULE_SUBSCRIPTION_CENTS = 19900;
const WHITE_GLOVE_SUBSCRIPTION_CENTS = 39900;

type StatementRow = {
  caarFeeCents: number;
  dueLabel: string;
  id: string;
  period: string;
  status: "Due" | "Draft";
  subscriptionCents: number;
  totalCents: number;
};

function parseAmountToCents(value: string) {
  const numeric = Number(value.replace(/[^0-9.-]/g, "")) || 0;
  return Math.round(numeric * 100);
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
}

function parsePeriodLabel(period: string) {
  const parsed = new Date(`${period} 1`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDueDate(period: string) {
  const periodDate = parsePeriodLabel(period);
  if (!periodDate) return "Draft";

  const dueDate = new Date(periodDate.getFullYear(), periodDate.getMonth(), 25);
  return dueDate.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "2-digit",
  });
}

function downloadStatementPreview(statement: StatementRow, feeRateBps: number) {
  const content = [
    `Statement: ${statement.id}`,
    `Period: ${statement.period}`,
    `Subscription: ${formatCurrency(statement.subscriptionCents)}`,
    `CAAR Transaction Fees: ${formatCurrency(statement.caarFeeCents)}`,
    `Total: ${formatCurrency(statement.totalCents)}`,
    `Status: ${statement.status}`,
    `Modeled fee rate: ${(feeRateBps / 100).toFixed(2)}%`,
    "",
    "Payment rail automation is not connected yet.",
    "This statement preview is generated from sealed CAAR records currently visible to the signed-in account.",
  ].join("\n");

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${statement.id}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function BillingView({
  caars,
  locations,
}: {
  caars: CaarRecord[];
  locations: LocationRecord[];
}) {
  const accountModules = useMemo(() => {
    const active = new Set<"M01" | "M02">();
    for (const location of locations) {
      if (location.modules.some((module) => module.label === "M01")) active.add("M01");
      if (location.modules.some((module) => module.label === "M02")) active.add("M02");
    }
    return active;
  }, [locations]);

  const subscriptionCents =
    accountModules.size >= 2 ? BUNDLE_SUBSCRIPTION_CENTS : SINGLE_MODULE_SUBSCRIPTION_CENTS;
  const billingRateBps = DEFAULT_BILLING_RATE_BPS;

  const statements = useMemo(() => {
    const groups = new Map<string, number>();
    for (const record of caars) {
      const current = groups.get(record.period) ?? 0;
      groups.set(record.period, current + parseAmountToCents(record.amount));
    }

    const rows: StatementRow[] = [...groups.entries()]
      .map(([period, recoverableAmountCents]) => {
        const caarFeeCents = Math.round((recoverableAmountCents * billingRateBps) / 10000);
        const totalCents = subscriptionCents + caarFeeCents;
        return {
          caarFeeCents,
          dueLabel: formatDueDate(period),
          id: `STMT-${period.replace(/\s+/g, "-").toUpperCase()}`,
          period,
          status: "Draft" as const,
          subscriptionCents,
          totalCents,
        };
      })
      .sort((left, right) => {
        const leftDate = parsePeriodLabel(left.period)?.getTime() ?? 0;
        const rightDate = parsePeriodLabel(right.period)?.getTime() ?? 0;
        return rightDate - leftDate;
      });

    if (rows[0]) {
      rows[0] = { ...rows[0], status: "Due" };
    }

    return rows;
  }, [billingRateBps, caars, subscriptionCents]);

  const currentStatement = statements[0] ?? null;
  const activeLocationsThisCycle = currentStatement
    ? new Set(
        caars
          .filter((record) => record.period === currentStatement.period)
          .map((record) => record.locationId),
      ).size
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.04em]">
          <span>Billing</span>
          <HelpTip
            title="Billing"
            sections={[
              {
                label: "What It Is",
                text: "The billing surface for monthly subscription pricing and certified CAAR transaction fees.",
              },
              {
                label: "How It Works",
                text: "Each sealed CAAR contributes a transaction fee line based on the certified recoverable amount for that location and period.",
              },
              {
                label: "Current State",
                text: "This page reflects the documented commercial model now and is prepared for hosted payment rails later without changing the billing basis.",
              },
            ]}
            footerLabel="Fee Basis"
            footerValue="Sealed CAAR output only"
          />
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Your plan, payment methods, statements, and current balance due to FohBoh for certified
          transactions.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard>
          <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
            Amount Due · FohBoh CAAR Transaction Fees
          </div>
          <div className="mt-2 font-[family-name:var(--font-display)] text-5xl font-extrabold tracking-[-0.06em]">
            {formatCurrency(currentStatement?.totalCents ?? 0)}
          </div>
          <div className="mt-2 text-sm text-[var(--muted)]">
            {currentStatement
              ? `Covers ${activeLocationsThisCycle} certified location${activeLocationsThisCycle === 1 ? "" : "s"} this cycle · due ${currentStatement.dueLabel}`
              : "No certified CAARs have sealed yet for this account."}
          </div>

          <button
            type="button"
            disabled
            className="mt-5 w-full rounded-md bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white opacity-60"
          >
            Payment method connection pending
          </button>

          <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--info)]">
              How This Is Calculated
            </div>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              10-15% of the certified recoverable amount per location, invoiced automatically the
              moment each CAAR seals. Never a bounty, never contingent on collection. FohBoh is not
              a debt collector.
            </p>
            <p className="mt-2 text-xs leading-6 text-[var(--muted)]">
              Current modeled fee rate on this account: {(billingRateBps / 100).toFixed(2)}%. Base
              subscription: {formatCurrency(subscriptionCents)} per month.
            </p>
            <p className="mt-2 text-xs leading-6 text-[var(--muted)]">
              Commercial tiers from the product spec: M01 only{" "}
              {formatCurrency(SINGLE_MODULE_SUBSCRIPTION_CENTS)}/mo, M02 only{" "}
              {formatCurrency(SINGLE_MODULE_SUBSCRIPTION_CENTS)}/mo, M01+M02 bundle{" "}
              {formatCurrency(BUNDLE_SUBSCRIPTION_CENTS)}/mo, and White Glove{" "}
              {formatCurrency(WHITE_GLOVE_SUBSCRIPTION_CENTS)}/mo per certification cadence.
            </p>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.03em]">
            Payment methods
          </div>
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="text-sm font-medium text-[var(--text)]">No payment methods configured yet</div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Card and ACH collection rails are not connected yet. This area is prepared for hosted,
              PCI-compliant tokenized payment methods.
            </p>
          </div>
          <p className="mt-5 text-xs leading-6 text-[var(--muted)]">
            Card and account numbers will never be entered directly into this screen. Future updates
            will open a secure hosted payment form. FohBoh systems will store only tokenized
            references and masked last-four details.
          </p>
        </SectionCard>
      </div>

      <div>
        <div className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.04em]">
          Statements
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Monthly statements covering subscription and CAAR transaction fees by billing cycle.
        </p>
      </div>

      <SectionCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--panel-soft)] text-left font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                <th className="px-6 py-4">Statement</th>
                <th className="px-6 py-4">Period</th>
                <th className="px-6 py-4">Subscription</th>
                <th className="px-6 py-4">CAAR Txn Fees</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {statements.length > 0 ? (
                statements.map((statement) => (
                  <tr key={statement.id} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-6 py-5 font-semibold">{statement.id}</td>
                    <td className="px-6 py-5 text-sm text-[var(--text)]">{statement.period}</td>
                    <td className="px-6 py-5 text-sm">{formatCurrency(statement.subscriptionCents)}</td>
                    <td className="px-6 py-5 text-sm">{formatCurrency(statement.caarFeeCents)}</td>
                    <td className="px-6 py-5 text-sm font-medium">{formatCurrency(statement.totalCents)}</td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] ${
                          statement.status === "Due"
                            ? "bg-[rgba(255,152,0,0.1)] text-[#b86a00]"
                            : "bg-[var(--panel-soft)] text-[var(--muted)]"
                        }`}
                      >
                        {statement.status === "Due" ? `Due ${statement.dueLabel}` : "Draft preview"}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <button
                        type="button"
                        onClick={() => downloadStatementPreview(statement, billingRateBps)}
                        className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:border-[var(--text)]"
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-sm text-[var(--muted)]">
                    No billing statements are available yet because no CAAR has sealed for this
                    account.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <p className="text-xs leading-6 text-[var(--muted)]">
        Plan basis: {accountModules.size >= 2 ? "M01+M02 bundle" : "Single active module"} ·{" "}
        {formatCurrency(subscriptionCents)}/mo, all visible locations included. Every CAAR
        transaction fee line traces to a specific certified run and sealed CAAR.
      </p>
    </div>
  );
}
