import type { Metadata } from "next";
import { deleteSuperAdminTableRowAction } from "@/app/admin/actions";
import {
  adminMetadata,
  AdminLoginScreen,
  AdminShell,
  getSearchParam,
  isAdminAuthorized,
} from "@/app/admin/admin-ui";
import {
  getSuperAdminTableSnapshot,
  listSuperAdminTableCounts,
  normalizeSuperAdminValue,
} from "../table-registry";

export const metadata: Metadata = adminMetadata;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SuperAdminTablesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const authorized = await isAdminAuthorized();

  if (!authorized) {
    return <AdminLoginScreen error={getSearchParam(resolvedSearchParams, "error")} />;
  }

  const selectedTable = getSearchParam(resolvedSearchParams, "table");
  const tableState = getSearchParam(resolvedSearchParams, "tableState");
  const [tables, snapshot] = await Promise.all([
    listSuperAdminTableCounts(),
    getSuperAdminTableSnapshot(selectedTable),
  ]);

  return (
    <AdminShell
      currentPath="/superadmin/tables"
      currentTable={snapshot.definition.name}
      title="Tables"
      description="Direct inspection surface for every production table used by the application. Use the structured pages for workflow actions and use this screen for raw table inspection and row-level control."
    >
      <div className="space-y-6">
        <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
                Active Table
              </div>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
                {snapshot.definition.label}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                {snapshot.definition.description}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Columns" value={String(snapshot.columns.length)} />
              <StatCard label="Rows Loaded" value={String(snapshot.rows.length)} />
              <StatCard label="Delete by ID" value={snapshot.hasNumericId ? "Enabled" : "No"} />
            </div>
          </div>

          {tableState === "deleted" ? (
            <AdminNotice tone="success">Row deleted successfully.</AdminNotice>
          ) : null}
          {tableState === "invalid-row" ? (
            <AdminNotice tone="error">This table cannot be deleted generically from this screen.</AdminNotice>
          ) : null}
          {tableState === "server-error" ? (
            <AdminNotice tone="error">Unable to update the selected table right now.</AdminNotice>
          ) : null}
          {snapshot.missingTable ? (
            <AdminNotice tone="error">
              This table does not exist in the current database schema yet.
            </AdminNotice>
          ) : null}
        </section>

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          {tables.map((table) => (
            <StatCard
              key={table.name}
              label={table.label}
              value={table.available ? String(table.count) : "N/A"}
            />
          ))}
        </section>

        <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
            Schema
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {snapshot.columns.map((column) => (
              <div
                key={`${snapshot.definition.name}-${column.column_name}`}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)]"
              >
                <span className="font-semibold text-[var(--text)]">{column.column_name}</span>
                <span> | {column.data_type}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-[var(--border)] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div className="border-b border-[var(--border)] px-6 py-4">
            <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
              Data
            </div>
            <div className="mt-2 text-sm text-[var(--muted)]">
              Showing the latest {snapshot.rows.length} rows from `public.{snapshot.definition.name}`.
            </div>
          </div>

          {snapshot.rows.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    {snapshot.columns.map((column) => (
                      <th
                        key={`${snapshot.definition.name}-${column.column_name}-header`}
                        className="whitespace-nowrap px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]"
                      >
                        {column.column_name}
                      </th>
                    ))}
                    {snapshot.hasNumericId ? (
                      <th className="whitespace-nowrap px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                        Actions
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {snapshot.rows.map((row) => {
                    const rowData = row as Record<string, unknown> & { __rowKey: string };
                    const rawId = rowData.id;
                    const numericId = typeof rawId === "number" ? rawId : Number(rawId);
                    const canDeleteRow = snapshot.hasNumericId && Number.isFinite(numericId);

                    return (
                      <tr key={String(rowData.__rowKey)} className="border-t border-[var(--border)] align-top">
                        {snapshot.columns.map((column) => (
                          <td
                            key={`${rowData.__rowKey}-${column.column_name}`}
                            className="max-w-[320px] px-4 py-3 text-sm text-[var(--text)]"
                          >
                            <div className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--surface)] px-3 py-2">
                              {normalizeSuperAdminValue(rowData[column.column_name])}
                            </div>
                          </td>
                        ))}
                        {snapshot.hasNumericId ? (
                          <td className="px-4 py-3">
                            {canDeleteRow ? (
                              <form action={deleteSuperAdminTableRowAction}>
                                <input type="hidden" name="table" value={snapshot.definition.name} />
                                <input type="hidden" name="id" value={numericId} />
                                <button
                                  type="submit"
                                  className="rounded-lg border border-[rgba(214,48,49,0.18)] px-3 py-2 text-xs font-medium text-[var(--accent)] transition hover:border-[var(--accent)]"
                                >
                                  Delete Row
                                </button>
                              </form>
                            ) : (
                              <span className="text-xs text-[var(--muted)]">No ID</span>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-10 text-sm text-[var(--muted)]">No rows found in this table.</div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4 shadow-[0_12px_30px_rgba(0,0,0,0.04)]">
      <div className="text-xl font-semibold text-[var(--text)]">{value}</div>
      <div className="mt-1 text-xs text-[var(--muted)]">{label}</div>
    </div>
  );
}

function AdminNotice({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "error" | "success";
}) {
  return (
    <div
      className={`mt-5 rounded-2xl px-4 py-3 text-sm ${
        tone === "success"
          ? "border border-[rgba(0,200,83,0.18)] bg-[rgba(0,200,83,0.06)] text-[var(--success)]"
          : "border border-[rgba(214,48,49,0.2)] bg-[rgba(214,48,49,0.06)] text-[var(--accent)]"
      }`}
    >
      {children}
    </div>
  );
}
