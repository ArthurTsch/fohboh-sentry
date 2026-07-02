import { createHash } from "crypto";
import { Prisma } from "@/app/generated/prisma/client";
import {
  buildCertificationResult,
  type CertificationResult,
} from "@/components/sentry/caar-engine";
import { uploadModules } from "@/components/sentry/data";
import type {
  CaarRecord,
  IntakeState,
  LocationModuleState,
  LocationRecord,
  SessionState,
} from "@/components/sentry/types";
import prisma from "@/lib/prisma";
import { persistGeneratedCaar } from "@/lib/caar/persistence";
import { ensureLocationV2ForRestaurant } from "@/lib/production/legacy-sync";

const BASE_UPLOAD_TEMPLATE_ACCOUNT_ID = "C001";
const DIMENSION_WEIGHT_BPS: Record<string, number> = {
  Auditability: 1000,
  "Cross-System Reconciliation": 2500,
  "Data Completeness": 2500,
  "Data Freshness": 500,
  "Rule Integrity": 2000,
  "Source Authenticity": 1500,
};

type ScopedRestaurant = {
  accountId: string | null;
  address: string | null;
  createdBy: number | null;
  id: number;
  locationId: string;
  modules: LocationModuleState[];
  name: string;
  status: string;
};

type PersistedContractPayload = {
  manualValues?: Record<string, string>;
};

type PersistedUploadValidation = {
  expectedColumns?: number;
  fields?: boolean;
  fileName?: string;
  hash?: boolean;
  hashValue?: string;
  matchedColumns?: number;
  matchPct?: number;
  metrics?: IntakeState["metrics"];
  pageCount?: number;
  rows?: number;
  schema?: boolean;
  sizeBytes?: number;
  unmatchedHeaders?: string[];
  updatedAt?: string;
  uploaded?: boolean;
  vendorKey?: string;
  vendorName?: string;
};

type CertificationExecutionResult = {
  certification: CertificationResult;
  generatedCaarId: number;
  record: CaarRecord;
  restaurant: ScopedRestaurant;
  restaurantStateUpdate: {
    lastCertified: string;
    m01Score: number;
    m02Score: number;
    modules: LocationModuleState[];
    recoveryDisplay: string;
    status: string;
  };
  runIds: number[];
};

function parseModulesJson(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is LocationModuleState =>
          Boolean(item) &&
          typeof item === "object" &&
          "label" in item &&
          "score" in item &&
          "note" in item,
      )
    : [];
}

function getScopedRestaurantWhere(session: SessionState) {
  return session.role === "WGS Manager" || session.role === "SuperAdmin"
    ? {}
    : typeof session.managerId === "number"
      ? { created_by: session.managerId }
      : { id: -1 };
}

function getArtifactStateKey(
  accountId: string,
  locationId: string,
  moduleId: "M01" | "M02",
  artifactKey: string,
  vendorKey?: string | null,
) {
  return `${accountId}:${locationId}:${moduleId}:${artifactKey}:${vendorKey ?? "global"}`;
}

