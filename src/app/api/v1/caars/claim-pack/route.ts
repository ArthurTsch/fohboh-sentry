import { NextResponse } from "next/server";
import { requireManagerSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { generateClaimPackForCaar } from "@/lib/caar/persistence";
import { getScopedPersistedCaar } from "@/lib/caar/access";

function getAuthErrorResponse(error: unknown) {
  if (!(error instanceof Error)) return null;
  if (error.message === "Unauthorized") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (error.message === "Forbidden") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  return null;
}

function isMissingCaarSchema(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

export async function POST(request: Request) {
  try {
    const session = await requireManagerSession();
    if (session.role === "Viewer") {
      return NextResponse.json(
        { error: "This account cannot generate claim packs." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as { caarId?: string | null };
    const caarId = body.caarId?.trim() ?? "";
    if (!caarId) {
      return NextResponse.json({ error: "caarId is required." }, { status: 400 });
    }

    const scoped = await getScopedPersistedCaar(session, caarId);
    if (!scoped) {
      return NextResponse.json({ error: "CAAR not found." }, { status: 404 });
    }

    const result = await prisma.$transaction((tx) =>
      generateClaimPackForCaar(tx, {
        caarExternalId: caarId,
        customerId: scoped.location.customer_id,
        locationId: scoped.location.id,
      }),
    );

    return NextResponse.json({
      ok: true,
      downloadUrl: `/api/v1/caars/download?caarId=${encodeURIComponent(caarId)}&artifact=exportpack`,
      objectKey: result.objectKey,
    });
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof Error) {
      if (
        error.message === "CAAR not found." ||
        error.message.includes("court-admissible")
      ) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
    }

    if (isMissingCaarSchema(error)) {
      return NextResponse.json(
        {
          error:
            "The CAAR persistence tables are not available yet. Apply the production migrations before generating claim packs.",
        },
        { status: 503 },
      );
    }

    console.error("Generate claim pack failed:", error);
    return NextResponse.json(
      { error: "Unable to generate the claim pack right now." },
      { status: 500 },
    );
  }
}
