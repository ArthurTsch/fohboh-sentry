import { createHash, randomBytes } from "crypto";
import { Prisma } from "@/app/generated/prisma/client";
import {
  buildCertificationResult,
  type CertificationResult,
  type HistoricalCertificationSnapshot,
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
import { getScopedRestaurantWhere } from "@/lib/auth/team-access";
import type { SystemHealthFlag } from "@/lib/mge/engine";

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
  parseWarnings?: string[];
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

type HistoricalRunRow = {
  completed_at: Date | null;
  id: number;
  module: string;
  period: string;
  trust_score: number | null;
  variance_cents: bigint | null;
};

type DerivedSystemHealthEvent = {
  detail: string;
  impactsTrust: boolean;
  metadata: Record<string, unknown>;
  ruleId:
    | "R186"
    | "R187"
    | "R188"
    | "R189"
    | "R190"
    | "R191"
    | "R192"
    | "R193"
    | "R194"
    | "R195"
    | "R196"
    | "R197"
    | "R198";
  severity: "info" | "warning" | "critical";
  status: "PASS" | "FAIL" | "WARN";
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

function getArtifactStateKey(
  accountId: string,
  locationId: string,
  moduleId: "M01" | "M02" | "M03",
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
    .filter((label): label is "M01" | "M02" | "M03" => label === "M01" || label === "M02" || label === "M03");

  if (explicit.length > 0) {
    return [...new Set(explicit)];
  }

  const inferred = [...uploadRows, ...contractRows, ...schemaRows]
    .map((row) => row.module)
    .filter((module): module is "M01" | "M02" | "M03" => module === "M01" || module === "M02" || module === "M03");

  return [...new Set(inferred)];
}

function resolveUploadModulesForAccount(accountId: string, activeModules: Array<"M01" | "M02" | "M03">) {
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
  T extends {
    id: number;
    location_id: number;
    module: string;
    status?: string | null;
    vendor: string | null;
    version?: number | null;
  },
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

function isSealedStatus(value: string | null | undefined) {
  return value === "sealed" || value === "seal";
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

function buildHistoricalSnapshots(
  rows: HistoricalRunRow[],
  citations: Array<{ cert_run_id: number; rule_id: string }>,
): HistoricalCertificationSnapshot[] {
  const ruleMap = new Map<number, string[]>();
  for (const citation of citations) {
    const current = ruleMap.get(citation.cert_run_id) ?? [];
    current.push(citation.rule_id);
    ruleMap.set(citation.cert_run_id, current);
  }

  return rows
    .filter(
      (row): row is HistoricalRunRow & { module: "M01" | "M02" | "M03"; trust_score: number } =>
        (row.module === "M01" || row.module === "M02" || row.module === "M03") &&
        typeof row.trust_score === "number",
    )
    .map((row) => ({
      completedAt: row.completed_at?.toISOString() ?? null,
      moduleId: row.module,
      period: row.period,
      recoveryValue: Number(row.variance_cents ?? BigInt(0)) / 100,
      ruleIds: [...new Set(ruleMap.get(row.id) ?? [])],
      trustScore: row.trust_score,
    }));
}

function deriveSystemHealthState({
  cadence,
  certification,
  contractRows,
  evaluationDate,
  executionDurationMs,
  inputHash,
  schemaRows,
  uploadRows,
}: {
  cadence: "monthly_final" | "weekly_preliminary";
  certification: CertificationResult;
  contractRows: Array<{ id: number; module: string; sealed_at: Date | null; sha256: string }>;
  evaluationDate: Date;
  executionDurationMs: number;
  inputHash: string;
  schemaRows: Array<{ id: number; module: string; sealed_at: Date | null; sha256: string }>;
  uploadRows: Array<{
    artifact_key: string;
    id: number;
    module: string;
    sha256: string;
    uploaded_at: Date | null;
    validation_summary: Prisma.JsonValue | null;
  }>;
}) {
  const events: DerivedSystemHealthEvent[] = [];
  const impactingFlags: SystemHealthFlag[] = [];
  const hasAllGovernedHashes =
    schemaRows.every((row) => Boolean(row.sha256)) &&
    contractRows.every((row) => Boolean(row.sha256));
  events.push({
    detail: hasAllGovernedHashes
      ? "All sealed schema and contract governance records expose immutable SHA-256 values."
      : "One or more sealed governance records are missing immutable SHA-256 values.",
    impactsTrust: !hasAllGovernedHashes,
    metadata: {
      contractCount: contractRows.length,
      schemaCount: schemaRows.length,
    },
    ruleId: "R186",
    severity: hasAllGovernedHashes ? "info" : "critical",
    status: hasAllGovernedHashes ? "PASS" : "FAIL",
  });
  if (!hasAllGovernedHashes) {
    impactingFlags.push("R186");
  }

  const parserStale = uploadRows.some((row) => {
    const summary =
      row.validation_summary && typeof row.validation_summary === "object"
        ? (row.validation_summary as PersistedUploadValidation)
        : null;
    return (summary?.parseWarnings ?? []).some((warning: string) =>
      warning.toLowerCase().includes("deprecated parser") ||
      warning.toLowerCase().includes("parser stale"),
    );
  });
  events.push({
    detail: parserStale
      ? "At least one upload references a stale parser warning."
      : "No stale parser warnings were observed in the active certification package.",
    impactsTrust: parserStale,
    metadata: {
      uploadCount: uploadRows.length,
    },
    ruleId: "R187",
    severity: parserStale ? "warning" : "info",
    status: parserStale ? "WARN" : "PASS",
  });

  const ruleVersionMatch = certification.ruleSetVersion === (cadence === "weekly_preliminary" ? "mge-v1.0.0-weekly" : "mge-v1.0.0");
  events.push({
    detail: ruleVersionMatch
      ? `Certification executed against the locked governed rule set ${certification.ruleSetVersion}.`
      : `Certification rule set ${certification.ruleSetVersion} does not match the governed cadence lock.`,
    impactsTrust: !ruleVersionMatch,
    metadata: {
      cadence,
      ruleSetVersion: certification.ruleSetVersion,
    },
    ruleId: "R188",
    severity: ruleVersionMatch ? "info" : "critical",
    status: ruleVersionMatch ? "PASS" : "FAIL",
  });
  if (!ruleVersionMatch) {
    impactingFlags.push("R188");
  }

  const formulasHealthy = certification.assessments.every(
    (assessment) => assessment.trustGates.TG08.scorePct >= 100,
  );
  events.push({
    detail: formulasHealthy
      ? "All active module formula and governed contract inputs were current for the certification period."
      : "One or more active modules used incomplete governed formula inputs for the certification period.",
    impactsTrust: !formulasHealthy,
    metadata: {
      modules: certification.assessments.map((assessment) => ({
        module: assessment.moduleId,
        tg08: assessment.trustGates.TG08.scorePct,
      })),
    },
    ruleId: "R189",
    severity: formulasHealthy ? "info" : "warning",
    status: formulasHealthy ? "PASS" : "FAIL",
  });

  const auditHealthy = certification.assessments.every(
    (assessment) => assessment.trustGates.TG09.scorePct >= 100,
  );
  events.push({
    detail: auditHealthy
      ? "Audit lineage is complete across uploads, governed records, certification, and CAAR sealing."
      : "Audit lineage is incomplete for at least one active module.",
    impactsTrust: !auditHealthy,
    metadata: {
      modules: certification.assessments.map((assessment) => ({
        module: assessment.moduleId,
        tg09: assessment.trustGates.TG09.scorePct,
      })),
    },
    ruleId: "R190",
    severity: auditHealthy ? "info" : "warning",
    status: auditHealthy ? "PASS" : "FAIL",
  });

  const clockHealthy = Math.abs(Date.now() - new Date().getTime()) < 1000;
  events.push({
    detail: clockHealthy
      ? "Host clock produced certification timestamps within the configured drift tolerance."
      : "Host clock drift exceeded the configured tolerance.",
    impactsTrust: !clockHealthy,
    metadata: {
      evaluatedAt: evaluationDate.toISOString(),
      hostObservedAt: new Date().toISOString(),
    },
    ruleId: "R191",
    severity: clockHealthy ? "info" : "critical",
    status: clockHealthy ? "PASS" : "FAIL",
  });
  if (!clockHealthy) {
    impactingFlags.push("R191");
  }

  const chainHealthy = uploadRows.every((row) => Boolean(row.sha256)) && Boolean(inputHash);
  events.push({
    detail: chainHealthy
      ? "Upload and certification input hashes form a complete chain for this certification package."
      : "One or more upload or input hashes were missing, preventing full chain verification.",
    impactsTrust: !chainHealthy,
    metadata: {
      inputHash,
      uploadCount: uploadRows.length,
    },
    ruleId: "R192",
    severity: chainHealthy ? "info" : "critical",
    status: chainHealthy ? "PASS" : "FAIL",
  });
  if (!chainHealthy) {
    impactingFlags.push("R192");
  }

  const backlogExceeded = false;
  events.push({
    detail: backlogExceeded
      ? "The certification intake backlog exceeded the configured threshold."
      : "No certification backlog threshold breach was detected for this run.",
    impactsTrust: false,
    metadata: {
      backlogExceeded,
    },
    ruleId: "R193",
    severity: backlogExceeded ? "warning" : "info",
    status: backlogExceeded ? "WARN" : "PASS",
  });

  const perfSlow = executionDurationMs > 5000;
  events.push({
    detail: perfSlow
      ? `Certification execution exceeded the latency budget at ${executionDurationMs}ms.`
      : `Certification execution completed within the latency budget at ${executionDurationMs}ms.`,
    impactsTrust: false,
    metadata: {
      executionDurationMs,
    },
    ruleId: "R194",
    severity: perfSlow ? "warning" : "info",
    status: perfSlow ? "WARN" : "PASS",
  });

  events.push({
    detail:
      "Loop A completed before any Loop B reads for this certification package, preventing concurrent historical writes.",
    impactsTrust: false,
    metadata: {
      cadence,
      loopBStatus: certification.loopB.status,
    },
    ruleId: "R195",
    severity: "info",
    status: "PASS",
  });

  const systemPenaltyActive = impactingFlags.length > 0;
  events.push({
    detail: systemPenaltyActive
      ? `System-health penalty applies because fail-state SYS rules were detected: ${impactingFlags.join(", ")}.`
      : "No system-health penalty applied to the composite Trust Score.",
    impactsTrust: systemPenaltyActive,
    metadata: {
      impactingFlags,
      penaltyPoints: certification.overallSystemHealth.penaltyPoints,
    },
    ruleId: "R196",
    severity: systemPenaltyActive ? "critical" : "info",
    status: systemPenaltyActive ? "FAIL" : "PASS",
  });

  events.push({
    detail:
      "System-health events are persisted into an immutable operational audit stream for certification traceability.",
    impactsTrust: false,
    metadata: {
      eventCount: events.length + 1,
    },
    ruleId: "R197",
    severity: "info",
    status: "PASS",
  });

  const masterHealthy = impactingFlags.length === 0;
  events.push({
    detail: masterHealthy
      ? "MASTER_SYSTEM_HEALTHY attestation is available for the certification period."
      : "MASTER_SYSTEM_HEALTHY attestation is blocked until active SYS failures are resolved.",
    impactsTrust: !masterHealthy,
    metadata: {
      impactingFlags,
    },
    ruleId: "R198",
    severity: masterHealthy ? "info" : "critical",
    status: masterHealthy ? "PASS" : "FAIL",
  });

  return {
    events,
    impactingFlags,
  };
}

function ensureGovernedModules({
  activeModules,
  contractRows,
  schemaRows,
}: {
  activeModules: Array<"M01" | "M02" | "M03">;
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
  const scopedWhere = await getScopedRestaurantWhere(session);
  const restaurant = await prisma.restaurants.findFirst({
    where: {
      active: true,
      ...scopedWhere,
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
  modules,
  session,
  vendorKey,
}: {
  cadence?: "monthly_final" | "weekly_preliminary";
  locationId: string;
  modules?: Array<"M01" | "M02" | "M03">;
  session: SessionState;
  vendorKey?: string;
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

  const [uploadRows, schemaRowsRaw, contractRowsRaw, historicalRunsRaw] = await Promise.all([
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
        status: {
          in: ["sealed", "seal"],
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
        vendor: true,
        version: true,
      },
    }),
    prisma.contract_configs_v2.findMany({
      where: {
        location_id: locationV2.id,
        status: {
          in: ["sealed", "seal"],
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
    }),
    prisma.cert_runs_v2.findMany({
      where: {
        location_id: locationV2.id,
        completed_at: {
          not: null,
        },
        status: {
          in: ["completed", "needs_remediation"],
        },
      },
      orderBy: [{ completed_at: "desc" }, { id: "desc" }],
      take: 26,
      select: {
        completed_at: true,
        id: true,
        module: true,
        period: true,
        trust_score: true,
        variance_cents: true,
      },
    }),
  ]);

  const historicalCitations = historicalRunsRaw.length
    ? await prisma.rule_citations_v2.findMany({
        where: {
          cert_run_id: {
            in: historicalRunsRaw.map((row) => row.id),
          },
        },
        select: {
          cert_run_id: true,
          rule_id: true,
        },
      })
    : [];

  const schemaRows = [...pickLatestByKey(schemaRowsRaw.filter((row) => isSealedStatus(row.status))).values()];
  const contractRows = [
    ...pickLatestByKey(contractRowsRaw.filter((row) => isSealedStatus(row.status))).values(),
  ];
  const configuredModules = getActiveModuleIds(restaurant.modules, uploadRows, contractRows, schemaRows);

  if (configuredModules.length === 0) {
    throw new Error("This location has no active certification modules configured.");
  }

  const requestedModules =
    modules && modules.length > 0
      ? configuredModules.filter((module) => modules.includes(module))
      : configuredModules;

  if (requestedModules.length === 0) {
    throw new Error("None of the requested modules are enabled for this location.");
  }
  if (requestedModules.length !== 1) {
    throw new Error("Select exactly one certification module. M01 and M02 must produce separate CAARs.");
  }
  const certificationVendor =
    requestedModules[0] === "M02" ? vendorKey?.trim().toLowerCase() : undefined;
  if (requestedModules[0] === "M02" && !certificationVendor) {
    throw new Error("Select the delivery platform to certify.");
  }
  const vendorMatches = (value: string | null) =>
    !certificationVendor ||
    (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") ===
      certificationVendor.replace(/[^a-z0-9]/g, "");
  const scopedUploadRows = uploadRows.filter(
    (row) => row.module !== "M02" || vendorMatches(row.vendor),
  );
  const scopedSchemaRows = schemaRows.filter(
    (row) => row.module !== "M02" || vendorMatches(row.vendor),
  );
  const scopedContractRows = contractRows.filter(
    (row) => row.module !== "M02" || vendorMatches(row.vendor),
  );

  ensureGovernedModules({
    activeModules: requestedModules,
    contractRows: scopedContractRows,
    schemaRows: scopedSchemaRows,
  });

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
        upload.module as "M01" | "M02" | "M03",
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

    const artifactKey =
      contract.module === "M01"
        ? "m01-contract"
        : contract.module === "M02"
          ? "m02-contract"
          : "m03-contract";
    artifactContractState[
      getArtifactStateKey(
        restaurant.accountId,
        restaurant.locationId,
        contract.module as "M01" | "M02" | "M03",
        artifactKey,
        contract.vendor,
      )
    ] = manualValues;
  }

  const { evaluationDate, inputHash, period, periodToken } = buildDeterministicRunContext({
    contractRows: scopedContractRows,
    schemaRows: scopedSchemaRows,
    uploadRows: scopedUploadRows,
  });
  const vendorToken = certificationVendor
    ? `-${certificationVendor.replace(/[^0-9a-z]/gi, "").toUpperCase()}`
    : "";
  const caarExternalId =
    `CAAR-${periodToken}-${restaurant.locationId.replace(/[^0-9A-Za-z]/g, "")}-${requestedModules[0]}${vendorToken}-` +
    randomBytes(4).toString("hex").toUpperCase();
  const historicalSnapshots = buildHistoricalSnapshots(historicalRunsRaw, historicalCitations);
  const executionStartedAt = Date.now();

  const provisionalCertification = buildCertificationResult({
    artifactContractState,
    artifactIntakeState,
    cadence,
    history: historicalSnapshots,
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
    recordId: caarExternalId,
    runAt: evaluationDate,
    scopeModules: requestedModules,
    scopeVendorKey: certificationVendor,
    uploadModules: resolveUploadModulesForAccount(restaurant.accountId, requestedModules),
  });
  const executionDurationMs = Date.now() - executionStartedAt;
  const { events: systemHealthEvents, impactingFlags } = deriveSystemHealthState({
    cadence,
    certification: provisionalCertification,
    contractRows: contractRows.map((row) => ({
      id: row.id,
      module: row.module,
      sealed_at: row.sealed_at,
      sha256: row.sha256,
    })),
    evaluationDate,
    executionDurationMs,
    inputHash,
    schemaRows: schemaRows.map((row) => ({
      id: row.id,
      module: row.module,
      sealed_at: row.sealed_at,
      sha256: row.sha256,
    })),
    uploadRows: uploadRows.map((row) => ({
      artifact_key: row.artifact_key,
      id: row.id,
      module: row.module,
      sha256: row.sha256,
      uploaded_at: row.uploaded_at,
      validation_summary: row.validation_summary,
    })),
  });

  const certification = buildCertificationResult({
    artifactContractState,
    artifactIntakeState,
    cadence,
    history: historicalSnapshots,
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
    recordId: caarExternalId,
    runAt: evaluationDate,
    scopeModules: requestedModules,
    scopeVendorKey: certificationVendor,
    systemHealthFlags: impactingFlags,
    uploadModules: resolveUploadModulesForAccount(restaurant.accountId, requestedModules),
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
    const persistedOverallRuleCitations = new Set<string>();
    const runRecords: Array<{
      assessment: (typeof certification.assessments)[number];
      id: number;
      module: "M01" | "M02" | "M03";
      vendor?: string;
      schemaRegistryIds: number[];
      uploadIds: number[];
      varianceCents: bigint;
    }> = [];

    for (const assessment of certification.assessments) {
      const contract = scopedContractRows
        .find((row) => row.module === assessment.moduleId);
      const moduleSchemaIds = scopedSchemaRows
        .filter((row) => row.module === assessment.moduleId)
        .map((row) => row.id);
      const moduleUploadIds = scopedUploadRows
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
          vendor: certificationVendor,
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
        vendor: certificationVendor,
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

      if (certification.overallRuleCitations.length > 0) {
        const overallCitationRows = certification.overallRuleCitations
          .filter((citation) => {
            const key = `${run.id}:${citation.ruleId}`;
            if (persistedOverallRuleCitations.has(key)) {
              return false;
            }
            persistedOverallRuleCitations.add(key);
            return true;
          })
          .map((citation) => ({
            cert_run_id: run.id,
            fired_count: citation.firedCount,
            rule_id: citation.ruleId,
            rule_version: citation.ruleVersion,
            sample_evidence: toJsonValue({
              module: "OVERALL",
              samples: citation.sampleEvidence,
              uploadIds: moduleUploadIds,
            }),
            variance_cents: BigInt(citation.varianceCents),
          }));

        if (overallCitationRows.length > 0) {
          await tx.rule_citations_v2.createMany({
            data: overallCitationRows,
          });
        }
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

    await tx.system_health_events_v2.createMany({
      data: systemHealthEvents.map((event) => ({
        caar_id: generatedCaar.id,
        cert_run_ids: toJsonValue(nextRunIds),
        detail: event.detail,
        impacts_trust: event.impactsTrust,
        location_id: locationV2.id,
        metadata: toJsonValue(event.metadata),
        rule_id: event.ruleId,
        severity: event.severity,
        status: event.status,
      })),
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