function toJsonValue(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function parseCurrencyToCents(value: string) {
  const numeric = Number(value.replace(/[^0-9.-]/g, "")) || 0;
  return Math.round(numeric * 100);
}

function getActiveModuleIds(
  modules: LocationModuleState[],
  uploadRows: Array<{ module: string }>,
  contractRows: Array<{ module: string }>,
  schemaRows: Array<{ module: string }>,
) {
  const explicit = modules
    .map((module) => module.label)
    .filter((label): label is "M01" | "M02" => label === "M01" || label === "M02");

  if (explicit.length > 0) {
    return [...new Set(explicit)];
  }

  const inferred = [...uploadRows, ...contractRows, ...schemaRows]
    .map((row) => row.module)
    .filter((module): module is "M01" | "M02" => module === "M01" || module === "M02");

  return [...new Set(inferred)];
}

function resolveUploadModulesForAccount(accountId: string, activeModules: Array<"M01" | "M02">) {
  const baseTemplates = uploadModules.filter(
    (module) =>
      module.accountId === BASE_UPLOAD_TEMPLATE_ACCOUNT_ID && activeModules.includes(module.id),
  );

  return baseTemplates.map((module) => ({
    ...module,
    accountId,
    artifacts: module.artifacts.map((artifact) => ({
      ...artifact,
      note: "No upload received yet for this location.",
      status: "Missing" as const,
    })),
  }));
}

function pickLatestByKey<
  T extends { id: number; location_id: number; module: string; vendor: string | null; version?: number | null },
>(rows: T[]) {
  const latest = new Map<string, T>();

  for (const row of rows) {
    const key = `${row.location_id}:${row.module}:${row.vendor ?? "global"}`;
    const existing = latest.get(key);
    const rowVersion = row.version ?? 0;
    const existingVersion = existing?.version ?? 0;

    if (!existing || rowVersion > existingVersion || (rowVersion === existingVersion && row.id > existing.id)) {
      latest.set(key, row);
    }
  }

  return latest;
}

function buildDeterministicRunContext({
  contractRows,
  schemaRows,
  uploadRows,
}: {
  contractRows: Array<{ id: number; sealed_at: Date | null; sha256: string }>;
  schemaRows: Array<{ id: number; sealed_at: Date | null; sha256: string }>;
  uploadRows: Array<{ id: number; sha256: string; uploaded_at: Date | null }>;
}) {
  const timestamps = [
    ...uploadRows.map((row) => row.uploaded_at?.getTime() ?? 0),
    ...schemaRows.map((row) => row.sealed_at?.getTime() ?? 0),
    ...contractRows.map((row) => row.sealed_at?.getTime() ?? 0),
  ].filter((value) => value > 0);

  const evaluationDate = new Date(Math.max(...timestamps, Date.now()));
  const period = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(evaluationDate);
  const periodToken = evaluationDate.toISOString().slice(0, 7).replace("-", "");
  const inputHash = createHash("sha256")
    .update(
      JSON.stringify({
        contractRows: contractRows
          .map((row) => ({ id: row.id, sha256: row.sha256 }))
          .sort((left, right) => left.id - right.id),
        schemaRows: schemaRows
          .map((row) => ({ id: row.id, sha256: row.sha256 }))
          .sort((left, right) => left.id - right.id),
        uploadRows: uploadRows
          .map((row) => ({ id: row.id, sha256: row.sha256 }))
          .sort((left, right) => left.id - right.id),
      }),
    )
    .digest("hex");

  return {
    evaluationDate,
    inputHash,
    period,
    periodToken,
  };
}

function ensureGovernedModules({
  activeModules,
  contractRows,
  schemaRows,
}: {
  activeModules: Array<"M01" | "M02">;
  contractRows: Array<{ module: string }>;
  schemaRows: Array<{ module: string }>;
}) {
  const missingContracts = activeModules.filter(
    (module) => !contractRows.some((row) => row.module === module),
  );
  const missingSchemas = activeModules.filter(
    (module) => !schemaRows.some((row) => row.module === module),
  );

  if (missingContracts.length === 0 && missingSchemas.length === 0) {
    return;
  }

  const messages: string[] = [];
  if (missingContracts.length > 0) {
    messages.push(`missing contract config for ${missingContracts.join(", ")}`);
  }
  if (missingSchemas.length > 0) {
    messages.push(`missing schema registry for ${missingSchemas.join(", ")}`);
  }

  throw new Error(`Certification cannot run yet: ${messages.join("; ")}.`);
}

async function getScopedRestaurant(
  session: SessionState,
  locationId: string,
) {
  const restaurant = await prisma.restaurants.findFirst({
    where: {
      active: true,
      ...getScopedRestaurantWhere(session),
      OR: [
        { unit_id: locationId },
        { store_id: locationId },
        ...(locationId.startsWith("LOC-DB-")
          ? [{ id: Number(locationId.replace("LOC-DB-", "")) || -1 }]
          : []),
      ],
    },
    select: {
      created_by: true,
      id: true,
      location: true,
      name: true,
      store_id: true,
      unit_id: true,
    },
  });

  if (!restaurant) {
    throw new Error("Location not found.");
  }

  const state = await prisma.restaurant_sentry_state.findFirst({
    where: {
      restaurant_id: restaurant.id,
    },
    select: {
      account_id: true,
      location_id: true,
      modules_json: true,
      status: true,
    },
  });

  return {
    accountId: state?.account_id ?? null,
    address: restaurant.location,
    createdBy: restaurant.created_by,
    id: restaurant.id,
    locationId:
      state?.location_id?.trim() ||
      restaurant.unit_id?.trim() ||
      restaurant.store_id?.trim() ||
      `LOC-DB-${restaurant.id}`,
    modules: parseModulesJson(state?.modules_json),
    name: restaurant.name,
    status: state?.status ?? "Onboarding",
  } satisfies ScopedRestaurant;
}

export async function executePersistedCertification({
  cadence = "monthly_final",
  locationId,
  session,
}: {
  cadence?: "monthly_final" | "weekly_preliminary";
  locationId: string;
  session: SessionState;
}): Promise<CertificationExecutionResult> {
  if (typeof session.managerId !== "number") {
    throw new Error("This account is missing a database-backed manager identity.");
  }
  const managerId = session.managerId;

  const restaurant = await getScopedRestaurant(session, locationId);
  if (!restaurant.accountId) {
    throw new Error("This location is missing an account assignment and cannot be certified.");
  }

  const locationV2 = await prisma.$transaction(async (tx) =>
    ensureLocationV2ForRestaurant(tx, {
      accountId: restaurant.accountId,
      address: restaurant.address,
      locationId: restaurant.locationId,
      name: restaurant.name,
    }),
  );

  const [uploadRows, schemaRowsRaw, contractRowsRaw] = await Promise.all([
    prisma.uploads_v2.findMany({
      where: {
        location_id: restaurant.id,
        superseded_by: null,
      },
      orderBy: [{ uploaded_at: "desc" }, { id: "desc" }],
      select: {
        artifact_key: true,
        id: true,
        location_id: true,
        module: true,
        sha256: true,
        uploaded_at: true,
        validation_summary: true,
        vendor: true,
      },
    }),
    prisma.schema_registry_v2.findMany({
      where: {
        location_id: locationV2.id,
      },
      orderBy: [{ version: "desc" }, { id: "desc" }],
      select: {
        id: true,
        location_id: true,
        module: true,
        sealed_at: true,
        sha256: true,
        vendor: true,
        version: true,
      },
    }),
    prisma.contract_configs_v2.findMany({
      where: {
        location_id: locationV2.id,
      },
      orderBy: [{ version: "desc" }, { id: "desc" }],
      select: {
        id: true,
        location_id: true,
        module: true,
        sealed_at: true,
        sha256: true,
        terms: true,
        vendor: true,
        version: true,
      },
    }),
  ]);

  const schemaRows = [...pickLatestByKey(schemaRowsRaw).values()];
  const contractRows = [...pickLatestByKey(contractRowsRaw).values()];
  const activeModules = getActiveModuleIds(restaurant.modules, uploadRows, contractRows, schemaRows);

  if (activeModules.length === 0) {
    throw new Error("This location has no active certification modules configured.");
  }

  ensureGovernedModules({ activeModules, contractRows, schemaRows });

  const artifactIntakeState: Record<string, IntakeState> = {};
  for (const upload of uploadRows) {
    const validation =
      upload.validation_summary && typeof upload.validation_summary === "object"
        ? (upload.validation_summary as unknown as PersistedUploadValidation)
        : null;
    if (!validation) continue;

    artifactIntakeState[
      getArtifactStateKey(
        restaurant.accountId,
        restaurant.locationId,
        upload.module as "M01" | "M02",
        upload.artifact_key,
        upload.vendor,
      )
    ] = {
      expectedColumns: validation.expectedColumns,
      fields: Boolean(validation.fields),
      fileName: validation.fileName,
      hash: Boolean(validation.hash ?? validation.hashValue),
      hashValue: validation.hashValue,
      matchedColumns: validation.matchedColumns,
      matchPct: validation.matchPct,
      metrics: validation.metrics,
      rows: validation.rows,
      schema: Boolean(validation.schema),
      sizeBytes: validation.sizeBytes,
      unmatchedHeaders: validation.unmatchedHeaders,
      updatedAt:
        validation.updatedAt ??
        upload.uploaded_at?.toISOString() ??
        undefined,
      uploaded: Boolean(validation.uploaded),
      vendorKey: validation.vendorKey ?? upload.vendor ?? undefined,
      vendorName: validation.vendorName ?? upload.vendor ?? undefined,
      pageCount: validation.pageCount,
    } as IntakeState;
  }

  const artifactContractState: Record<string, Record<string, string>> = {};
  for (const contract of contractRows) {
    const payload =
      contract.terms && typeof contract.terms === "object"
        ? (contract.terms as unknown as PersistedContractPayload)
        : null;
    const manualValues = payload?.manualValues;
    if (!manualValues) continue;

    const artifactKey = contract.module === "M01" ? "m01-contract" : "m02-contract";
    artifactContractState[
      getArtifactStateKey(
        restaurant.accountId,
        restaurant.locationId,
        contract.module as "M01" | "M02",
        artifactKey,
        contract.vendor,
      )
    ] = manualValues;
  }

  const { evaluationDate, inputHash, period, periodToken } = buildDeterministicRunContext({
    contractRows,
    schemaRows,
    uploadRows,
  });

  const certification = buildCertificationResult({
    artifactContractState,
    artifactIntakeState,
    cadence,
    location: {
      accountId: restaurant.accountId,
      id: restaurant.locationId,
      ium: "--",
      lastCertified: "Pending",
      m01: restaurant.modules.find((module) => module.label === "M01")?.score ?? 0,
      m02: restaurant.modules.find((module) => module.label === "M02")?.score ?? 0,
      market: restaurant.address ?? "",
      modules: restaurant.modules,
      name: restaurant.name,
      recovery: "$0",
      status:
        restaurant.status === "Certified" || restaurant.status === "At Risk" || restaurant.status === "Onboarding"
          ? restaurant.status
          : "Onboarding",
    } satisfies LocationRecord,
    period: cadence === "weekly_preliminary" ? `${period} (Weekly Preliminary)` : period,
    recordId: `CAAR-${periodToken}-${restaurant.locationId.replace(/[^0-9A-Za-z]/g, "")}-${inputHash.slice(0, 8).toUpperCase()}`,
    runAt: evaluationDate,
    uploadModules: resolveUploadModulesForAccount(restaurant.accountId, activeModules),
  });

  const lastCertified = new Date().toISOString().slice(0, 10);
  const restaurantStateUpdate = {
    lastCertified,
    m01Score: certification.updatedModules.find((module) => module.label === "M01")?.score ?? 0,
    m02Score: certification.updatedModules.find((module) => module.label === "M02")?.score ?? 0,
    modules: certification.updatedModules,
    recoveryDisplay: certification.updatedRecovery,
    status: certification.status,
  };

  const { generatedCaarId, runIds } = await prisma.$transaction(async (tx) => {
    await tx.restaurant_sentry_state.upsert({
      where: {
        restaurant_id: restaurant.id,
      },
      update: {
        account_id: restaurant.accountId,
        created_by: managerId,
        last_certified: restaurantStateUpdate.lastCertified,
        location_id: restaurant.locationId,
        m01_score: restaurantStateUpdate.m01Score,
        m02_score: restaurantStateUpdate.m02Score,
        modules_json: toJsonValue(restaurantStateUpdate.modules),
        recovery_display: restaurantStateUpdate.recoveryDisplay,
        status: restaurantStateUpdate.status,
        updated_at: new Date(),
      },
      create: {
        account_id: restaurant.accountId,
        created_by: managerId,
        last_certified: restaurantStateUpdate.lastCertified,
        location_id: restaurant.locationId,
        m01_score: restaurantStateUpdate.m01Score,
        m02_score: restaurantStateUpdate.m02Score,
        modules_json: toJsonValue(restaurantStateUpdate.modules),
        recovery_display: restaurantStateUpdate.recoveryDisplay,
        restaurant_id: restaurant.id,
        status: restaurantStateUpdate.status,
      },
    });

    await tx.caar_reports.upsert({
      where: {
        caar_id: certification.record.id,
      },
      update: {
        account_id: restaurant.accountId,
        amount_cents: parseCurrencyToCents(certification.record.amount),
        amount_display: certification.record.amount,
        created_by: managerId,
        dimensions: toJsonValue(certification.record.dimensions),
        exhibits: certification.record.exhibits,
        findings: toJsonValue(certification.record.findings),
        location_id: certification.record.locationId,
        location_name: certification.record.locationName,
        narrative: certification.record.narrative,
        period: certification.record.period,
        restaurant_id: restaurant.id,
        status: certification.record.status,
        trust_score: certification.record.trustScore,
        updated_at: new Date(),
      },
      create: {
        account_id: restaurant.accountId,
        amount_cents: parseCurrencyToCents(certification.record.amount),
        amount_display: certification.record.amount,
        caar_id: certification.record.id,
        created_by: managerId,
        dimensions: toJsonValue(certification.record.dimensions),
        exhibits: certification.record.exhibits,
        findings: toJsonValue(certification.record.findings),
        location_id: certification.record.locationId,
        location_name: certification.record.locationName,
        narrative: certification.record.narrative,
        period: certification.record.period,
        restaurant_id: restaurant.id,
        status: certification.record.status,
        trust_score: certification.record.trustScore,
      },
    });

    const nextRunIds: number[] = [];
    const runRecords: Array<{
      assessment: (typeof certification.assessments)[number];
      id: number;
      module: "M01" | "M02";
      schemaRegistryIds: number[];
      uploadIds: number[];
      varianceCents: bigint;
    }> = [];

    for (const assessment of certification.assessments) {
      const contract = contractRows
        .filter((row) => row.module === assessment.moduleId)
        .sort((left, right) => right.version - left.version || right.id - left.id)[0];
      const moduleSchemaIds = schemaRows
        .filter((row) => row.module === assessment.moduleId)
        .map((row) => row.id);
      const moduleUploadIds = uploadRows
        .filter((row) => row.module === assessment.moduleId)
        .map((row) => row.id);

      if (!contract) {
        continue;
      }

      const run = await tx.cert_runs_v2.create({
        data: {
          completed_at: new Date(),
          contract_config_id: contract.id,
          error_message:
            cadence === "weekly_preliminary"
              ? `Weekly preliminary run. ${assessment.findings.join(" ")}`
              : assessment.ready
                ? null
                : assessment.findings.join(" "),
          location_id: locationV2.id,
          module: assessment.moduleId,
          period,
          rule_set_version: certification.ruleSetVersion,
          schema_registry_ids: toJsonValue(moduleSchemaIds),
          started_at: new Date(),
          status:
            cadence === "weekly_preliminary"
              ? "completed"
              : assessment.ready
                ? "completed"
                : "needs_remediation",
          trust_score: assessment.score,
          triggered_by: managerId,
          upload_ids: toJsonValue(moduleUploadIds),
          variance_cents: BigInt(Math.round(assessment.recoveryValue * 100)),
        },
        select: {
          id: true,
        },
      });

      nextRunIds.push(run.id);
      const varianceCents = BigInt(Math.round(assessment.recoveryValue * 100));
      runRecords.push({
        assessment,
        id: run.id,
        module: assessment.moduleId,
        schemaRegistryIds: moduleSchemaIds,
        uploadIds: moduleUploadIds,
        varianceCents,
      });

      await tx.mq6_scores_v2.createMany({
        data: Object.entries(assessment.dimensions).map(([dimension, score]) => ({
          cert_run_id: run.id,
          dimension,
          evidence: toJsonValue({
            findings: assessment.findings,
            module: assessment.moduleId,
            score,
            uploadIds: moduleUploadIds,
          }),
          score,
          weight_bps: DIMENSION_WEIGHT_BPS[dimension] ?? 0,
        })),
      });

      if (assessment.ruleCitations.length > 0) {
        await tx.rule_citations_v2.createMany({
          data: assessment.ruleCitations.map((citation) => ({
            cert_run_id: run.id,
            fired_count: citation.firedCount,
            rule_id: citation.ruleId,
            rule_version: citation.ruleVersion,
            sample_evidence: toJsonValue({
              module: assessment.moduleId,
              samples: citation.sampleEvidence,
              uploadIds: moduleUploadIds,
            }),
            variance_cents: BigInt(citation.varianceCents),
          })),
        });
      }

      await tx.audit_log_v2.create({
        data: {
          action: "certification_run_completed",
          actor_user_id: managerId,
          customer_id: locationV2.customer_id,
          entity_id: String(run.id),
          entity_type: "cert_runs_v2",
          location_id: locationV2.id,
          metadata: toJsonValue({
            caarId: certification.record.id,
            cadence,
            findings: assessment.findings,
            module: assessment.moduleId,
            trustScore: assessment.score,
            uploadIds: moduleUploadIds,
          }),
          summary: `Completed ${assessment.moduleId} certification for ${restaurant.name}.`,
        },
      });
    }

    const generatedCaar = await persistGeneratedCaar(tx, {
      certification,
      customerId: locationV2.customer_id,
      locationId: locationV2.id,
      record: certification.record,
      runRecords,
    });

    return {
      generatedCaarId: generatedCaar.id,
      runIds: nextRunIds,
    };
  });

  return {
    certification,
    generatedCaarId,
    record: certification.record,
    restaurant,
    restaurantStateUpdate,
    runIds,
  };
}
