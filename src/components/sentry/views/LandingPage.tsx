import { useState } from "react";
import { moduleSummaries } from "../data";
import type { SessionState } from "../types";
import { PasswordField } from "../ui/PasswordField";
import { KpiCard } from "../ui/primitives";

export function LandingPage({
  onLogin,
  onRequestAccess,
}: {
  onLogin: (session: SessionState) => void;
  onRequestAccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Email is required.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        session?: SessionState;
      };

      if (!response.ok || !payload.session) {
        setError(payload.error ?? "Unable to sign in.");
        return;
      }

      onLogin(payload.session);
    } catch {
      setError("Unable to sign in right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--surface)] text-[var(--text)]">
      <div className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3 font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em]">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
            <span>FohBoh</span>
            <span className="text-[var(--muted)]">|</span>
            <span className="italic text-[var(--accent)]">Sentry</span>
          </div>
          <div className="hidden items-center gap-8 text-sm text-[var(--muted)] md:flex">
            <span>Platform</span>
            <span>Modules</span>
            <span>Pricing</span>
            <span>About</span>
            <button
              type="button"
              onClick={onRequestAccess}
              className="rounded-lg bg-[var(--text)] px-4 py-2 font-medium text-white transition hover:bg-[var(--accent)]"
            >
              Request Access
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:py-20">
        <section className="animate-[fadeUp_0.5s_ease-out]">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[rgba(214,48,49,0.18)] bg-[rgba(214,48,49,0.06)] px-3 py-1 font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            Restaurant Revenue Recovery Certification
          </div>
          <div className="mb-2 font-[family-name:var(--font-display)] text-5xl font-extrabold tracking-[-0.05em] md:text-6xl">
            FohBoh.ai
          </div>
          <h1 className="max-w-3xl font-[family-name:var(--font-display)] text-4xl font-bold leading-[1.05] tracking-[-0.05em] md:text-5xl">
            Every overcharge is <span className="text-[var(--accent)]">certified evidence</span>{" "}
            before it&apos;s a claim.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
            FohBoh Sentry certifies delivery and processor fee overcharges using deterministic
            rules, sealed evidence chains, and CAAR-ready output for recovery operations.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <KpiCard label="Certified This Week" value="$148K" sub="Current production portfolio" accent />
            <KpiCard label="M02 Trust Score" value="91" sub="Release-grade location sample" />
            <KpiCard label="Deterministic Rules" value="198" sub="Governed recovery rules" />
          </div>

          <div className="mt-10 space-y-3">
            {moduleSummaries.map((module) => (
              <details
                key={module.id}
                className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-white"
              >
                <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4">
                  <span className="text-lg">{module.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium">
                      {module.id} - {module.name}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] font-bold tracking-[0.14em] ${
                      module.status === "ACTIVE"
                        ? "border border-[rgba(0,200,83,0.2)] bg-[rgba(0,200,83,0.08)] text-[var(--success)]"
                        : "border border-[rgba(255,152,0,0.2)] bg-[rgba(255,152,0,0.08)] text-[#b86a00]"
                    }`}
                  >
                    {module.status}
                  </span>
                </summary>
                <div className="border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--muted)]">
                  <div className="mb-2 italic text-[var(--text)]">{module.summary}</div>
                  <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">
                    Trust Score {module.trustScore} · {module.rules} rules
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>

        <aside className="rounded-[28px] border border-[var(--border)] bg-white p-8 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
            Sign in to Sentry
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Access your certified recovery portal</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
                placeholder="name@company.com"
              />
            </label>
            <label className="block">
              <span className="mb-2 block font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                Password
              </span>
              <PasswordField
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
                placeholder="Enter your password"
              />
            </label>
            <div className="text-xs text-[var(--muted)]">
              Manager access is verified against the live account directory.
            </div>
            {error ? <div className="text-sm text-[var(--accent)]">{error}</div> : null}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
            >
              {isSubmitting ? "Signing In..." : "Sign In"}
            </button>
          </form>
        </aside>
      </div>

      <div className="border-t border-black/5 bg-[var(--text)] px-6 py-4 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-white/70">
          <span>
            <strong className="text-white">198</strong> governance rules
          </span>
          <span className="h-4 w-px bg-white/15" />
          <span>
            <strong className="text-white">85+</strong> Trust Score for CAAR
          </span>
          <span className="h-4 w-px bg-white/15" />
          <span>
            <strong className="text-white">9</strong> ExportPack components
          </span>
          <span className="h-4 w-px bg-white/15" />
          <span>
            <strong className="text-white">$0</strong> until recovery
          </span>
        </div>
      </div>
    </div>
  );
}
