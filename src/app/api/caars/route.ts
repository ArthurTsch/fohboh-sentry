import { NextResponse } from "next/server";
import { requireManagerSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import type {
  CaarEvidenceTrace,
  CaarFieldAudit,
  CaarProvenanceKind,
  CaarRecord,
  CaarRuleCitationSummary,
} from "@/components/sentry/types";
import { getScopedRestaurantIds } from "@/lib/auth/team-access";

function parseCurrencyToCents(value: string) {
  const numeric = Number(value.replace(/[^0-9.-]/g, "")) || 0;
  return Math.round(numeric * 100);
}

function formatCentsToCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(cents / 100);
}

function isCaarDimensionArray(value: unknown): value is CaarRecord["dimensions"] {
  return Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function formatVarianceDisplay(cents: bigint | number | null | undefined) {
  const numeric = typeof cents === "bigint" ? Number(cents) : Number(cents ?? 0);
  return formatCentsToCurrency(numeric);
}

function getArtifactLabel(moduleId: "M01" | "M02", artifactKey: string) {
  const normalized = artifactKey.toLowerCase();
  if (normalized.endsWith("processor")) return "Processor Source Statement";
  if (normalized.endsWith("settlement")) return "DSP Settlement Source";
  if (normalized.endsWith("pos")) return moduleId === "M01" ? "POS Export CSV" : "POS Summary / Export";
  if (normalized.endsWith("agreement")) return moduleId === "M01" ? "Signed Merchant Agreement" : "Signed DSP Agreement";
  if (normalized.endsWith("bank")) return moduleId === "M01" ? "Bank Statement" : "Bank Deposit Evidence";
  return artifactKey;
}

function getExpectedArtifactKeys(moduleId: "M01" | "M02") {
  return moduleId === "M01"
    ? ["m01-processor", "m01-pos", "m01-agreement", "m01-bank"]
    : ["m02-settlement", "m02-pos", "m02-agreement", "m02-bank"];
}

function buildFieldAuditRows({
  amount,
  certCompletedAt,
  certRunId,
  courtAdmissible,
  moduleId,
  record,
  ruleCitationCount,
  ruleSetVersion,
  sealedAt,
  sealedContract,
  sealedSchema,
}: {
  amount: string;
  certCompletedAt: string | null;
  certRunId: number | null;
  courtAdmissible: boolean | null;
  moduleId: "M01" | "M02" | null;
  record: {
    caarId: string;
    period: string;
    status: string;
    trustScore: number;
  };
  ruleCitationCount: number;
  ruleSetVersion: string | null;
  sealedAt: string | null;
  sealedContract: { id: number; vendor: string; version: number } | null;
  sealedSchema: { id: number; vendor: string; version: number } | null;
}): CaarFieldAudit[] {
  return [
    {
      field: "CAAR ID",
      provenance: "rule_engine",
      supported: true,
      trace: "Persisted CAAR record",
      value: record.caarId,
    },
    {
      field: "Module",
      provenance: moduleId ? "rule_engine" : "synthetic",
      supported: Boolean(moduleId),
      trace: moduleId ? "caars_v2.module" : "Module could not be resolved from persisted CAAR state",
      value: moduleId ?? "Unknown",
    },
    {
      field: "Certification Period",
      provenance: "rule_engine",
      supported: true,
      trace: "Persisted CAAR period",
      value: record.period,
    },
    {
      field: "Trust Score",
      provenance: "rule_engine",
      supported: true,
      trace: certRunId ? `cert_runs_v2#${certRunId}` : "Persisted CAAR summary",
      value: String(record.trustScore),
    },
    {
      field: "Certified Variance",
      provenance: "rule_engine",
      supported: true,
      trace: certRunId ? `cert_runs_v2#${certRunId}` : "Persisted CAAR summary",
      value: amount,
    },
    {
      field: "Status",
      provenance: "rule_engine",
      supported: true,
      trace: courtAdmissible === null ? "Persisted CAAR summary" : "caars_v2.court_admissible + status",
      value: record.status,
    },
    {
      field: "Rule Set Version",
      provenance: ruleSetVersion ? "rule_engine" : "synthetic",
      supported: Boolean(ruleSetVersion),
      trace: ruleSetVersion && certRunId ? `cert_runs_v2#${certRunId}` : "No persisted cert run rule-set version found",
      value: ruleSetVersion ?? "Not persisted",
    },
    {
      field: "Certification Sealed At",
      provenance: sealedAt ? "rule_engine" : "synthetic",
      supported: Boolean(sealedAt),
      trace: sealedAt ? "caars_v2.sealed_at" : "No sealed CAAR timestamp found",
      value: sealedAt ?? certCompletedAt ?? "Not persisted",
    },
    {
      field: "Schema Registry",
      provenance: sealedSchema ? "sealed_config" : "synthetic",
      supported: Boolean(sealedSchema),
      trace: sealedSchema
        ? `schema_registry_v2#${sealedSchema.id}`
        : "No sealed schema registry record found for this module",
      value: sealedSchema
        ? `${sealedSchema.vendor} v${sealedSchema.version}`
        : "Not sealed for this module",
    },
    {
      field: "Contract Config",
      provenance: sealedContract ? "sealed_config" : "synthetic",
      supported: Boolean(sealedContract),
      trace: sealedContract
        ? `contract_configs_v2#${sealedContract.id}`
        : "No sealed contract config record found for this module",
      value: sealedContract
        ? `${sealedContract.vendor} v${sealedContract.version}`
        : "Not sealed for this module",
    },
    {
      field: "Rule Citations",
      provenance: "rule_engine",
      supported: true,
      trace: certRunId ? `rule_citations_v2 via cert_runs_v2#${certRunId}` : "No persisted cert run linked",
      value: `${ruleCitationCount} persisted rule citations`,
    },
  ];
}

function buildRuleCitationSummaries(
  rows: Array<{
    fired_count: number;
    rule_id: string;
    rule_version: string;
    sample_evidence: unknown;
    variance_cents: bigint;
  }>,
): CaarRuleCitationSummary[] {
  return rows.map((row) => ({
    firedCount: row.fired_count,
    ruleId: row.rule_id,
    ruleVersion: row.rule_version,
    sampleEvidenceCount: Array.isArray(row.sample_evidence) ? row.sample_evidence.length : 0,
    varianceDisplay: formatVarianceDisplay(row.variance_cents),
  }));
}

function buildEvidenceRows({
  moduleId,
  uploads,
}: {
  moduleId: "M01" | "M02";
  uploads: Array<{
    artifact_key: string;
    file_name: string;
    id: number;
    page_count: number | null;
    row_count: number | null;
    sha256: string;
    uploaded_at: Date | null;
    validation_summary: unknown;
    vendor: string | null;
  }>;
}): CaarEvidenceTrace[] {
  const latestByArtifact = new Map<string, (typeof uploads)[number]>();
  for (const upload of uploads) {
    const key = `${upload.artifact_key}:${upload.vendor ?? "global"}`;
    if (!latestByArtifact.has(key)) {
      latestByArtifact.set(key, upload);
    }
  }

  const evidenceRows: CaarEvidenceTrace[] = [...latestByArtifact.values()].map((upload) => {
    const validation =
      upload.validation_summary && typeof upload.validation_summary === "object"
        ? (upload.validation_summary as {
            fields?: boolean;
            matchPct?: number;
            pageCount?: number;
            parseWarnings?: string[];
            rows?: number;
            schema?: boolean;
            unmatchedHeaders?: string[];
          })
        : null;
    const schemaOk = Boolean(validation?.schema);
    const fieldsOk = Boolean(validation?.fields);
    const notes = [
      ...(Array.isArray(validation?.parseWarnings) ? validation.parseWarnings : []),
      ...(Array.isArray(validation?.unmatchedHeaders)
        ? validation.unmatchedHeaders.slice(0, 8).map((header) => `Unmatched header: ${header}`)
        : []),
    ];
    const status: CaarEvidenceTrace["status"] =
      schemaOk && fieldsOk ? "provided" : upload.sha256 ? "review" : "missing";

    return {
      artifactKey: upload.artifact_key,
      fileName: upload.file_name,
      label: getArtifactLabel(moduleId, upload.artifact_key),
      matchPct: typeof validation?.matchPct === "number" ? validation.matchPct : null,
      notes,
      pageCount: validation?.pageCount ?? upload.page_count ?? null,
      provenance: "direct_upload",
      rows: validation?.rows ?? upload.row_count ?? null,
      schemaOk,
      sha256: upload.sha256 ?? null,
      status,
      trace: `uploads_v2#${upload.id}`,
      uploadedAt: upload.uploaded_at?.toISOString() ?? null,
      vendor: upload.vendor ?? null,
    } satisfies CaarEvidenceTrace;
  });

  const existingKeys = new Set(evidenceRows.map((row) => row.artifactKey));
  for (const artifactKey of getExpectedArtifactKeys(moduleId)) {
    if (existingKeys.has(artifactKey)) continue;
    evidenceRows.push({
      artifactKey,
      fileName: null,
      label: getArtifactLabel(moduleId, artifactKey),
      matchPct: null,
      notes: ["Required source document is not persisted for this CAAR module."],
      pageCount: null,
      provenance: "direct_upload",
      rows: null,
      schemaOk: false,
      sha256: null,
      status: "missing",
      trace: "No persisted upload found",
      uploadedAt: null,
      vendor: null,
    });
  }

  return evidenceRows.sort((left, right) => left.label.localeCompare(right.label));
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

export async function GET(request: Request) {
  try {
    await request;
    const session = await requireManagerSession();
    const scopedRestaurantIds = await getScopedRestaurantIds(session);

    const reports = await prisma.caar_reports.findMany({
      where: {
        ...(session.role === "WGS Manager" || session.role === "SuperAdmin"
          ? {}
          : Array.isArray(scopedRestaurantIds)
            ? scopedRestaurantIds.length > 0
              ? { restaurant_id: { in: scopedRestaurantIds } }
              : { id: -1 }
            : { id: -1 }),
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      select: {
        account_id: true,
        amount_cents: true,
        amount_display: true,
        caar_id: true,
        created_at: true,
        created_by: true,
        dimensions: true,
        exhibits: true,
        findings: true,
        location_id: true,
        location_name: true,
        narrative: true,
        period: true,
        restaurant_id: true,
        status: true,
        trust_score: true,
      },
    });

    const caarIds = reports.map((report) => report.caar_id);
    const persistedCaars = caarIds.length
      ? await prisma.caars_v2.findMany({
          where: {
            caar_external_id: {
              in: caarIds,
            },
          },
          select: {
            caar_external_id: true,
            cert_run_id: true,
            court_admissible: true,
            location_id: true,
            module: true,
            sealed_at: true,
            status: true,
          },
        })
      : [];
    const persistedCaarById = new Map(persistedCaars.map((row) => [row.caar_external_id, row]));
    const certRunIds = persistedCaars.map((row) => row.cert_run_id);
    const governedLocationIds = [...new Set(persistedCaars.map((row) => row.location_id))];
    const uploadRestaurantIds = [...new Set(reports.map((row) => row.restaurant_id).filter((value): value is number => typeof value === "number"))];

    const [certRuns, ruleCitations, uploads, sealedSchemas, sealedContracts] = await Promise.all([
      certRunIds.length
        ? prisma.cert_runs_v2.findMany({
            where: {
              id: {
                in: certRunIds,
              },
            },
            select: {
              completed_at: true,
              id: true,
              module: true,
              rule_set_version: true,
              status: true,
              trust_score: true,
              variance_cents: true,
            },
          })
        : Promise.resolve([]),
      certRunIds.length
        ? prisma.rule_citations_v2.findMany({
            where: {
              cert_run_id: {
                in: certRunIds,
              },
            },
            orderBy: [{ rule_id: "asc" }],
            select: {
              cert_run_id: true,
              fired_count: true,
              rule_id: true,
              rule_version: true,
              sample_evidence: true,
              variance_cents: true,
            },
          })
        : Promise.resolve([]),
      uploadRestaurantIds.length
        ? prisma.uploads_v2.findMany({
            where: {
              location_id: {
                in: uploadRestaurantIds,
              },
              superseded_by: null,
            },
            orderBy: [{ uploaded_at: "desc" }, { id: "desc" }],
            select: {
              artifact_key: true,
              file_name: true,
              id: true,
              location_id: true,
              module: true,
              page_count: true,
              row_count: true,
              sha256: true,
              uploaded_at: true,
              validation_summary: true,
              vendor: true,
            },
          })
        : Promise.resolve([]),
      governedLocationIds.length
        ? prisma.schema_registry_v2.findMany({
            where: {
              location_id: {
                in: governedLocationIds,
              },
              status: {
                in: ["sealed", "seal"],
              },
            },
            orderBy: [{ version: "desc" }, { id: "desc" }],
            select: {
              id: true,
              location_id: true,
              module: true,
              vendor: true,
              version: true,
            },
          })
        : Promise.resolve([]),
      governedLocationIds.length
        ? prisma.contract_configs_v2.findMany({
            where: {
              location_id: {
                in: governedLocationIds,
              },
              status: {
                in: ["sealed", "seal"],
              },
            },
            orderBy: [{ version: "desc" }, { id: "desc" }],
            select: {
              id: true,
              location_id: true,
              module: true,
              vendor: true,
              version: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const certRunById = new Map(certRuns.map((row) => [row.id, row]));
    const ruleCitationsByRun = new Map<number, typeof ruleCitations>();
    for (const citation of ruleCitations) {
      const current = ruleCitationsByRun.get(citation.cert_run_id) ?? [];
      current.push(citation);
      ruleCitationsByRun.set(citation.cert_run_id, current);
    }

    return NextResponse.json({
      reports: reports.map((report) => {
        const persistedCaar = persistedCaarById.get(report.caar_id) ?? null;
        const moduleId =
          persistedCaar?.module === "M01" || persistedCaar?.module === "M02" ? persistedCaar.module : null;
        const certRun = persistedCaar ? certRunById.get(persistedCaar.cert_run_id) ?? null : null;
        const citations = certRun ? ruleCitationsByRun.get(certRun.id) ?? [] : [];
        const uploadLocationId = report.restaurant_id ?? null;
        const moduleUploads =
          uploadLocationId && moduleId
            ? uploads.filter((upload) => upload.location_id === uploadLocationId && upload.module === moduleId)
            : [];
        const sealedSchema =
          persistedCaar && moduleId
            ? sealedSchemas.find((row) => row.location_id === persistedCaar.location_id && row.module === moduleId) ?? null
            : null;
        const sealedContract =
          persistedCaar && moduleId
            ? sealedContracts.find((row) => row.location_id === persistedCaar.location_id && row.module === moduleId) ?? null
            : null;
        const amount = report.amount_display || formatCentsToCurrency(report.amount_cents);

        return {
          accountId: report.account_id,
          amount,
          createdAt: report.created_at?.toISOString() ?? null,
          createdBy: report.created_by,
          dimensions: isCaarDimensionArray(report.dimensions) ? report.dimensions : [],
          exhibits: report.exhibits ?? 0,
          findings: isStringArray(report.findings) ? report.findings : [],
          id: report.caar_id,
          locationId: report.location_id,
          locationName: report.location_name,
          narrative: report.narrative,
          period: report.period,
          restaurantId: report.restaurant_id,
          status: report.status as CaarRecord["status"],
          traceability: {
            certCompletedAt: certRun?.completed_at?.toISOString() ?? null,
            certRunId: certRun?.id ?? null,
            courtAdmissible: persistedCaar?.court_admissible ?? null,
            evidence: moduleId ? buildEvidenceRows({ moduleId, uploads: moduleUploads }) : [],
            fieldAudit: buildFieldAuditRows({
              amount,
              certCompletedAt: certRun?.completed_at?.toISOString() ?? null,
              certRunId: certRun?.id ?? null,
              courtAdmissible: persistedCaar?.court_admissible ?? null,
              moduleId,
              record: {
                caarId: report.caar_id,
                period: report.period,
                status: report.status,
                trustScore: report.trust_score,
              },
              ruleCitationCount: citations.length,
              ruleSetVersion: certRun?.rule_set_version ?? null,
              sealedAt: persistedCaar?.sealed_at?.toISOString() ?? null,
              sealedContract,
              sealedSchema,
            }),
            module: moduleId,
            ruleCitations: buildRuleCitationSummaries(citations),
            ruleSetVersion: certRun?.rule_set_version ?? null,
            sealedAt: persistedCaar?.sealed_at?.toISOString() ?? null,
          },
          trustScore: report.trust_score,
        };
      }),
    });
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    console.error("Fetch CAAR reports failed:", error);
    return NextResponse.json(
      { error: "Unable to load CAAR reports right now." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireManagerSession();
    if (session.role === "Viewer") {
      return NextResponse.json({ error: "This account cannot save CAAR reports." }, { status: 403 });
    }

    const body = (await request.json()) as {
      accountId?: string | null;
      managerId?: number | null;
      record?: CaarRecord | null;
    };

    if (!body.record) {
      return NextResponse.json({ error: "CAAR record is required." }, { status: 400 });
    }

    const record = body.record;
    const restaurant =
      record.locationId.startsWith("LOC-DB-")
        ? await prisma.restaurants.findFirst({
            where: {
              id: Number(record.locationId.replace("LOC-DB-", "")) || -1,
            },
            select: {
              created_by: true,
              id: true,
            },
          })
        : await prisma.restaurants.findFirst({
            where: {
              OR: [
                { unit_id: record.locationId },
                { store_id: record.locationId },
              ],
            },
            select: {
              created_by: true,
              id: true,
            },
          });

    const saved = await prisma.caar_reports.upsert({
      where: {
        caar_id: record.id,
      },
      update: {
        account_id:
          session.role === "WGS Manager"
            ? body.accountId ?? record.accountId ?? null
            : session.accountId ?? body.accountId ?? record.accountId ?? null,
        amount_cents: parseCurrencyToCents(record.amount),
        amount_display: record.amount,
        created_by: typeof session.managerId === "number" ? session.managerId : (restaurant?.created_by ?? null),
        dimensions: record.dimensions,
        exhibits: record.exhibits,
        findings: record.findings,
        location_id: record.locationId,
        location_name: record.locationName,
        narrative: record.narrative,
        period: record.period,
        restaurant_id: restaurant?.id ?? null,
        status: record.status,
        trust_score: record.trustScore,
        updated_at: new Date(),
      },
      create: {
        account_id:
          session.role === "WGS Manager"
            ? body.accountId ?? record.accountId ?? null
            : session.accountId ?? body.accountId ?? record.accountId ?? null,
        amount_cents: parseCurrencyToCents(record.amount),
        amount_display: record.amount,
        caar_id: record.id,
        created_by: typeof session.managerId === "number" ? session.managerId : (restaurant?.created_by ?? null),
        dimensions: record.dimensions,
        exhibits: record.exhibits,
        findings: record.findings,
        location_id: record.locationId,
        location_name: record.locationName,
        narrative: record.narrative,
        period: record.period,
        restaurant_id: restaurant?.id ?? null,
        status: record.status,
        trust_score: record.trustScore,
      },
      select: {
        caar_id: true,
        id: true,
      },
    });

    return NextResponse.json({
      ok: true,
      report: saved,
    });
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    console.error("Save CAAR report failed:", error);
    return NextResponse.json(
      { error: "Unable to save the CAAR report right now." },
      { status: 500 },
    );
  }
}
