import { createHash, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE_NAME = "sentry-admin-session";
const ADMIN_PASSWORD = "FohbohSentry2026!";

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

const ADMIN_SESSION_VALUE = digest(`sentry-admin:${ADMIN_PASSWORD}`);

export function verifyAdminPassword(password: string) {
  const provided = Buffer.from(digest(`sentry-admin:${password}`));
  const expected = Buffer.from(ADMIN_SESSION_VALUE);

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}

export function getAdminSessionValue() {
  return ADMIN_SESSION_VALUE;
}
