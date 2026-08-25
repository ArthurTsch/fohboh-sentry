import { NextResponse } from "next/server";
import type { SessionState } from "@/components/sentry/types";
import { requireManagerSession } from "@/lib/auth/session";
import { getScopedRestaurantWhere } from "@/lib/auth/team-access";
import prisma from "@/lib/prisma";
import { extractPdfText } from "@/lib/uploads/pdf";
import { buildScopedUploadLookup } from "@/lib/uploads/scoped-upload-lookup";
import { readUploadBlob } from "@/lib/uploads/storage";

type ScopedRestaurant = {
  id: number;
  location_id: string;
  name: string;
  normalized_location_id: number | null;
};

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

function isMissingUploadSchema(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

async function getScopedRestaurants(session: SessionState) {
  const scopedWhere = await getScopedRestaurantWhere(session);
  const restaurants = await prisma.restaurants.findMany({
    where: {
      active: true,
      ...scopedWhere,
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    select: {
      id: true,
      name: true,
      store_id: true,
      unit_id: true,
    },
  });

  let stateRows: Array<{ account_id: string | null; location_id: string; restaurant_id: number }> = [];

  try {
    if (restaurants.length > 0) {
      stateRows = await prisma.restaurant_sentry_state.findMany({
        where: {
          restaurant_id: {
            in: restaurants.map((restaurant) => restaurant.id),
          },
        },
        select: {
          account_id: true,
          location_id: true,
          restaurant_id: true,
        },
      });
    }
  } catch (error) {
    if (
      !(
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2021"
      )
    ) {
      throw error;
    }
  }

  const stateByRestaurantId = new Map(stateRows.map((row) => [row.restaurant_id, row]));

  const locationRows = stateRows.length > 0
    ? await prisma.locations_v2.findMany({
        where: {
          OR: stateRows.flatMap((state) => state.account_id
            ? [{ external_id: state.location_id, customers: { account_id: state.account_id } }]
            : []),
        },
        select: { customers: { select: { account_id: true } }, external_id: true, id: true },
      })
    : [];
  const normalizedByAccountAndExternalId = new Map(locationRows.map((location) => [
    `${location.customers.account_id ?? ""}:${location.external_id}`,
    location.id,
  ]));

  return restaurants.map<ScopedRestaurant>((restaurant) => {
    const state = stateByRestaurantId.get(restaurant.id);
    const accountId = state?.account_id ?? null;
    const locationId = state?.location_id?.trim() ||
      restaurant.unit_id?.trim() ||
      restaurant.store_id?.trim() ||
      `LOC-DB-${restaurant.id}`;
    return {
      id: restaurant.id,
      location_id: locationId,
      name: restaurant.name,
      normalized_location_id: accountId
        ? normalizedByAccountAndExternalId.get(`${accountId}:${locationId}`) ?? null
        : null,
    };
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ uploadId: string }> },
) {
  try {
    const session = await requireManagerSession();
    const { uploadId } = await context.params;
    const parsedUploadId = Number.parseInt(uploadId, 10);

    if (!Number.isFinite(parsedUploadId) || parsedUploadId <= 0) {
      return NextResponse.json({ error: "Invalid upload id." }, { status: 400 });
    }

    const restaurants = await getScopedRestaurants(session);
    const normalizedLocationIds = restaurants.flatMap((restaurant) =>
      restaurant.normalized_location_id ? [restaurant.normalized_location_id] : [],
    );

    if (normalizedLocationIds.length === 0) {
      return NextResponse.json({ error: "Upload not found." }, { status: 404 });
    }

    const upload = await prisma.uploads_v2.findFirst({
      where: buildScopedUploadLookup(parsedUploadId, normalizedLocationIds),
      select: {
        artifact_key: true,
        file_name: true,
        id: true,
        location_id: true,
        module: true,
        s3_key: true,
      },
    });

    if (!upload) {
      return NextResponse.json({ error: "Upload not found." }, { status: 404 });
    }

    if (!upload.file_name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "This viewer is available only for PDF uploads." }, { status: 400 });
    }

    const restaurant = restaurants.find((entry) => entry.normalized_location_id === upload.location_id);
    const buffer = await readUploadBlob(upload.s3_key);
    const text = await extractPdfText(buffer);

    return NextResponse.json({
      artifactKey: upload.artifact_key,
      fileName: upload.file_name,
      hasText: text.trim().length > 0,
      lineCount: text.trim().length > 0 ? text.split(/\r?\n/).length : 0,
      locationId: restaurant?.location_id ?? `LOC-DB-${upload.location_id}`,
      locationName: restaurant?.name ?? "Unknown location",
      moduleId: upload.module as "M01" | "M02",
      text,
      uploadId: upload.id,
    });
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (isMissingUploadSchema(error)) {
      return NextResponse.json(
        {
          error:
            "The uploads_v2 Phase 3 migration has not been applied yet. Update the database before using persisted uploads.",
        },
        { status: 503 },
      );
    }

    console.error("Fetch extracted pdf text failed:", error);
    return NextResponse.json(
      { error: "Unable to load extracted PDF text right now." },
      { status: 500 },
    );
  }
}
