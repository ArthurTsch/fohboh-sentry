import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireManagerSession } from "@/lib/auth/session";
import { getScopedRestaurantWhere, getTeamAccountId } from "@/lib/auth/team-access";
import prisma from "@/lib/prisma";

const ALLOWED_PAYLOAD_KEYS = new Set([
  "locationId",
  "modules",
  "onboardingChecklist",
  "onboardingProgress",
  "restaurantId",
  "storeId",
  "unitId",
]);

type LocationStatePayload = {
  locationId?: string;
  modules?: unknown;
  onboardingChecklist?: unknown;
  onboardingProgress?: unknown;
  restaurantId?: number;
  storeId?: string;
  unitId?: string;
};

function isMissingSentryStateTable(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2021" &&
    "meta" in error &&
    typeof error.meta === "object" &&
    error.meta !== null &&
    "modelName" in error.meta &&
    error.meta.modelName === "restaurant_sentry_state"
  );
}

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

function toNullableJsonInput(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

function isJsonObjectOrNull(value: unknown) {
  return value === null || (typeof value === "object" && !Array.isArray(value));
}

export async function POST(request: Request) {
  try {
    const session = await requireManagerSession();
    if (session.role === "Viewer") {
      return NextResponse.json(
        { error: "This account cannot update location state." },
        { status: 403 },
      );
    }

    const rawBody = (await request.json()) as unknown;
    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      return NextResponse.json({ error: "A valid location-state payload is required." }, { status: 400 });
    }
    const unknownKeys = Object.keys(rawBody).filter((key) => !ALLOWED_PAYLOAD_KEYS.has(key));
    if (unknownKeys.length > 0) {
      return NextResponse.json(
        { error: `Unsupported location-state fields: ${unknownKeys.join(", ")}.` },
        { status: 400 },
      );
    }
    const body = rawBody as LocationStatePayload;
    if (
      (body.modules !== undefined && !Array.isArray(body.modules)) ||
      (body.onboardingChecklist !== undefined && !isJsonObjectOrNull(body.onboardingChecklist)) ||
      (body.onboardingProgress !== undefined && !isJsonObjectOrNull(body.onboardingProgress))
    ) {
      return NextResponse.json(
        { error: "Location-state onboarding fields have an invalid shape." },
        { status: 400 },
      );
    }
    const locationId = body.locationId?.trim() || null;
    const unitId = body.unitId?.trim() || null;
    const storeId = body.storeId?.trim() || null;
    const restaurantId =
      typeof body.restaurantId === "number" && Number.isInteger(body.restaurantId) && body.restaurantId > 0
        ? body.restaurantId
        : null;

    if (!locationId && !unitId && !storeId && !restaurantId) {
      return NextResponse.json({ error: "A restaurant or location identifier is required." }, { status: 400 });
    }

    const stateByLocation = locationId
      ? await prisma.restaurant_sentry_state.findUnique({
          where: { location_id: locationId },
          select: {
            account_id: true,
            created_by: true,
            location_id: true,
            m01_score: true,
            m02_score: true,
            restaurant_id: true,
            status: true,
          },
        })
      : null;
    const scopedWhere = await getScopedRestaurantWhere(session);
    const targetIds = [restaurantId, stateByLocation?.restaurant_id ?? null].filter(
      (value): value is number => typeof value === "number",
    );
    const selectors = [
      ...targetIds.map((id) => ({ id })),
      ...(unitId ? [{ unit_id: unitId }] : []),
      ...(storeId ? [{ store_id: storeId }] : []),
      ...(locationId ? [{ unit_id: locationId }, { store_id: locationId }] : []),
    ];
    const restaurant = await prisma.restaurants.findFirst({
      where: { active: true, ...scopedWhere, OR: selectors },
      select: { created_by: true, id: true, store_id: true, unit_id: true },
    });

    if (
      !restaurant ||
      (restaurantId !== null && restaurant.id !== restaurantId) ||
      (stateByLocation && stateByLocation.restaurant_id !== restaurant.id) ||
      (unitId !== null && restaurant.unit_id !== unitId) ||
      (storeId !== null && restaurant.store_id !== storeId)
    ) {
      return NextResponse.json(
        { error: "Location state was not found within the authorized restaurant scope." },
        { status: 404 },
      );
    }

    const existingState = stateByLocation?.restaurant_id === restaurant.id
      ? stateByLocation
      : await prisma.restaurant_sentry_state.findUnique({
          where: { restaurant_id: restaurant.id },
          select: {
            account_id: true,
            created_by: true,
            location_id: true,
            m01_score: true,
            m02_score: true,
            restaurant_id: true,
            status: true,
          },
        });
    const accountId = existingState?.account_id ?? await getTeamAccountId(session);
    if (!accountId) {
      return NextResponse.json(
        { error: "The authorized restaurant is missing its server-managed account assignment." },
        { status: 409 },
      );
    }
    const canonicalLocationId =
      existingState?.location_id || restaurant.unit_id || restaurant.store_id || `LOC-DB-${restaurant.id}`;
    const onboardingCompleted =
      body.onboardingProgress !== null &&
      typeof body.onboardingProgress === "object" &&
      "completed" in body.onboardingProgress &&
      body.onboardingProgress.completed === true;
    const completedStatus =
      existingState?.status === "Certified" ||
      Math.round(((existingState?.m01_score ?? 0) + (existingState?.m02_score ?? 0)) / 2) >= 85
        ? "Certified"
        : "At Risk";

    const state = await prisma.restaurant_sentry_state.upsert({
      where: {
        restaurant_id: restaurant.id,
      },
      update: {
        modules_json: toNullableJsonInput(body.modules),
        onboarding_checklist: toNullableJsonInput(body.onboardingChecklist),
        onboarding_progress: toNullableJsonInput(body.onboardingProgress),
        ...(onboardingCompleted ? { status: completedStatus } : {}),
        updated_at: new Date(),
      },
      create: {
        account_id: accountId,
        created_by: existingState?.created_by ?? restaurant.created_by ?? session.managerId ?? null,
        location_id: canonicalLocationId,
        modules_json: toNullableJsonInput(body.modules),
        onboarding_checklist: toNullableJsonInput(body.onboardingChecklist),
        onboarding_progress: toNullableJsonInput(body.onboardingProgress),
        restaurant_id: restaurant.id,
        status: onboardingCompleted ? completedStatus : "Onboarding",
      },
      select: {
        id: true,
        location_id: true,
        restaurant_id: true,
      },
    });

    return NextResponse.json({ ok: true, state });
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (isMissingSentryStateTable(error)) {
      return NextResponse.json(
        {
          error:
            "The restaurant_sentry_state table has not been created yet. Apply the database SQL migration first.",
        },
        { status: 503 },
      );
    }

    console.error("Save location state failed:", error);
    return NextResponse.json(
      { error: "Unable to save the location state right now." },
      { status: 500 },
    );
  }
}
