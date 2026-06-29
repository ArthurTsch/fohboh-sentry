import { NextResponse } from "next/server";
import { MANAGER_SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(MANAGER_SESSION_COOKIE_NAME);
  return response;
}

