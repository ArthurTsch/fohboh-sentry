import { useState } from "react";
import type { WgsAccount, WgsUser } from "../types";
import { AccessibleDialog } from "../ui/AccessibleDialog";

function createEmptyUser(): WgsUser {
  return {
    id: "new",
    firstName: "",
    lastName: "",
    email: "",
    role: "Advisor",
    status: "Active",
    twoFA: "None",
    customers: [],
    lastLogin: "—",
  };
}

export function WgsUserModal({
  accounts,
  onClose,
  onDeactivate,
  onSave,
  onSendReset,
  user,
}: {
  accounts: WgsAccount[];
  onClose: () => void;
  onDeactivate: (userId: string) => void;
  onSave: (user: WgsUser) => void;
  onSendReset: (userId: string, email: string) => void;
  user: WgsUser | null;
}) {
  const isNew = !user;
  const [draft, setDraft] = useState<WgsUser>(user ?? createEmptyUser());
  const valid = draft.firstName.trim() && draft.lastName.trim() && draft.email.endsWith("@fohboh.ai");

  function toggleCustomer(accountName: string) {
    setDraft((current) => {
      const customers = current.customers.includes(accountName)
        ? current.customers.filter((item) => item !== accountName)
        : [...current.customers, accountName];
      return { ...current, customers };
    });
  }

  return (
    <AccessibleDialog ariaLabel={isNew ? "Create WGS user" : "Edit WGS user"} closeOnEscape={false} onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-[var(--border)] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
          <div>
            <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
              {isNew ? "Add WGS User" : "Edit WGS User"}
            </div>
            <div className="mt-1 text-sm text-[var(--muted)]">
              {isNew
                ? "New WGS staff account. Setup email is sent when the user is created."
                : "Update role, assignments, or lifecycle actions for the selected staff account."}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
          >
            Close
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium">First name</span>
              <input
                value={draft.firstName}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, firstName: event.target.value }))
                }
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
                placeholder="Sarah"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium">Last name</span>
              <input
                value={draft.lastName}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, lastName: event.target.value }))
                }
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
                placeholder="Chen"
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-medium">FohBoh email</span>
            <input
              type="email"
              value={draft.email}
              onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
              placeholder="name@fohboh.ai"
            />
            <span className="text-xs text-[var(--muted)]">
              Must use the `@fohboh.ai` domain. New users receive a setup link after save.
            </span>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium">Role</span>
              <select
                value={draft.role}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    role: event.target.value as WgsUser["role"],
                  }))
                }
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
              >
                <option>Advisor</option>
                <option>WGS Manager</option>
                <option>Super Admin</option>
                <option>Analyst</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium">Two-factor authentication</span>
              <select
                value={draft.twoFA}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    twoFA: event.target.value as WgsUser["twoFA"],
                  }))
                }
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
              >
                <option>None</option>
                <option>SMS</option>
                <option>Authenticator</option>
                <option>Hardware Key</option>
              </select>
            </label>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium">Assigned customers</span>
            <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
              {accounts.map((account) => {
                const checked =
                  draft.role === "Super Admin" || draft.customers.includes(account.name);
                return (
                  <label
                    key={account.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${
                      checked
                        ? "border-[rgba(214,48,49,0.24)] bg-[rgba(214,48,49,0.08)] text-[var(--accent)]"
                        : "border-[var(--border)] bg-white text-[var(--muted)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={draft.role === "Super Admin"}
                      onChange={() => toggleCustomer(account.name)}
                      className="accent-[var(--accent)]"
                    />
                    {account.name}
                  </label>
                );
              })}
            </div>
            <span className="text-xs text-[var(--muted)]">
              Super Admins implicitly have access to every customer.
            </span>
          </div>

          {!isNew ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[rgba(214,48,49,0.18)] bg-[rgba(214,48,49,0.04)] p-4">
                <div>
                  <div className="font-medium">Password reset</div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    Send a reset link to {draft.email}. The link expires in 2 hours.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSendReset(draft.id, draft.email)}
                  className="rounded-lg border border-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white"
                >
                  Send Reset Link
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div>
                  <div className="font-medium">Deactivate account</div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    Immediately revoke portal access for this user.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDeactivate(draft.id)}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                >
                  Deactivate
                </button>
              </div>
            </>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface)] px-6 py-5">
          <div className="text-xs text-[var(--muted)]">
            {isNew ? "Setup link expires after 24 hours." : `Last login: ${draft.lastLogin}`}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!valid}
              onClick={() =>
                onSave({
                  ...draft,
                  customers: draft.role === "Super Admin" ? ["All"] : draft.customers,
                })
              }
              className="rounded-lg bg-[var(--text)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)] disabled:opacity-50"
            >
              {isNew ? "Create & Send Setup Email" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </AccessibleDialog>
  );
}
