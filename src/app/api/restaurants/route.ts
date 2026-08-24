import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireManagerSession } from "@/lib/auth/session";
import { logServerError, writeAuditLog } from "@/lib/ops/audit";
import { getRequestContextFromRequest, withRequestHeaders } from "@/lib/ops/request";
import { checkRateLimits, getRetryAfterSeconds } from "@/lib/ops/rate-limit";
import prisma from "@/lib/prisma";
import { buildGeneratedUnitId } from "@/lib/restaurants/ids";
import { resolveVendorKey } from "@/components/sentry/vendor-catalog";
import { getScopedRestaurantWhere, getTeamAccountId } from "@/lib/auth/team-access";
import { ensureNormalizedLocation } from "@/lib/restaurants/normalized-location";

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
    const scopedWhere = await getScopedRestaurantWhere(session);

    const restaurants = await prisma.restaurants.findMany({
      where: {
        active: true,
        ...scopedWhere,
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      select: {
        city: true,
        country: true,
        created_by: true,
        id: true,
        location: true,
        name: true,
        state: true,
        store_id: true,
        unit_id: true,
      },
    });

    let stateRows:
      | Array<{
          account_id: string | null;
          completed: boolean | null;
          created_by: number | null;
          governance_initialized_at: Date | null;
          governance_sealed_at: Date | null;
          governance_status: string;
          ium: string | null;
          last_certified: string | null;
          location_id: string;
          m01_score: number;
          m02_score: number;
          modules_json: unknown;
          onboarding_checklist: unknown;
          onboarding_progress: unknown;
          recovery_display: string | null;
          restaurant_id: number;
          status: string;
        }>
      = [];

    if (restaurants.length) {
      try {
        stateRows = await prisma.restaurant_sentry_state.findMany({
          where: {
            restaurant_id: {
              in: restaurants.map((restaurant) => restaurant.id),
            },
          },
          select: {
            account_id: true,
            completed: true,
            created_by: true,
            governance_initialized_at: true,
            governance_sealed_at: true,
            governance_status: true,
            ium: true,
            last_certified: true,
            location_id: true,
            m01_score: true,
            m02_score: true,
            modules_json: true,
            onboarding_checklist: true,
            onboarding_progress: true,
            recovery_display: true,
            restaurant_id: true,
            status: true,
          },
        });
      } catch (error) {
        if (!isMissingSentryStateTable(error)) {
          throw error;
        }
      }
    }
    const stateByRestaurantId = new Map(
      stateRows.map((row) => [row.restaurant_id, row]),
    );

    return NextResponse.json({
      restaurants: restaurants.map((restaurant) => ({
        ...restaurant,
        sentry_state: stateByRestaurantId.get(restaurant.id) ?? null,
      })),
    });
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    console.error("Fetch restaurants failed:", error);
    return NextResponse.json(
      { error: "Unable to load restaurants right now." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const requestContext = getRequestContextFromRequest(request);
  try {
    const session = await requireManagerSession();
    if (session.role === "Viewer") {
      return withRequestHeaders(
        NextResponse.json({ error: "This account cannot create locations." }, { status: 403 }),
        requestContext,
      );
    }
    const limiter = await checkRateLimits([
      {
        failureMode: "open",
        key: `restaurant-create-identity:${session.managerId ?? session.email}`,
        limit: 20,
        windowMs: 60 * 60 * 1000,
      },
      {
        failureMode: "open",
        key: `restaurant-create-address:${requestContext.ipAddress ?? "unknown"}`,
        limit: 100,
        windowMs: 60 * 60 * 1000,
      },
    ]);
    if (!limiter.allowed) {
      const response = NextResponse.json(
        { error: "Too many location creation attempts. Try again later." },
        { status: 429 },
      );
      response.headers.set("retry-after", String(getRetryAfterSeconds(limiter)));
      return withRequestHeaders(response, requestContext);
    }

    const body = (await request.json()) as {
      accountId?: string | null;
      address?: string;
      creatorEmail?: string;
      locationName?: string;
      managerId?: number | null;
      sentryState?: {
        completed?: boolean;
        ium?: string;
        lastCertified?: string;
        locationId?: string;
        m01Score?: number;
        m02Score?: number;
        modules?: unknown;
        onboardingChecklist?: unknown;
        onboardingProgress?: unknown;
        recoveryDisplay?: string;
        status?: string;
      } | null;
      unitId?: string;
    };

    const locationName = body.locationName?.trim() ?? "";
    if (!locationName) {
      return NextResponse.json({ error: "Location name is required." }, { status: 400 });
    }

    const unitId = body.unitId?.trim() || null;
    const createdBy = typeof session.managerId === "number" ? session.managerId : null;
    const teamAccountId =
      session.role === "WGS Manager" ? null : await getTeamAccountId(session);
    const resolvedAccountId =
      session.role === "WGS Manager"
        ? body.accountId ?? null
        : teamAccountId;

    if (session.role !== "WGS Manager" && !resolvedAccountId) {
      return withRequestHeaders(
        NextResponse.json(
          {
            error:
              "A real team account is required before creating a location. Open Team & Access and set the customer team account first.",
          },
          { status: 400 },
        ),
        requestContext,
      );
    }

    if (session.role === "WGS Manager" && !resolvedAccountId) {
      return withRequestHeaders(
        NextResponse.json(
          {
            error:
              "WGS location creation requires an explicit customer account target.",
          },
          { status: 400 },
        ),
        requestContext,
      );
    }
    const existingLocationCount = await prisma.restaurants.count({
      where: {
        active: true,
        ...(typeof createdBy === "number"
          ? { created_by: createdBy }
          : body.creatorEmail?.trim()
            ? { created_by: null }
            : { id: -1 }),
      },
    });

    let onboardingProgress = body.sentryState?.onboardingProgress ?? undefined;
    const onboardingProgressRecord =
      onboardingProgress && typeof onboardingProgress === "object"
        ? (onboardingProgress as Record<string, unknown>)
        : null;
    const selectedVendors =
      onboardingProgressRecord?.selectedVendors &&
      typeof onboardingProgressRecord.selectedVendors === "object"
        ? (onboardingProgressRecord.selectedVendors as Record<string, unknown>)
        : null;
    const hasExplicitSelectedVendors =
      Boolean(selectedVendors) &&
      (normalizeStringArray(selectedVendors?.m01).length > 0 ||
        normalizeStringArray(selectedVendors?.m02).length > 0);

    if (!hasExplicitSelectedVendors && existingLocationCount === 0) {
      const requesterEmail = body.creatorEmail?.trim() || session.email.trim();
      const accessRequest = await prisma.access_requests_v2.findFirst({
        where: {
          requester_email: requesterEmail,
          status: "reviewed",
        },
        orderBy: [{ reviewed_at: "desc" }, { updated_at: "desc" }, { id: "desc" }],
        select: {
          dsps: true,
          processors: true,
        },
      });

      if (accessRequest) {
        onboardingProgress = {
          ...(onboardingProgressRecord ?? {}),
          selectedVendors: {
            m01: normalizeStringArray(accessRequest.processors).map((value) =>
              resolveVendorKey("M01", value),
            ),
            m02: normalizeStringArray(accessRequest.dsps).map((value) =>
              resolveVendorKey("M02", value),
            ),
          },
        };
      }
    }

    const createdRestaurant = await prisma.restaurants.create({
      data: {
        active: true,
        created_by: createdBy,
        location: body.address?.trim() || null,
        name: locationName,
        store_id: unitId,
        unit_id: unitId,
      },
      select: {
        id: true,
        location: true,
        name: true,
        store_id: true,
        unit_id: true,
      },
    });

    const generatedUnitId = unitId || buildGeneratedUnitId(createdRestaurant.id);
    const restaurant =
      createdRestaurant.unit_id?.trim() && createdRestaurant.store_id?.trim()
        ? createdRestaurant
        : await prisma.restaurants.update({
            where: { id: createdRestaurant.id },
            data: {
              store_id: createdRestaurant.store_id?.trim() || generatedUnitId,
              unit_id: createdRestaurant.unit_id?.trim() || generatedUnitId,
            },
            select: {
              id: true,
              location: true,
              name: true,
              store_id: true,
              unit_id: true,
            },
          });

    const locationId =
      body.sentryState?.locationId?.trim() ||
      restaurant.unit_id?.trim() ||
      restaurant.store_id?.trim() ||
      buildGeneratedUnitId(restaurant.id);

    try {
      await prisma.restaurant_sentry_state.create({
        data: {
          account_id: resolvedAccountId,
          completed: body.sentryState?.completed ?? false,
          created_by: createdBy,
          governance_initialized_at: null,
          governance_sealed_at: null,
          governance_status: "uninitialized",
          ium: body.sentryState?.ium ?? "--",
          last_certified: body.sentryState?.lastCertified ?? "Pending",
          location_id: locationId,
          m01_score: body.sentryState?.m01Score ?? 0,
          m02_score: body.sentryState?.m02Score ?? 0,
          modules_json: toNullableJsonInput(body.sentryState?.modules),
          onboarding_checklist: toNullableJsonInput(body.sentryState?.onboardingChecklist),
          onboarding_progress: toNullableJsonInput(onboardingProgress),
          recovery_display: body.sentryState?.recoveryDisplay ?? "$0",
          restaurant_id: restaurant.id,
          status: body.sentryState?.status ?? "Onboarding",
        },
      });
    } catch (error) {
      if (!isMissingSentryStateTable(error)) {
        throw error;
      }
    }

    await ensureNormalizedLocation({
      accountId: resolvedAccountId as string,
      address: restaurant.location,
      externalId: locationId,
      name: restaurant.name,
    });

    await writeAuditLog({
      action: "restaurant_created",
      actorUserId: createdBy,
      entityId: String(restaurant.id),
      entityType: "restaurants",
      ipAddress: requestContext.ipAddress,
      metadata: {
        accountId: resolvedAccountId,
        locationId,
        locationName: restaurant.name,
        requestId: requestContext.requestId,
      },
      summary: `Created restaurant ${restaurant.name}.`,
      userAgent: requestContext.userAgent,
    });

    return withRequestHeaders(NextResponse.json({
      restaurant: {
        accountId: resolvedAccountId,
        address: restaurant.location,
        id: restaurant.id,
        locationId,
        name: restaurant.name,
        unitId: restaurant.unit_id,
      },
    }), requestContext);
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return withRequestHeaders(authResponse, requestContext);
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return withRequestHeaders(NextResponse.json(
        { error: "A restaurant with that internal location ID already exists." },
        { status: 409 },
      ), requestContext);
    }

    logServerError("restaurant_create_failed", error, {
      requestId: requestContext.requestId,
    });
    return withRequestHeaders(NextResponse.json(
      { error: "Unable to create restaurant right now." },
      { status: 500 },
    ), requestContext);
  }
}
