import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { SessionState } from "@/components/sentry/types";

export const MANAGER_SESSION_COOKIE_NAME = "sentry-manager-session";

const SESSION_TTL_SECONDS = 60 * 60 * 8;
const DEV_FALLBACK_SECRET = "dev-only-sentry-session-secret-change-me";

type SessionPayload = SessionState & {
  exp: number;
};

function getSessionSecret() {
  const secret = process.env.SENTRY_SESSION_SECRET?.trim() || process.env.AUTH_SECRET?.trim();

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SENTRY_SESSION_SECRET or AUTH_SECRET must be set in production.");
  }

  return DEV_FALLBACK_SECRET;
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function encodePayload(session: SessionState) {
  const payload: SessionPayload = {
    ...session,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };

  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(value: string): SessionPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as SessionPayload;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.email !== "string" ||
      typeof parsed.role !== "string" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function createSessionCookieValue(session: SessionState) {
  const payload = encodePayload(session);
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function parseSessionCookieValue(rawValue: string | undefined) {
  if (!rawValue) return null;

  const [payload, signature] = rawValue.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const provided = Buffer.from(signature);

  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return null;
  }

  const parsed = decodePayload(payload);
  if (!parsed) return null;

  if (parsed.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  const { exp, ...session } = parsed;
  void exp;
  return session;
}

export async function getManagerSession() {
  const cookieStore = await cookies();
  return parseSessionCookieValue(cookieStore.get(MANAGER_SESSION_COOKIE_NAME)?.value);
}

export async function requireManagerSession() {
  const session = await getManagerSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  return session;
}

export async function requireAdminManagerSession() {
  const session = await requireManagerSession();

  if (session.role !== "Admin") {
    throw new Error("Forbidden");
  }

  return session;
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
