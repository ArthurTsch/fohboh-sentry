import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireManagerSession } from "@/lib/auth/session";
import { writeAuditLog, logServerError } from "@/lib/ops/audit";
import { getRequestContextFromRequest, withRequestHeaders } from "@/lib/ops/request";
import prisma from "@/lib/prisma";

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

function formatTimestamp(value: Date | null) {
  if (!value) return "Unknown";
  return value.toISOString().replace("T", " ").slice(0, 16);
}

function isImmutableEvent(
  action: string,
  entityType: string,
  metadata: Prisma.JsonValue | null,
) {
  const immutableFromMetadata =
    metadata && typeof metadata === "object" && !Array.isArray(metadata) && "immutable" in metadata
      ? Boolean(metadata.immutable)
      : null;

  if (immutableFromMetadata !== null) {
    return immutableFromMetadata;
  }

  return (
    entityType === "uploads_v2" ||
    entityType === "cert_runs_v2" ||
    entityType === "caars_v2" ||
    entityType === "contract_configs_v2" ||
    entityType === "schema_registry_v2" ||
    action.includes("sealed") ||
    action.includes("certification") ||
    action.includes("upload")
  );
}

async function getScope(session: Awaited<ReturnType<typeof requireManagerSession>>) {
  if (session.role === "WGS Manager" || session.role === "SuperAdmin") {
    return {
      actorUserIds: typeof session.managerId === "number" ? [session.managerId] : [],
      customerIds: [] as number[],
      unrestricted: true,
    };
  }

  const customerIds = new Set<number>();
  if (session.accountId) {
    const customer = await prisma.customers.findFirst({
      where: {
        deleted_at: null,
        name: session.accountId,
      },
      select: {
        id: true,
      },
    });
    if (customer) {
      customerIds.add(customer.id);
    }
  }

  if (typeof session.managerId === "number") {
    const ownedRestaurants = await prisma.restaurants.findMany({
      where: {
        active: true,
        created_by: session.managerId,
      },
      select: {
        id: true,
      },
    });

    if (ownedRestaurants.length > 0) {
      const states = await prisma.restaurant_sentry_state.findMany({
        where: {
          restaurant_id: {
            in: ownedRestaurants.map((restaurant) => restaurant.id),
          },
        },
        select: {
          account_id: true,
        },
      }).catch(() => []);

      const accountIds = [
        ...new Set(
          states
            .map((state) => state.account_id)
            .filter((value): value is string => typeof value === "string" && value.length > 0),
        ),
      ];
      if (accountIds.length > 0) {
        const customers = await prisma.customers.findMany({
          where: {
            deleted_at: null,
            name: {
              in: accountIds,
            },
          },
          select: {
            id: true,
          },
        });
        customers.forEach((customer) => customerIds.add(customer.id));
      }
    }
  }

  return {
    actorUserIds: typeof session.managerId === "number" ? [session.managerId] : [],
    customerIds: [...customerIds],
    unrestricted: false,
  };
}

