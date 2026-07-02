import { useMemo, useState } from "react";
import type { WgsAccount, WgsApproval, WgsQueueItem, WgsUser } from "../types";
import { Badge, KpiCard, SectionCard } from "../ui/primitives";

export function WgsAdminView({
  accounts,
  approvals,
  onAddUser,
  onApprove,
  onEnterSupportMode,
  onOpenUser,
  onResolveQueue,
  queue,
  users,
}: {
  accounts: WgsAccount[];
  approvals: WgsApproval[];
  onAddUser: () => void;
  onApprove: (approvalId: string) => void | Promise<void>;
  onEnterSupportMode: (accountId: string) => void;
  onOpenUser: (user: WgsUser) => void;
  onResolveQueue: (ticketId: string) => void | Promise<void>;
  queue: WgsQueueItem[];
  users: WgsUser[];
}) {
  const [accountQuery, setAccountQuery] = useState("");
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(accounts[0]?.id ?? null);

  const filteredAccounts = useMemo(() => {
    const query = accountQuery.trim().toLowerCase();
    if (!query) return accounts;
    return accounts.filter((account) =>
      [account.id, account.name, account.modules, account.status].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [accountQuery, accounts]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Active Accounts" value={String(accounts.length)} sub="WGS-managed customer orgs" />
        <KpiCard label="Pending Onboarding" value="2" sub="Accounts requiring setup work" />
        <KpiCard label="DIY Approvals" value={String(approvals.length)} sub="Awaiting governance sign-off" />
        <KpiCard label="Open Tickets" value={String(queue.length)} sub="Support queue items" accent />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em]">
                Customer Accounts
              </div>
              <div className="text-sm text-[var(--muted)]">
                Search accounts, inspect details, and enter support mode.
              </div>
            </div>
            <input
              value={accountQuery}
              onChange={(event) => setAccountQuery(event.target.value)}
              placeholder="Search accounts..."
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
            />
          </div>
          <div className="space-y-3">
            {filteredAccounts.map((account) => {
              const open = expandedAccountId === account.id;
              return (
                <div key={account.id} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                  <button
                    type="button"
                    onClick={() => setExpandedAccountId((current) => (current === account.id ? null : account.id))}
                    className="grid w-full gap-3 p-4 text-left md:grid-cols-[1.4fr_80px_100px_90px_110px_110px_150px]"
                  >
                    <div>
                      <div className="font-medium">{account.name}</div>
                      <div className="text-xs text-[var(--muted)]">{account.id}</div>
                    </div>
                    <div>{account.locations}</div>
                    <div>{account.modules}</div>
                    <div>{account.avgTrust}</div>
                    <div>{account.lastActivity}</div>
                    <div>
                      <Badge tone={account.avgTrust >= 85 ? "success" : "warning"}>{account.status}</Badge>
                    </div>
                    <div className="md:text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEnterSupportMode(account.id);
                        }}
                        className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                      >
                        Support Mode
                      </button>
                    </div>
                  </button>
                  {open ? (
                    <div className="grid gap-4 border-t border-[var(--border)] bg-white p-4 md:grid-cols-3">
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                        <div className="font-medium">Portfolio Health</div>
                        <div className="mt-2 text-sm leading-6 text-[var(--muted)]">
                          Average Trust Score: {account.avgTrust}. Active modules: {account.modules}. Status: {account.status}.
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                        <div className="font-medium">Operations Summary</div>
                        <div className="mt-2 text-sm leading-6 text-[var(--muted)]">
                          {account.locations} enrolled location(s). Last activity {account.lastActivity}. Use support mode for customer-side actions.
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                        <div className="font-medium">Revenue Signal</div>
                        <div className="mt-2 text-sm leading-6 text-[var(--muted)]">
                          CAAR release remains gated below Trust Score 85. Prioritize schema and bank-evidence gaps for at-risk accounts.
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard>
            <div className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em]">
              Support Queue
            </div>
            <div className="space-y-3">
              {queue.map((item) => (
                <div key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{item.issue}</div>
                      <div className="mt-1 text-sm text-[var(--muted)]">
                        {item.account} · {item.age}
                      </div>
                    </div>
                    <Badge tone={item.priority === "High" ? "danger" : item.priority === "Medium" ? "warning" : "neutral"}>
                      {item.priority}
                    </Badge>
                  </div>
                  <button
                    type="button"
                    onClick={() => onResolveQueue(item.id)}
                    className="mt-3 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                  >
                    Mark Resolved
                  </button>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard>
            <div className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em]">
              Pending Approvals
            </div>
            <div className="space-y-3">
              {approvals.map((item) => (
                <div key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{item.type}</div>
                      <div className="mt-1 text-sm text-[var(--muted)]">{item.account}</div>
                      <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.summary}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onApprove(item.id)}
                      className="rounded-lg bg-[var(--text)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
                    >
                      Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em]">
            WGS User Accounts
          </div>
          <button
            type="button"
            onClick={onAddUser}
            className="rounded-lg bg-[var(--text)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
          >
            Add WGS User
          </button>
        </div>
        <div className="grid gap-3">
          {users.map((user) => (
            <div key={user.id} className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_120px]">
              <div>
                <div className="font-medium">
                  {user.firstName} {user.lastName}
                </div>
                <div className="text-sm text-[var(--muted)]">{user.email}</div>
              </div>
              <div>{user.role}</div>
              <div>{user.twoFA}</div>
              <div>{user.lastLogin}</div>
              <div className="md:text-right">
                <button
                  type="button"
                  onClick={() => onOpenUser(user)}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
