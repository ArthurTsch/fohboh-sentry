import { NextResponse } from "next/server";
import { authenticateManager } from "@/lib/auth/manager-auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const result = await authenticateManager(body.email ?? "", body.password ?? "");

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ session: result.session });
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json(
      { error: "Unable to complete login right now." },
      { status: 500 },
    );
  }
}