export async function GET(request: Request) {
  const requestContext = getRequestContextFromRequest(request);

  try {
    const session = await requireManagerSession();
    const scope = await getScope(session);
    const where = scope.unrestricted
      ? {}
      : {
          OR: [
            ...(scope.customerIds.length > 0
              ? [{ customer_id: { in: scope.customerIds } }]
              : []),
            ...(scope.actorUserIds.length > 0
              ? [{ actor_user_id: { in: scope.actorUserIds } }]
              : []),
          ],
        };

    const rows = await prisma.audit_log_v2.findMany({
      where,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: 300,
      select: {
        action: true,
        actor_user_id: true,
        created_at: true,
        customer_id: true,
        entity_id: true,
        entity_type: true,
        id: true,
        location_id: true,
        metadata: true,
        summary: true,
      },
    });

    const customerIds = [...new Set(rows.map((row) => row.customer_id).filter((value): value is number => typeof value === "number"))];
    const locationIds = [...new Set(rows.map((row) => row.location_id).filter((value): value is number => typeof value === "number"))];
    const actorIds = [...new Set(rows.map((row) => row.actor_user_id).filter((value): value is number => typeof value === "number"))];

    const [customers, locations, managers] = await Promise.all([
      customerIds.length > 0
        ? prisma.customers.findMany({
            where: { id: { in: customerIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      locationIds.length > 0
        ? prisma.locations_v2.findMany({
            where: { id: { in: locationIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      actorIds.length > 0
        ? prisma.managers.findMany({
            where: { id: { in: actorIds } },
            select: { email: true, full_name: true, id: true },
          })
        : Promise.resolve([]),
    ]);

    const customerById = new Map(customers.map((customer) => [customer.id, customer.name]));
    const locationById = new Map(locations.map((location) => [location.id, location.name]));
    const managerById = new Map(
      managers.map((manager) => [manager.id, manager.full_name?.trim() || manager.email]),
    );

    const logs = rows.map((row) => {
      const metadata =
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null;
      const accountId = row.customer_id ? customerById.get(row.customer_id) ?? "Portfolio" : "Portfolio";
      const location =
        (row.location_id ? locationById.get(row.location_id) : null) ??
        (typeof metadata?.locationName === "string" ? metadata.locationName : null) ??
        "Portfolio";
      const user =
        (row.actor_user_id ? managerById.get(row.actor_user_id) : null) ??
        (typeof metadata?.user === "string" ? metadata.user : null) ??
        "system";

      return {
        accountId,
        action: row.summary,
        hash: `audit:${row.id}`,
        immutable: isImmutableEvent(row.action, row.entity_type, row.metadata),
        location,
        ts: formatTimestamp(row.created_at),
        user,
      };
    });

    return withRequestHeaders(NextResponse.json({ logs }), requestContext);
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return withRequestHeaders(authResponse, requestContext);
    }

    logServerError("activity_log_fetch_failed", error, {
      requestId: requestContext.requestId,
    });
    return withRequestHeaders(
      NextResponse.json({ error: "Unable to load the activity log right now." }, { status: 500 }),
      requestContext,
    );
  }
}

export async function POST(request: Request) {
  const requestContext = getRequestContextFromRequest(request);

  try {
    const session = await requireManagerSession();
    if (session.role === "Viewer") {
      return withRequestHeaders(
        NextResponse.json({ error: "This account cannot write audit events." }, { status: 403 }),
        requestContext,
      );
    }

    const body = (await request.json()) as {
      accountId?: string | null;
      action?: string | null;
      entityId?: string | null;
      entityType?: string | null;
      immutable?: boolean | null;
      locationId?: string | null;
      locationName?: string | null;
      metadata?: Record<string, unknown> | null;
      summary?: string | null;
    };

    const action = body.action?.trim() ?? "";
    const summary = body.summary?.trim() ?? "";
    const entityType = body.entityType?.trim() ?? "ui_event";
    const entityId = body.entityId?.trim() ?? `ui-${Date.now()}`;

    if (!action || !summary) {
      return withRequestHeaders(
        NextResponse.json({ error: "action and summary are required." }, { status: 400 }),
        requestContext,
      );
    }

    const location = body.locationId?.trim()
      ? await prisma.locations_v2.findFirst({
          where: {
            deleted_at: null,
            external_id: body.locationId.trim(),
          },
          select: {
            customer_id: true,
            id: true,
            name: true,
          },
        })
      : null;

    const customer =
      location?.customer_id
        ? { id: location.customer_id }
        : body.accountId?.trim()
          ? await prisma.customers.findFirst({
              where: {
                deleted_at: null,
                name: body.accountId.trim(),
              },
              select: {
                id: true,
              },
            })
          : null;

    await writeAuditLog(
      {
        action,
        actorUserId: session.managerId ?? null,
        customerId: customer?.id ?? null,
        entityId,
        entityType,
        ipAddress: requestContext.ipAddress,
        locationId: location?.id ?? null,
        metadata: {
          ...(body.metadata ?? {}),
          immutable: Boolean(body.immutable),
          locationName: body.locationName ?? location?.name ?? null,
          user: session.name?.trim() || session.email,
        },
        summary,
        userAgent: requestContext.userAgent,
      },
    );

    return withRequestHeaders(NextResponse.json({ ok: true }), requestContext);
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return withRequestHeaders(authResponse, requestContext);
    }

    logServerError("activity_log_write_failed", error, {
      requestId: requestContext.requestId,
    });
    return withRequestHeaders(
      NextResponse.json({ error: "Unable to write the activity log event right now." }, { status: 500 }),
      requestContext,
    );
  }
}
