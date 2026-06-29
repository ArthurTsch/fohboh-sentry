import { NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getManagerSession();
  return NextResponse.json({ session });
}
