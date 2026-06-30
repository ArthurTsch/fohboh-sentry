import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import type { SchemaWorkspace, SessionState } from "@/components/sentry/types";
import {
  computeWorkspaceHash,
  normalizeWorkspaceFromRecords,
  workspaceToContractPayload,
  workspaceToSchemaPayload,
} from "@/lib/governance/workspaces";
import { requireManagerSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { ensureLocationV2ForRestaurant } from "@/lib/production/legacy-sync";

type ScopedRestaurant = {
  accountId: string | null;
  address: string | null;
  id: number;
  locationId: string;
  name: string;
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

function isMissingGovernanceSchema(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

function toJsonValue(value: unknown) {
  return value as Prisma.InputJsonValue;
}

async function getScopedRestaurants(session: SessionState) {
  const restaurants = await prisma.restaurants.findMany({
    where: {
      active: true,
      ...(session.role === "WGS Manager" || session.role === "SuperAdmin"
        ? {}
        : typeof session.managerId === "number"
          ? { created_by: session.managerId }
          : { id: -1 }),
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    select: {
      id: true,
      location: true,
      name: true,
      store_id: true,
      unit_id: true,
    },
  });

  const stateRows = restaurants.length
    ? await prisma.restaurant_sentry_state.findMany({
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
      }).catch((error) => {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2021"
        ) {
          return [];
        }
        throw error;
      })
    : [];

  const stateByRestaurantId = new Map(stateRows.map((row) => [row.restaurant_id, row]));

  return restaurants.map<ScopedRestaurant>((restaurant) => ({
    accountId: stateByRestaurantId.get(restaurant.id)?.account_id ?? null,
    address: restaurant.location,
    id: restaurant.id,
    locationId:
      stateByRestaurantId.get(restaurant.id)?.location_id?.trim() ||
      restaurant.unit_id?.trim() ||
      restaurant.store_id?.trim() ||
      `LOC-DB-${restaurant.id}`,
    name: restaurant.name,
  }));
}

function pickLatestByKey<T extends { version: number }>(rows: T[], keyBuilder: (row: T) => string) {
  const result = new Map<string, T>();
  for (const row of rows) {
    const key = keyBuilder(row);
    const existing = result.get(key);
    if (!existing || row.version > existing.version) {
      result.set(key, row);
    }
  }
  return result;
}

export async function GET() {
  try {
    const session = await requireManagerSession();
    const restaurants = await getScopedRestaurants(session);

    if (restaurants.length === 0) {
      return NextResponse.json({ workspaces: [] });
    }

    const externalIds = restaurants.map((restaurant) => restaurant.locationId);
    const locations = await prisma.locations_v2.findMany({
      where: {
        external_id: {
          in: externalIds,
        },
        deleted_at: null,
      },
      select: {
        customer_id: true,
        external_id: true,
        id: true,
        name: true,
      },
    });

    if (locations.length === 0) {
      return NextResponse.json({ workspaces: [] });
    }

    const locationById = new Map(locations.map((location) => [location.id, location]));
    const restaurantByExternalId = new Map(restaurants.map((restaurant) => [restaurant.locationId, restaurant]));
    const schemaRows = await prisma.schema_registry_v2.findMany({
      where: {
        location_id: {
          in: locations.map((location) => location.id),
        },
      },
      orderBy: [{ version: "desc" }, { id: "desc" }],
      select: {
        fields: true,
        id: true,
        location_id: true,
        module: true,
        sealed_at: true,
        sha256: true,
        status: true,
        vendor: true,
        version: true,
      },
    });
    const contractRows = await prisma.contract_configs_v2.findMany({
      where: {
        location_id: {
          in: locations.map((location) => location.id),
        },
      },
      orderBy: [{ version: "desc" }, { id: "desc" }],
      select: {
        id: true,
        location_id: true,
        module: true,
        sealed_at: true,
        sha256: true,
        status: true,
        terms: true,
        vendor: true,
        version: true,
      },
    });

    const latestSchema = pickLatestByKey(
      schemaRows,
      (row) => `${row.location_id}:${row.module}:${row.vendor}`,
    );
    const latestContract = pickLatestByKey(
      contractRows,
      (row) => `${row.location_id}:${row.module}:${row.vendor}`,
    );

    const workspaceKeys = new Set([...latestSchema.keys(), ...latestContract.keys()]);
    const workspaces: SchemaWorkspace[] = [];

    for (const key of workspaceKeys) {
      const schemaRecord = latestSchema.get(key) ?? null;
      const contractRecord = latestContract.get(key) ?? null;
      const reference = schemaRecord ?? contractRecord;
      if (!reference) continue;

      const location = locationById.get(reference.location_id);
      if (!location) continue;
      const restaurant = restaurantByExternalId.get(location.external_id);
      if (!restaurant?.accountId) continue;

      const workspace = normalizeWorkspaceFromRecords({
        account: restaurant.name,
        accountId: restaurant.accountId,
        contractRecord,
        locationId: location.external_id,
        locationName: restaurant.name,
        module: reference.module as "M01" | "M02",
        schemaRecord,
        vendor: reference.vendor,
      });

      if (workspace) {
        workspaces.push(workspace);
      }
    }

    return NextResponse.json({ workspaces });
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (isMissingGovernanceSchema(error)) {
      return NextResponse.json(
        {
          error:
            "The Phase 4 governance migration has not been applied yet. Update the database before using persisted schema and contract config.",
        },
        { status: 503 },
      );
    }

    console.error("Fetch governance workspaces failed:", error);
    return NextResponse.json(
      { error: "Unable to load governance workspaces right now." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireManagerSession();
    if (session.role === "Viewer") {
      return NextResponse.json({ error: "This account cannot modify governance workspaces." }, { status: 403 });
    }
    if (typeof session.managerId !== "number") {
      return NextResponse.json(
        { error: "This account is missing a database-backed manager identity." },
        { status: 403 },
      );
    }
    const managerId = session.managerId;

    const body = (await request.json()) as {
      action?: "draft" | "seal";
      workspace?: SchemaWorkspace;
    };

    const action = body.action;
    const workspace = body.workspace;

    if (!workspace || (action !== "draft" && action !== "seal")) {
      return NextResponse.json({ error: "Valid action and workspace are required." }, { status: 400 });
    }

    const restaurants = await getScopedRestaurants(session);
    const restaurant =
      (workspace.locationId
        ? restaurants.find((item) => item.locationId === workspace.locationId)
        : undefined) ??
      restaurants.find((item) => item.accountId === workspace.accountId);

    if (!restaurant?.accountId) {
      return NextResponse.json(
        { error: "Unable to resolve a governed location for this workspace." },
        { status: 404 },
      );
    }
    const accountId = restaurant.accountId;

    const normalizedWorkspace: SchemaWorkspace = {
      ...workspace,
      account: restaurant.name,
      accountId,
      locationId: restaurant.locationId,
      locationName: restaurant.name,
      status: action === "seal" ? "sealed" : "draft",
      fields:
        action === "seal"
          ? workspace.fields.map((field) =>
              field.required ? { ...field, confidence: "Verified" } : field,
            )
          : workspace.fields,
      vault: {
        ...workspace.vault,
        state: action === "seal" ? "sealed" : "draft",
      },
    };

    const persisted = await prisma.$transaction(async (tx) => {
      const location = await ensureLocationV2ForRestaurant(tx, {
        accountId: restaurant.accountId,
        address: restaurant.address,
        locationId: restaurant.locationId,
        name: restaurant.name,
      });

      const [latestSchema, latestContract] = await Promise.all([
        tx.schema_registry_v2.findFirst({
          where: {
            location_id: location.id,
            module: normalizedWorkspace.module,
            vendor: normalizedWorkspace.vendor,
          },
          orderBy: [{ version: "desc" }, { id: "desc" }],
          select: {
            fields: true,
            id: true,
            location_id: true,
            module: true,
            sealed_at: true,
            sha256: true,
            status: true,
            vendor: true,
            version: true,
          },
        }),
        tx.contract_configs_v2.findFirst({
          where: {
            location_id: location.id,
            module: normalizedWorkspace.module,
            vendor: normalizedWorkspace.vendor,
          },
          orderBy: [{ version: "desc" }, { id: "desc" }],
          select: {
            id: true,
            location_id: true,
            module: true,
            sealed_at: true,
            sha256: true,
            status: true,
            terms: true,
            vendor: true,
            version: true,
          },
        }),
      ]);

      const schemaVersion = (latestSchema?.version ?? 0) + 1;
      const contractVersion = (latestContract?.version ?? 0) + 1;
      const schemaPayload = {
        ...workspaceToSchemaPayload(normalizedWorkspace),
        sealedBy: session.email,
      };
      const contractPayload = {
        ...workspaceToContractPayload(normalizedWorkspace),
        sealedBy: session.email,
      };

      const [schemaRecord, contractRecord] = await Promise.all([
        tx.schema_registry_v2.create({
          data: {
            fields: toJsonValue(schemaPayload),
            location_id: location.id,
            module: normalizedWorkspace.module,
            sample_headers: toJsonValue(
              normalizedWorkspace.fields.map((field) => field.source).filter(Boolean),
            ),
            sealed_at: new Date(),
            sealed_by: managerId,
            sha256: computeWorkspaceHash(schemaPayload),
            status: action,
            vendor: normalizedWorkspace.vendor,
            version: schemaVersion,
          },
          select: {
            fields: true,
            id: true,
            location_id: true,
            module: true,
            sealed_at: true,
            sha256: true,
            status: true,
            vendor: true,
            version: true,
          },
        }),
        tx.contract_configs_v2.create({
          data: {
            location_id: location.id,
            module: normalizedWorkspace.module,
            prev_sha256: latestContract?.sha256 ?? null,
            sealed_at: new Date(),
            sealed_by: managerId,
            sha256: computeWorkspaceHash(contractPayload),
            source_upload_id: null,
            status: action,
            terms: toJsonValue(contractPayload),
            vendor: normalizedWorkspace.vendor,
            version: contractVersion,
          },
          select: {
            id: true,
            location_id: true,
            module: true,
            sealed_at: true,
            sha256: true,
            status: true,
            terms: true,
            vendor: true,
            version: true,
          },
        }),
      ]);

      return normalizeWorkspaceFromRecords({
        account: restaurant.name,
        accountId,
        contractRecord,
        locationId: restaurant.locationId,
        locationName: restaurant.name,
        module: normalizedWorkspace.module,
        schemaRecord,
        vendor: normalizedWorkspace.vendor,
      });
    });

    if (!persisted) {
      return NextResponse.json(
        { error: "Unable to normalize the saved workspace." },
        { status: 500 },
      );
    }

    return NextResponse.json({ workspace: persisted });
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (isMissingGovernanceSchema(error)) {
      return NextResponse.json(
        {
          error:
            "The Phase 4 governance migration has not been applied yet. Update the database before using persisted schema and contract config.",
        },
        { status: 503 },
      );
    }

    console.error("Persist governance workspace failed:", error);
    return NextResponse.json(
      { error: "Unable to save the governance workspace right now." },
      { status: 500 },
    );
  }
}
