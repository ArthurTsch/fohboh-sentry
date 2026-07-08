import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireManagerSession } from "@/lib/auth/session";
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

export async function POST(request: Request) {
  try {
    const session = await requireManagerSession();
    if (session.role === "Viewer") {
      return NextResponse.json(
        { error: "This account cannot update location state." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      accountId?: string | null;
      completed?: boolean;
      createdBy?: number | null;
      ium?: string;
      lastCertified?: string;
      locationId?: string;
      m01Score?: number;
      m02Score?: number;
      governanceInitializedAt?: string | null;
      governanceSealedAt?: string | null;
      governanceStatus?: string;
      modules?: unknown;
      onboardingChecklist?: unknown;
      onboardingProgress?: unknown;
      recoveryDisplay?: string;
      restaurantId?: number | null;
      status?: string;
    };

    const locationId = body.locationId?.trim() ?? "";
    if (!locationId) {
      return NextResponse.json({ error: "locationId is required." }, { status: 400 });
    }

    const restaurantId =
      typeof body.restaurantId === "number" && Number.isFinite(body.restaurantId)
        ? body.restaurantId
        : (
            await prisma.restaurants.findFirst({
              where: {
                OR: [{ unit_id: locationId }, { store_id: locationId }],
              },
              select: { id: true },
            })
          )?.id ?? null;

    if (!restaurantId) {
      return NextResponse.json(
        { error: "Unable to resolve a restaurant record for this location." },
        { status: 404 },
      );
    }

    const state = await prisma.restaurant_sentry_state.upsert({
      where: {
        restaurant_id: restaurantId,
      },
      update: {
        account_id:
          session.role === "WGS Manager" || session.role === "SuperAdmin"
            ? body.accountId ?? null
            : session.accountId ?? body.accountId ?? null,
        completed: body.completed ?? false,
        created_by: typeof session.managerId === "number" ? session.managerId : null,
        governance_initialized_at: body.governanceInitializedAt ? new Date(body.governanceInitializedAt) : undefined,
        governance_sealed_at: body.governanceSealedAt ? new Date(body.governanceSealedAt) : null,
        governance_status: body.governanceStatus ?? undefined,
        ium: body.ium ?? "--",
        last_certified: body.lastCertified ?? "Pending",
        location_id: locationId,
        m01_score: body.m01Score ?? 0,
        m02_score: body.m02Score ?? 0,
        modules_json: toNullableJsonInput(body.modules),
        onboarding_checklist: toNullableJsonInput(body.onboardingChecklist),
        onboarding_progress: toNullableJsonInput(body.onboardingProgress),
        recovery_display: body.recoveryDisplay ?? "$0",
        status: body.status ?? "Onboarding",
        updated_at: new Date(),
      },
      create: {
        account_id:
          session.role === "WGS Manager" || session.role === "SuperAdmin"
            ? body.accountId ?? null
            : session.accountId ?? body.accountId ?? null,
        completed: body.completed ?? false,
        created_by: typeof session.managerId === "number" ? session.managerId : null,
        governance_initialized_at: body.governanceInitializedAt ? new Date(body.governanceInitializedAt) : null,
        governance_sealed_at: body.governanceSealedAt ? new Date(body.governanceSealedAt) : null,
        governance_status: body.governanceStatus ?? "uninitialized",
        ium: body.ium ?? "--",
        last_certified: body.lastCertified ?? "Pending",
        location_id: locationId,
        m01_score: body.m01Score ?? 0,
        m02_score: body.m02Score ?? 0,
        modules_json: toNullableJsonInput(body.modules),
        onboarding_checklist: toNullableJsonInput(body.onboardingChecklist),
        onboarding_progress: toNullableJsonInput(body.onboardingProgress),
        recovery_display: body.recoveryDisplay ?? "$0",
        restaurant_id: restaurantId,
        status: body.status ?? "Onboarding",
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
