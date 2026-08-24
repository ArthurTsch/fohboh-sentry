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
import { writeAuditLog, logServerError } from "@/lib/ops/audit";
import { getRequestContextFromRequest, withRequestHeaders } from "@/lib/ops/request";
import prisma from "@/lib/prisma";
import { ensureLocationV2ForRestaurant } from "@/lib/production/legacy-sync";
import { getScopedRestaurantWhere } from "@/lib/auth/team-access";
import { resolveVendorKey } from "@/components/sentry/vendor-catalog";
import {
  buildAgreementUploadLookup,
  matchesAgreementUploadVendor,
} from "@/lib/governance/agreement-upload";

type ScopedRestaurant = {
  accountId: string | null;
  address: string | null;
  id: number;
  locationId: string;
  name: string;
};

type GovernanceStateRow = {
  onboarding_progress: unknown;
  modules_json: unknown;
  restaurant_id: number;
};

type GovernanceSealBlockerPayload = {
  action: "upload_agreement";
  artifactKey: string;
  ctaLabel: string;
  error: string;
  locationId: string;
  locationName: string;
  moduleId: "M01" | "M02";
  vendor: string;
};

class GovernanceSealBlockedError extends Error {
  payload: GovernanceSealBlockerPayload;

  constructor(payload: GovernanceSealBlockerPayload) {
    super(payload.error);
    this.name = "GovernanceSealBlockedError";
    this.payload = payload;
  }
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

function getGovernanceValidationErrorResponse(error: unknown) {
  if (error instanceof GovernanceSealBlockedError) {
    return NextResponse.json(error.payload, { status: 409 });
  }
  if (!(error instanceof Error)) return null;
  if (error.message.startsWith("Seal blocked: ")) {
    return NextResponse.json({ error: error.message }, { status: 409 });
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

function extractActiveModules(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Array<"M01" | "M02">;
  }

  return [...new Set(
    value
      .map((item) =>
        item && typeof item === "object" && "label" in item ? String(item.label).trim() : "",
      )
      .filter((label): label is "M01" | "M02" => label === "M01" || label === "M02"),
  )];
}

function extractSelectedVendors(value: unknown, module: "M01" | "M02") {
  const moduleKey = module === "M01" ? "m01" : "m02";
  if (!value || typeof value !== "object") {
    return [] as string[];
  }

  const selected = (value as { selectedVendors?: Record<string, unknown> }).selectedVendors?.[moduleKey];
  if (!Array.isArray(selected)) {
    return [];
  }

  return [...new Set(selected.map((entry) => String(entry).trim()).filter(Boolean))];
}

function normalizeVendorKey(value: string) {
  return value.trim().toLowerCase();
}

function buildUploadVendorCandidates(moduleId: "M01" | "M02", vendor: string) {
  const display = vendor.trim();
  const key = resolveVendorKey(moduleId, vendor).trim();
  return [...new Set([display, key].filter(Boolean))];
}

function isSealedStatus(value: string | null | undefined) {
  return value === "sealed" || value === "seal";
}

function getAgreementArtifactKey(module: "M01" | "M02") {
  return module === "M01" ? "m01-agreement" : "m02-agreement";
}

function getAgreementArtifactLabel(module: "M01" | "M02") {
  return module === "M01" ? "signed merchant agreement" : "signed DSP agreement";
}

function buildExpectedGovernancePairs(
  stateRow: GovernanceStateRow | null,
  fallbackWorkspace: SchemaWorkspace,
) {
  const activeModules = extractActiveModules(stateRow?.modules_json);
  const expectedPairs = new Set<string>();

  for (const moduleId of activeModules.length > 0 ? activeModules : [fallbackWorkspace.module]) {
    const selectedVendors = extractSelectedVendors(stateRow?.onboarding_progress, moduleId);
    if (selectedVendors.length > 0) {
      for (const vendor of selectedVendors) {
        expectedPairs.add(`${moduleId}:${normalizeVendorKey(vendor)}`);
      }
      continue;
    }

    if (moduleId === fallbackWorkspace.module) {
      expectedPairs.add(`${moduleId}:${normalizeVendorKey(fallbackWorkspace.vendor)}`);
    }
  }

  if (expectedPairs.size === 0) {
    expectedPairs.add(`${fallbackWorkspace.module}:${normalizeVendorKey(fallbackWorkspace.vendor)}`);
  }

  return expectedPairs;
}

function pickLatestStatusByKey<T extends { module: string; status: string; vendor: string; version: number }>(
  rows: T[],
) {
  const latest = new Map<string, T>();

  for (const row of rows) {
    const key = `${row.module}:${normalizeVendorKey(row.vendor)}`;
    const existing = latest.get(key);
    if (!existing || row.version > existing.version) {
      latest.set(key, row);
    }
  }

  return latest;
}

function deriveGovernanceLifecycleStatus({
  contractRows,
  expectedPairs,
  schemaRows,
}: {
  contractRows: Array<{ module: string; status: string; vendor: string; version: number }>;
  expectedPairs: Set<string>;
  schemaRows: Array<{ module: string; status: string; vendor: string; version: number }>;
}) {
  const latestSchema = pickLatestStatusByKey(schemaRows);
  const latestContract = pickLatestStatusByKey(contractRows);
  let initializedCount = 0;
  let sealedCount = 0;

  for (const key of expectedPairs) {
    const schema = latestSchema.get(key);
    const contract = latestContract.get(key);

    if (schema || contract) {
      initializedCount += 1;
    }

    if (isSealedStatus(schema?.status) && isSealedStatus(contract?.status)) {
      sealedCount += 1;
    }
  }

  if (expectedPairs.size > 0 && sealedCount === expectedPairs.size) {
    return "sealed";
  }

  if (initializedCount > 0 || schemaRows.length > 0 || contractRows.length > 0) {
    return "draft";
  }

  return "uninitialized";
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

function pickLatestByKey<T extends { id: number; version: number }>(
  rows: T[],
  keyBuilder: (row: T) => string,
) {
  const result = new Map<string, T>();
  for (const row of rows) {
    const key = keyBuilder(row);
    const existing = result.get(key);
    if (!existing || row.version > existing.version || (row.version === existing.version && row.id > existing.id)) {
      result.set(key, row);
    }
  }
  return result;
}

export async function GET(request: Request) {
  const requestContext = getRequestContextFromRequest(request);
  try {
    const session = await requireManagerSession();
    const restaurants = await getScopedRestaurants(session);

    if (restaurants.length === 0) {
      return withRequestHeaders(NextResponse.json({ workspaces: [] }), requestContext);
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
    const customers = locations.length
      ? await prisma.customers.findMany({
          where: {
            id: {
              in: [...new Set(locations.map((location) => location.customer_id))],
            },
            deleted_at: null,
          },
          select: {
            id: true,
            name: true,
          },
        })
      : [];

    if (locations.length === 0) {
      return withRequestHeaders(NextResponse.json({ workspaces: [] }), requestContext);
    }

    const locationById = new Map(locations.map((location) => [location.id, location]));
    const customerNameById = new Map(customers.map((customer) => [customer.id, customer.name]));
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
      const accountId = restaurant?.accountId ?? customerNameById.get(location.customer_id) ?? null;
      if (!accountId) continue;
      const locationName = restaurant?.name ?? location.name;

      const workspace = normalizeWorkspaceFromRecords({
        account: customerNameById.get(location.customer_id) ?? locationName,
        accountId,
        contractRecord,
        locationId: location.external_id,
        locationName,
        module: reference.module as "M01" | "M02",
        schemaRecord,
        vendor: reference.vendor,
      });

      if (workspace) {
        workspaces.push(workspace);
      }
    }

    return withRequestHeaders(NextResponse.json({ workspaces }), requestContext);
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return withRequestHeaders(authResponse, requestContext);
    }
    const validationResponse = getGovernanceValidationErrorResponse(error);
    if (validationResponse) {
      return withRequestHeaders(validationResponse, requestContext);
    }

    if (isMissingGovernanceSchema(error)) {
      return withRequestHeaders(NextResponse.json(
        {
          error:
            "The Phase 4 governance migration has not been applied yet. Update the database before using persisted schema and contract config.",
        },
        { status: 503 },
      ), requestContext);
    }

    logServerError("governance_workspaces_fetch_failed", error, {
      requestId: requestContext.requestId,
    });
    return withRequestHeaders(NextResponse.json(
      { error: "Unable to load governance workspaces right now." },
      { status: 500 },
    ), requestContext);
  }
}

export async function POST(request: Request) {
  const requestContext = getRequestContextFromRequest(request);
  try {
    const session = await requireManagerSession();
    if (session.role === "Viewer") {
      return withRequestHeaders(NextResponse.json({ error: "This account cannot modify governance workspaces." }, { status: 403 }), requestContext);
    }
    const body = (await request.json()) as {
      action?: "draft" | "seal";
      workspace?: SchemaWorkspace;
    };
    const action = body.action;

    if (action === "seal" && session.role !== "WGS Manager" && session.role !== "SuperAdmin") {
      return withRequestHeaders(NextResponse.json(
        { error: "Only WGS can seal Schema Registry and Contract Config records." },
        { status: 403 },
      ), requestContext);
    }
    if (action === "draft" && session.role !== "Admin" && session.role !== "WGS Manager" && session.role !== "SuperAdmin") {
      return withRequestHeaders(NextResponse.json(
        { error: "Only Admin or WGS can edit governance workspaces." },
        { status: 403 },
      ), requestContext);
    }
    if (typeof session.managerId !== "number") {
      return withRequestHeaders(NextResponse.json(
        { error: "This account is missing a database-backed manager identity." },
        { status: 403 },
      ), requestContext);
    }
    const managerId = session.managerId;
    const workspace = body.workspace;

    if (!workspace || (action !== "draft" && action !== "seal")) {
      return withRequestHeaders(NextResponse.json({ error: "Valid action and workspace are required." }, { status: 400 }), requestContext);
    }

    const restaurants = await getScopedRestaurants(session);
    const restaurant =
      (workspace.locationId
        ? restaurants.find((item) => item.locationId === workspace.locationId)
        : undefined) ??
      restaurants.find((item) => item.accountId === workspace.accountId);

    if (!restaurant) {
      return withRequestHeaders(NextResponse.json(
        { error: "Unable to resolve a governed location for this workspace." },
        { status: 404 },
      ), requestContext);
    }
    const accountId =
      restaurant.accountId?.trim() ||
      workspace.accountId?.trim() ||
      session.accountId?.trim() ||
      null;

    if (!accountId) {
      return withRequestHeaders(NextResponse.json(
        {
          error:
            "This location is missing its customer account binding. Reopen Team & Access or re-save the location so the account can be attached before governance is sealed.",
        },
        { status: 409 },
      ), requestContext);
    }

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
    const persistedStatus = action === "seal" ? "sealed" : "draft";

    if (
      action === "seal" &&
      normalizedWorkspace.fields.some(
        (field) => field.required && field.confidence !== "Verified",
      )
    ) {
      return withRequestHeaders(NextResponse.json(
        { error: "All required schema fields must be verified before the workspace can be sealed." },
        { status: 409 },
      ), requestContext);
    }

    const persisted = await prisma.$transaction(async (tx) => {
      const location = await ensureLocationV2ForRestaurant(tx, {
        accountId: restaurant.accountId,
        address: restaurant.address,
        locationId: restaurant.locationId,
        name: restaurant.name,
      });

      // Version allocation must be serialized for this workspace. Without this lock,
      // concurrent save/seal requests can both select the same latest version.
      const workspaceLockKey = [
        "governance-workspace",
        location.id,
        normalizedWorkspace.module,
        normalizeVendorKey(normalizedWorkspace.vendor),
      ].join(":");
      await tx.$queryRaw<Array<{ locked: number }>>`
        SELECT 1::integer AS "locked"
        FROM pg_advisory_xact_lock(hashtext(${workspaceLockKey}))
      `;

      const agreementUploads = await tx.uploads_v2.findMany({
        where: buildAgreementUploadLookup({
          artifactKey: getAgreementArtifactKey(normalizedWorkspace.module),
          moduleId: normalizedWorkspace.module,
          normalizedLocationId: location.id,
        }),
        orderBy: [{ uploaded_at: "desc" }, { id: "desc" }],
        select: {
          id: true,
          vendor: true,
        },
      });
      const agreementVendorCandidates = buildUploadVendorCandidates(
        normalizedWorkspace.module,
        normalizedWorkspace.vendor,
      );
      const latestAgreementUpload =
        agreementUploads.find((upload) =>
          matchesAgreementUploadVendor(upload.vendor, agreementVendorCandidates),
        ) ?? null;

      const [latestSchema, latestContract, stateRow] = await Promise.all([
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
        tx.restaurant_sentry_state.findUnique({
          where: {
            restaurant_id: restaurant.id,
          },
          select: {
            modules_json: true,
            onboarding_progress: true,
            restaurant_id: true,
          },
        }).catch((error) => {
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "P2021"
          ) {
            return null;
          }
          throw error;
        }),
      ]);

      const latestSealedSchema = latestSchema && isSealedStatus(latestSchema.status) ? latestSchema : await tx.schema_registry_v2.findFirst({
        where: {
          location_id: location.id,
          module: normalizedWorkspace.module,
          status: {
            in: ["sealed", "seal"],
          },
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
      });
      const latestSealedContract =
        latestContract && isSealedStatus(latestContract.status)
          ? latestContract
          : await tx.contract_configs_v2.findFirst({
              where: {
                location_id: location.id,
                module: normalizedWorkspace.module,
                status: {
                  in: ["sealed", "seal"],
                },
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
            });

      const nextSchemaVersion = (latestSchema?.version ?? 0) + 1;
      const nextContractVersion = (latestContract?.version ?? 0) + 1;
      const schemaPayload = {
        ...workspaceToSchemaPayload(normalizedWorkspace),
        sealedBy: session.email,
      };
      const contractPayload = {
        ...workspaceToContractPayload(normalizedWorkspace),
        sealedBy: session.email,
      };
      const now = new Date();
      const mutableSchemaRecord = latestSchema?.status === "draft" ? latestSchema : null;
      const mutableContractRecord = latestContract?.status === "draft" ? latestContract : null;
      const schemaHash = computeWorkspaceHash(schemaPayload);
      const contractHash = computeWorkspaceHash(contractPayload);
      const sampleHeaders = normalizedWorkspace.fields.map((field) => field.source).filter(Boolean);

      if (action === "seal" && !latestAgreementUpload) {
        throw new GovernanceSealBlockedError({
          action: "upload_agreement",
          artifactKey: getAgreementArtifactKey(normalizedWorkspace.module),
          ctaLabel: "Open Vault Record",
          error: `Cannot seal ${normalizedWorkspace.module} ${normalizedWorkspace.vendor} workspace yet. Upload the ${getAgreementArtifactLabel(normalizedWorkspace.module)} PDF first.`,
          locationId: restaurant.locationId,
          locationName: restaurant.name,
          moduleId: normalizedWorkspace.module,
          vendor: normalizedWorkspace.vendor,
        });
      }

      const [schemaRecord, contractRecord] = await Promise.all([
        action === "draft" && mutableSchemaRecord
          ? tx.schema_registry_v2.update({
              where: {
                id: mutableSchemaRecord.id,
              },
              data: {
                fields: toJsonValue(schemaPayload),
                prev_sha256: latestSealedSchema?.sha256 ?? null,
                sample_headers: sampleHeaders.length > 0 ? toJsonValue(sampleHeaders) : Prisma.JsonNull,
                sealed_at: null,
                sealed_by: managerId,
                sha256: schemaHash,
                source_upload_id: null,
                status: persistedStatus,
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
            })
          : tx.schema_registry_v2.create({
              data: {
                fields: toJsonValue(schemaPayload),
                location_id: location.id,
                module: normalizedWorkspace.module,
                prev_sha256: latestSealedSchema?.sha256 ?? null,
                sample_headers: sampleHeaders.length > 0 ? toJsonValue(sampleHeaders) : Prisma.JsonNull,
                sealed_at: action === "seal" ? now : null,
                sealed_by: managerId,
                sha256: schemaHash,
                source_upload_id: null,
                status: persistedStatus,
                vendor: normalizedWorkspace.vendor,
                version: nextSchemaVersion,
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
        action === "draft" && mutableContractRecord
          ? tx.contract_configs_v2.update({
              where: {
                id: mutableContractRecord.id,
              },
              data: {
                prev_sha256: latestSealedContract?.sha256 ?? null,
                sealed_at: null,
                sealed_by: managerId,
                sha256: contractHash,
                source_upload_id: latestAgreementUpload?.id ?? null,
                status: persistedStatus,
                terms: toJsonValue(contractPayload),
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
            })
          : tx.contract_configs_v2.create({
              data: {
                location_id: location.id,
                module: normalizedWorkspace.module,
                prev_sha256: latestSealedContract?.sha256 ?? null,
                sealed_at: action === "seal" ? now : null,
                sealed_by: managerId,
                sha256: contractHash,
                source_upload_id: latestAgreementUpload?.id ?? null,
                status: persistedStatus,
                terms: toJsonValue(contractPayload),
                vendor: normalizedWorkspace.vendor,
                version: nextContractVersion,
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

      const [allSchemaRows, allContractRows] = await Promise.all([
        tx.schema_registry_v2.findMany({
          where: {
            location_id: location.id,
          },
          select: {
            module: true,
            status: true,
            vendor: true,
            version: true,
          },
        }),
        tx.contract_configs_v2.findMany({
          where: {
            location_id: location.id,
          },
          select: {
            module: true,
            status: true,
            vendor: true,
            version: true,
          },
        }),
      ]);

      const governanceStatus = deriveGovernanceLifecycleStatus({
        contractRows: allContractRows,
        expectedPairs: buildExpectedGovernancePairs(stateRow, normalizedWorkspace),
        schemaRows: allSchemaRows,
      });
      const governanceInitializedAt = new Date();

      await tx.restaurant_sentry_state.upsert({
        where: {
          restaurant_id: restaurant.id,
        },
        update: {
          account_id: restaurant.accountId,
          created_by: managerId,
          governance_initialized_at: governanceInitializedAt,
          governance_sealed_at: governanceStatus === "sealed" ? governanceInitializedAt : null,
          governance_status: governanceStatus,
          updated_at: governanceInitializedAt,
        },
        create: {
          account_id: restaurant.accountId,
          created_by: managerId,
          governance_initialized_at: governanceInitializedAt,
          governance_sealed_at: governanceStatus === "sealed" ? governanceInitializedAt : null,
          governance_status: governanceStatus,
          location_id: restaurant.locationId,
          restaurant_id: restaurant.id,
        },
      }).catch((error) => {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2021"
        ) {
          return null;
        }
        throw error;
      });

      await tx.locations_v2.update({
        where: { id: location.id },
        data: {
          status: governanceStatus === "sealed" ? "governance_ready" : "onboarding",
          updated_at: governanceInitializedAt,
        },
      });

      await writeAuditLog(
        {
          action: action === "seal" ? "governance_workspace_sealed" : "governance_workspace_saved",
          actorUserId: managerId,
          customerId: location.customer_id,
          entityId: `${normalizedWorkspace.module}:${normalizedWorkspace.vendor}:${restaurant.locationId}:${schemaRecord.version}`,
          entityType: action === "seal" ? "contract_configs_v2" : "schema_registry_v2",
          ipAddress: requestContext.ipAddress,
          locationId: location.id,
          metadata: {
            immutable: action === "seal",
            locationName: restaurant.name,
            module: normalizedWorkspace.module,
            status: persistedStatus,
            vendor: normalizedWorkspace.vendor,
          },
          summary:
            action === "seal"
              ? `${normalizedWorkspace.module} ${normalizedWorkspace.vendor} workspace sealed for ${restaurant.name}.`
              : `${normalizedWorkspace.module} ${normalizedWorkspace.vendor} workspace draft saved for ${restaurant.name}.`,
          userAgent: requestContext.userAgent,
        },
        tx,
      );

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
      return withRequestHeaders(NextResponse.json(
        { error: "Unable to normalize the saved workspace." },
        { status: 500 },
      ), requestContext);
    }

    return withRequestHeaders(NextResponse.json({ workspace: persisted }), requestContext);
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return withRequestHeaders(authResponse, requestContext);
    }
    const validationResponse = getGovernanceValidationErrorResponse(error);
    if (validationResponse) {
      return withRequestHeaders(validationResponse, requestContext);
    }

    if (isMissingGovernanceSchema(error)) {
      return withRequestHeaders(NextResponse.json(
        {
          error:
            "The Phase 4 governance migration has not been applied yet. Update the database before using persisted schema and contract config.",
        },
        { status: 503 },
      ), requestContext);
    }

    logServerError("governance_workspace_persist_failed", error, {
      requestId: requestContext.requestId,
    });
    return withRequestHeaders(NextResponse.json(
      { error: "Unable to save the governance workspace right now." },
      { status: 500 },
    ), requestContext);
  }
}
