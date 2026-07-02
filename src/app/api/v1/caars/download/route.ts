import { NextResponse } from "next/server";
import { requireManagerSession } from "@/lib/auth/session";
import { getScopedPersistedCaar } from "@/lib/caar/access";
import { readArtifactBlob } from "@/lib/uploads/storage";

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

const ARTIFACT_CONFIG = {
  canonical: {
    contentType: "application/json; charset=utf-8",
    field: "canonical_payload_s3_key",
    suffix: "canonical-payload.json",
  },
  exportpack: {
    contentType: "application/zip",
    field: "exportpack_s3_key",
    suffix: "ExportPack.zip",
  },
  pdf: {
    contentType: "application/pdf",
    field: "pdf_s3_key",
    suffix: "caar-report.pdf",
  },
} as const;

export async function GET(request: Request) {
  try {
    const session = await requireManagerSession();
    const { searchParams } = new URL(request.url);
    const caarId = searchParams.get("caarId")?.trim() ?? "";
    const artifact = (searchParams.get("artifact")?.trim() ?? "pdf") as keyof typeof ARTIFACT_CONFIG;

    if (!caarId) {
      return NextResponse.json({ error: "caarId is required." }, { status: 400 });
    }

    if (!(artifact in ARTIFACT_CONFIG)) {
      return NextResponse.json({ error: "Unsupported artifact type." }, { status: 400 });
    }

    const scoped = await getScopedPersistedCaar(session, caarId);
    if (!scoped) {
      return NextResponse.json({ error: "CAAR not found." }, { status: 404 });
    }

    const config = ARTIFACT_CONFIG[artifact];
    const objectKey = scoped.caar[config.field];
    if (!objectKey) {
      return NextResponse.json({ error: "Requested artifact has not been generated yet." }, { status: 404 });
    }

    const buffer = await readArtifactBlob(objectKey);
    return new NextResponse(buffer, {
      headers: {
        "Content-Disposition": `attachment; filename="${caarId}-${config.suffix}"`,
        "Content-Type": config.contentType,
      },
    });
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    console.error("Download CAAR artifact failed:", error);
    return NextResponse.json(
      { error: "Unable to download the requested artifact right now." },
      { status: 500 },
    );
  }
}
