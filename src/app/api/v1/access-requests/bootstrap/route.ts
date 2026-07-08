import { NextResponse } from "next/server";
import { requireManagerSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { resolveVendorName } from "@/components/sentry/vendor-catalog";

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export async function GET() {
  try {
    const session = await requireManagerSession();

    const request = await prisma.access_requests_v2.findFirst({
      where: {
        requester_email: session.email.trim(),
        status: "reviewed",
      },
      orderBy: [{ reviewed_at: "desc" }, { updated_at: "desc" }, { id: "desc" }],
      select: {
        dsps: true,
        module_plan: true,
        modules: true,
        processors: true,
      },
    });

    if (!request) {
      return NextResponse.json({ request: null });
    }

    const processors = normalizeStringArray(request.processors).map((value) =>
      resolveVendorName("M01", value),
    );
    const dsps = normalizeStringArray(request.dsps).map((value) =>
      resolveVendorName("M02", value),
    );
    const modules = normalizeStringArray(request.modules);
    const moduleSet = new Set(modules);

    return NextResponse.json({
      request: {
        dsps,
        m01: moduleSet.size === 0 ? request.module_plan !== "m02" : moduleSet.has("M01"),
        m02: moduleSet.size === 0 ? request.module_plan !== "m01" : moduleSet.has("M02"),
        processor: processors[0] ?? "",
        processors,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Unable to load access request bootstrap data right now." },
      { status: 500 },
    );
  }
}
