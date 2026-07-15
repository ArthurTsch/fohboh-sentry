"use client";

import { useEffect, useState } from "react";
import { PasswordField } from "../ui/PasswordField";
import type { SessionState } from "../types";
import { getInitials } from "../utils";

type NotificationPreferences = {
  accessChanges: boolean;
  caarCertified: boolean;
  statementDue: boolean;
  trustScoreBlocked: boolean;
  weeklyDigest: boolean;
};

type ProfilePayload = {
  accountId: string | null;
  email: string;
  fullName: string;
  notifications: NotificationPreferences;
  phoneNumber: string;
  role: string;
  title: string;
  twoFactorEnabled: boolean;
  twoFactorMethod: string;
};

const inputClassName =
  "w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--text)]";

export function ProfileView({
  session,
  visibleLocationCount,
}: {
  session: SessionState;
  visibleLocationCount: number;
}) {
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    confirmPassword: "",
    currentPassword: "",
    newPassword: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const response = await fetch("/api/profile", {
          credentials: "include",
        });
        const payload = (await response.json()) as { error?: string; profile?: ProfilePayload };
        if (!response.ok || !payload.profile) {
          throw new Error(payload.error ?? "Unable to load profile.");
        }
        if (!cancelled) {
          setProfile(payload.profile);
        }
      } catch (error) {
        if (!cancelled) {
          setProfileError(error instanceof Error ? error.message : "Unable to load profile.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = profile?.fullName?.trim() || session.name?.trim() || session.email;

  async function saveProfile() {
    if (!profile) return;
    setSavingProfile(true);
    setProfileMessage(null);
    setProfileError(null);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: profile.email,
          fullName: profile.fullName,
          notifications: profile.notifications,
          phoneNumber: profile.phoneNumber,
          title: profile.title,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save profile settings.");
      }
      setProfileMessage("Profile and notification settings saved.");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Unable to save profile settings.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function updatePassword() {
    setSavingPassword(true);
    setPasswordMessage(null);
    setPasswordError(null);

    try {
      const response = await fetch("/api/profile/password", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(passwordForm),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update password.");
      }
      setPasswordForm({
        confirmPassword: "",
        currentPassword: "",
        newPassword: "",
      });
      setPasswordMessage("Password updated.");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Unable to update password.");
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading || !profile) {
    return (
      <div className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <div className="text-sm text-[var(--muted)]">Loading account settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--text)] text-xl font-bold text-white">
            {getInitials(displayName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.04em] text-[var(--text)]">
              Account Settings
            </div>
            <div className="mt-2 text-sm leading-7 text-[var(--muted)]">
              Your profile, password, and notification preferences. Signed in as {displayName} · {profile.role}.
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <ProfileStatCard label="Role" value={profile.role} />
        <ProfileStatCard label="Account Scope" value={profile.accountId ?? "Global / WGS"} />
        <ProfileStatCard label="Visible Locations" value={String(visibleLocationCount)} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
            Profile
          </div>
          <div className="mt-6 grid gap-4">
            <Field label="Full name">
              <input
                className={inputClassName}
                value={profile.fullName}
                onChange={(event) => setProfile((current) => current ? { ...current, fullName: event.target.value } : current)}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                className={inputClassName}
                value={profile.email}
                onChange={(event) => setProfile((current) => current ? { ...current, email: event.target.value } : current)}
              />
            </Field>
            <Field label="Phone">
              <input
                className={inputClassName}
                value={profile.phoneNumber}
                onChange={(event) => setProfile((current) => current ? { ...current, phoneNumber: event.target.value } : current)}
              />
            </Field>
            <Field label="Title">
              <input
                className={inputClassName}
                value={profile.title}
                onChange={(event) => setProfile((current) => current ? { ...current, title: event.target.value } : current)}
              />
            </Field>
          </div>

          {profileError ? <Notice tone="error">{profileError}</Notice> : null}
          {profileMessage ? <Notice tone="success">{profileMessage}</Notice> : null}

          <button
            type="button"
            onClick={() => void saveProfile()}
            disabled={savingProfile}
            className="mt-6 rounded-xl bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)] disabled:opacity-60"
          >
            {savingProfile ? "Saving..." : "Save profile"}
          </button>
        </section>

        <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
            Password & security
          </div>
          <div className="mt-6 grid gap-4">
            <Field label="Current password">
              <PasswordField
                className={inputClassName}
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))
                }
              />
            </Field>
            <Field label="New password">
              <PasswordField
                className={inputClassName}
                autoComplete="new-password"
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))
                }
              />
            </Field>
            <Field label="Confirm new password">
              <PasswordField
                className={inputClassName}
                autoComplete="new-password"
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))
                }
              />
            </Field>
          </div>

          {passwordError ? <Notice tone="error">{passwordError}</Notice> : null}
          {passwordMessage ? <Notice tone="success">{passwordMessage}</Notice> : null}

          <button
            type="button"
            onClick={() => void updatePassword()}
            disabled={savingPassword}
            className="mt-6 rounded-xl bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)] disabled:opacity-60"
          >
            {savingPassword ? "Updating..." : "Update password"}
          </button>

          <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-[var(--text)]">Two-factor authentication</div>
                <div className="mt-1 text-sm text-[var(--muted)]">
                  Database support is ready. Activation flow will be enabled in a later release.
                </div>
              </div>
              <div className="rounded-full border border-[var(--border)] bg-white px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                {profile.twoFactorEnabled ? profile.twoFactorMethod : "Not enabled"}
              </div>
            </div>
            <button
              type="button"
              disabled
              className="mt-4 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-medium text-[var(--muted)] opacity-70"
            >
              Enable 2FA (Coming soon)
            </button>
          </div>
        </section>
      </div>

      <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
          Notification preferences
        </div>
        <div className="mt-5 space-y-3">
          <ToggleRow
            checked={profile.notifications.caarCertified}
            label="Email me when a CAAR certifies"
            onChange={(checked) =>
              setProfile((current) =>
                current
                  ? { ...current, notifications: { ...current.notifications, caarCertified: checked } }
                  : current,
              )
            }
          />
          <ToggleRow
            checked={profile.notifications.trustScoreBlocked}
            label="Email me when a location's Trust Score drops below 85 (blocked)"
            onChange={(checked) =>
              setProfile((current) =>
                current
                  ? { ...current, notifications: { ...current.notifications, trustScoreBlocked: checked } }
                  : current,
              )
            }
          />
          <ToggleRow
            checked={profile.notifications.statementDue}
            label="Email me when a statement is due"
            onChange={(checked) =>
              setProfile((current) =>
                current
                  ? { ...current, notifications: { ...current.notifications, statementDue: checked } }
                  : current,
              )
            }
          />
          <ToggleRow
            checked={profile.notifications.weeklyDigest}
            label="Weekly summary digest, every Monday"
            onChange={(checked) =>
              setProfile((current) =>
                current
                  ? { ...current, notifications: { ...current.notifications, weeklyDigest: checked } }
                  : current,
              )
            }
          />
          <ToggleRow
            checked={profile.notifications.accessChanges}
            label="Email me when a teammate is invited or access is revoked"
            onChange={(checked) =>
              setProfile((current) =>
                current
                  ? { ...current, notifications: { ...current.notifications, accessChanges: checked } }
                  : current,
              )
            }
          />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => void saveProfile()}
            disabled={savingProfile}
            className="rounded-xl bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)] disabled:opacity-60"
          >
            {savingProfile ? "Saving..." : "Save preferences"}
          </button>
          <div className="text-sm text-[var(--muted)]">
            Changes to profile, password, and 2FA state are written to the Activity Log.
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function ToggleRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm text-[var(--text)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-[var(--border)]"
      />
      <span>{label}</span>
    </label>
  );
}

function Notice({
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

function ProfileStatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-[var(--border)] bg-white p-5 shadow-[0_14px_40px_rgba(0,0,0,0.05)]">
      <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-3 text-lg font-semibold tracking-[-0.03em] text-[var(--text)]">{value}</div>
    </div>
  );
}
