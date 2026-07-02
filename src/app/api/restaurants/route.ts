import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireManagerSession } from "@/lib/auth/session";
import { logServerError, writeAuditLog } from "@/lib/ops/audit";
import { getRequestContextFromRequest, withRequestHeaders } from "@/lib/ops/request";
import { checkRateLimit } from "@/lib/ops/rate-limit";
import prisma from "@/lib/prisma";

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

export async function GET() {
  try {
    const session = await requireManagerSession();

    const restaurants = await prisma.restaurants.findMany({
      where: {
        active: true,
        ...(session.role === "WGS Manager"
          ? {}
          : typeof session.managerId === "number"
            ? { created_by: session.managerId }
            : { id: -1 }),
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
    const limiter = checkRateLimit({
      key: `restaurant-create:${session.managerId ?? session.email}:${requestContext.ipAddress ?? "unknown"}`,
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });
    if (!limiter.allowed) {
      const response = NextResponse.json(
        { error: "Too many location creation attempts. Try again later." },
        { status: 429 },
      );
      response.headers.set("retry-after", String(Math.ceil((limiter.resetAt - Date.now()) / 1000)));
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
    const resolvedAccountId =
      session.role === "WGS Manager"
        ? body.accountId ?? null
        : session.accountId ?? body.accountId ?? null;

    const restaurant = await prisma.restaurants.create({
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

    const locationId =
      body.sentryState?.locationId?.trim() ||
      restaurant.unit_id?.trim() ||
      restaurant.store_id?.trim() ||
      `LOC-DB-${restaurant.id}`;

    try {
      await prisma.restaurant_sentry_state.create({
        data: {
          account_id: resolvedAccountId,
          completed: body.sentryState?.completed ?? false,
          created_by: createdBy,
          ium: body.sentryState?.ium ?? "--",
          last_certified: body.sentryState?.lastCertified ?? "Pending",
          location_id: locationId,
          m01_score: body.sentryState?.m01Score ?? 0,
          m02_score: body.sentryState?.m02Score ?? 0,
          modules_json: toNullableJsonInput(body.sentryState?.modules),
          onboarding_checklist: toNullableJsonInput(body.sentryState?.onboardingChecklist),
          onboarding_progress: toNullableJsonInput(body.sentryState?.onboardingProgress),
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
