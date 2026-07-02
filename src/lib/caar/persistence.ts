import { createHash } from "crypto";
import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";
import type {
  CertificationResult,
  ModuleAssessment,
} from "@/components/sentry/caar-engine";
import type { CaarRecord } from "@/components/sentry/types";
import { readArtifactBlob, persistArtifactBlob } from "@/lib/uploads/storage";

type TxClient = PrismaClient | Prisma.TransactionClient;

type RunRecord = {
  assessment: ModuleAssessment;
  id: number;
  module: "M01" | "M02";
  schemaRegistryIds: number[];
  uploadIds: number[];
  varianceCents: bigint;
};

type PersistCaarArgs = {
  certification: CertificationResult;
  customerId: number;
  locationId: number;
  record: CaarRecord;
  runRecords: RunRecord[];
};

type GenerateClaimPackArgs = {
  caarExternalId: string;
  customerId: number | null;
  locationId: number;
};

function toJsonValue(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function pickPrimaryRun(runRecords: RunRecord[]) {
  return [...runRecords].sort((left, right) => {
    if (right.varianceCents !== left.varianceCents) {
      return right.varianceCents > left.varianceCents ? 1 : -1;
    }
    if (right.assessment.score !== left.assessment.score) {
      return right.assessment.score - left.assessment.score;
    }
    return left.module.localeCompare(right.module);
  })[0];
}

function buildCanonicalPayload({
  certification,
  record,
  runRecords,
}: {
  certification: CertificationResult;
  record: CaarRecord;
  runRecords: RunRecord[];
}) {
  return {
    artifactVersion: "phase6-v1",
    caar: record,
    certification: {
      amountValue: certification.amountValue,
      ready: certification.ready,
      status: certification.status,
      trustScore: certification.trustScore,
      updatedModules: certification.updatedModules,
      updatedRecovery: certification.updatedRecovery,
    },
    generatedAt: new Date().toISOString(),
    moduleRuns: runRecords.map((run) => ({
      findings: run.assessment.findings,
      module: run.module,
      note: run.assessment.note,
      ready: run.assessment.ready,
      recoveryValue: run.assessment.recoveryValue,
      runId: run.id,
      schemaRegistryIds: run.schemaRegistryIds,
      score: run.assessment.score,
      uploadIds: run.uploadIds,
      varianceCents: Number(run.varianceCents),
    })),
  };
}

function buildMinimalPdfBuffer(lines: string[]) {
  const safeLines = lines.map((line) =>
    line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"),
  );
  const content = [
    "BT",
    "/F1 12 Tf",
    "50 770 Td",
    "14 TL",
    ...safeLines.map((line, index) => `${index === 0 ? "" : "T* " }(${line}) Tj`.trim()),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function buildPdfLines(payload: ReturnType<typeof buildCanonicalPayload>) {
  const lines = [
    `Certified Audit and Analysis Report`,
    `CAAR ID: ${payload.caar.id}`,
    `Location: ${payload.caar.locationName}`,
    `Period: ${payload.caar.period}`,
    `Trust Score: ${payload.caar.trustScore}`,
    `Status: ${payload.caar.status}`,
    `Certified Variance: ${payload.caar.amount}`,
    "",
    "Findings:",
    ...payload.caar.findings.map((finding, index) => `${index + 1}. ${finding}`),
    "",
    "MQ6 Dimensions:",
    ...payload.caar.dimensions.map(
      (dimension) => `${dimension.name}: ${dimension.score} (${dimension.weight})`,
    ),
  ];

  return lines.slice(0, 40);
}

async function upsertArtifactRecord({
  byteCount,
  caarId,
  name,
  s3Key,
  seq,
  sha256,
  tx,
  type,
}: {
  byteCount: bigint;
  caarId: number;
  name: string;
  s3Key: string;
  seq: number;
  sha256: string;
  tx: TxClient;
  type: string;
}) {
  return tx.caar_artifacts_v2.upsert({
    where: {
      caar_id_seq: {
        caar_id: caarId,
        seq,
      },
    },
    update: {
      artifact_type: type,
      byte_count: byteCount,
      name,
      s3_key: s3Key,
      sha256,
    },
    create: {
      artifact_type: type,
      byte_count: byteCount,
      caar_id: caarId,
      name,
      s3_key: s3Key,
      seq,
      sha256,
    },
  });
}

export async function persistGeneratedCaar(
  tx: TxClient,
  {
    certification,
    customerId,
    locationId,
    record,
    runRecords,
  }: PersistCaarArgs,
) {
  const primaryRun = pickPrimaryRun(runRecords);
  if (!primaryRun) {
    throw new Error("No certification run records were created for this CAAR.");
  }

  const canonicalPayload = buildCanonicalPayload({
    certification,
    record,
    runRecords,
  });
  const canonicalBuffer = Buffer.from(JSON.stringify(canonicalPayload, null, 2), "utf8");
  const canonicalSha = createHash("sha256").update(canonicalBuffer).digest("hex");
  const pdfBuffer = buildMinimalPdfBuffer(buildPdfLines(canonicalPayload));
  const pdfSha = createHash("sha256").update(pdfBuffer).digest("hex");
  const objectBase = `${locationId}/${record.id}`;
  const canonicalObjectKey = `${objectBase}/canonical-payload.json`;
  const pdfObjectKey = `${objectBase}/caar-report.pdf`;

  await persistArtifactBlob({
    buffer: canonicalBuffer,
    objectKey: canonicalObjectKey,
  });
  await persistArtifactBlob({
    buffer: pdfBuffer,
    objectKey: pdfObjectKey,
  });

  const existing = await tx.caars_v2.findFirst({
    where: {
      caar_external_id: record.id,
    },
    select: {
      id: true,
      sha256: true,
    },
  });

  const previousActive = await tx.caars_v2.findFirst({
    where: {
      caar_external_id: {
        not: record.id,
      },
      location_id: locationId,
      module: primaryRun.module,
      period: record.period,
      superseded_by: null,
    },
    orderBy: [{ sealed_at: "desc" }, { id: "desc" }],
    select: {
      id: true,
    },
  });

  const findingClass = record.status === "Court Admissible" ? "court_admissible" : "needs_remediation";
  const caar = existing
    ? await tx.caars_v2.update({
        where: {
          id: existing.id,
        },
        data: {
          canonical_payload_s3_key: canonicalObjectKey,
          cert_run_id: primaryRun.id,
          court_admissible: record.status === "Court Admissible",
          finding_class: findingClass,
          location_id: locationId,
          module: primaryRun.module,
          pdf_s3_key: pdfObjectKey,
          period: record.period,
          prev_sha256: existing.sha256,
          recoverable_variance_cents: BigInt(Math.round(certification.amountValue * 100)),
          sealed_at: new Date(),
          sha256: canonicalSha,
          status: record.status === "Court Admissible" ? "active" : "review",
          superseded_by: null,
          superseded_reason: null,
          trust_score: record.trustScore,
        },
        select: {
          caar_external_id: true,
          id: true,
        },
      })
    : await tx.caars_v2.create({
        data: {
          canonical_payload_s3_key: canonicalObjectKey,
          caar_external_id: record.id,
          cert_run_id: primaryRun.id,
          court_admissible: record.status === "Court Admissible",
          finding_class: findingClass,
          location_id: locationId,
          module: primaryRun.module,
          pdf_s3_key: pdfObjectKey,
          period: record.period,
          prev_sha256: null,
          recoverable_variance_cents: BigInt(Math.round(certification.amountValue * 100)),
          sha256: canonicalSha,
          status: record.status === "Court Admissible" ? "active" : "review",
          trust_score: record.trustScore,
        },
        select: {
          caar_external_id: true,
          id: true,
        },
      });

  if (previousActive && previousActive.id !== caar.id) {
    await tx.caars_v2.update({
      where: {
        id: previousActive.id,
      },
      data: {
        status: "superseded",
        superseded_by: caar.id,
        superseded_reason: `Superseded by ${record.id}`,
      },
    });
  }

  await upsertArtifactRecord({
    byteCount: BigInt(canonicalBuffer.byteLength),
    caarId: caar.id,
    name: `${record.id}-canonical-payload.json`,
    s3Key: canonicalObjectKey,
    seq: 1,
    sha256: canonicalSha,
    tx,
    type: "canonical_payload_json",
  });
  await upsertArtifactRecord({
    byteCount: BigInt(pdfBuffer.byteLength),
    caarId: caar.id,
    name: `${record.id}-caar-report.pdf`,
    s3Key: pdfObjectKey,
    seq: 2,
    sha256: pdfSha,
    tx,
    type: "caar_pdf",
  });

  await tx.audit_log_v2.create({
    data: {
      action: "caar_generated",
      customer_id: customerId,
      entity_id: String(caar.id),
      entity_type: "caars_v2",
      location_id: locationId,
      metadata: toJsonValue({
        caarExternalId: record.id,
        certRunIds: runRecords.map((run) => run.id),
        courtAdmissible: record.status === "Court Admissible",
      }),
      summary: `Generated CAAR ${record.id} from persisted certification runs.`,
    },
  });

  return caar;
}

export async function generateClaimPackForCaar(
  tx: TxClient,
  {
    caarExternalId,
    customerId,
    locationId,
  }: GenerateClaimPackArgs,
) {
  const caar = await tx.caars_v2.findFirst({
    where: {
      caar_external_id: caarExternalId,
      location_id: locationId,
    },
    select: {
      canonical_payload_s3_key: true,
      caar_external_id: true,
      court_admissible: true,
      exportpack_s3_key: true,
      id: true,
      module: true,
      pdf_s3_key: true,
      period: true,
      recoverable_variance_cents: true,
      status: true,
      trust_score: true,
    },
  });

  if (!caar) {
    throw new Error("CAAR not found.");
  }

  if (!caar.court_admissible || !caar.pdf_s3_key) {
    throw new Error("Claim pack generation is blocked until the CAAR is court-admissible.");
  }

  const canonicalBuffer = await readArtifactBlob(caar.canonical_payload_s3_key);
  const canonicalPayload = JSON.parse(canonicalBuffer.toString("utf8")) as ReturnType<
    typeof buildCanonicalPayload
  >;
  const artifacts = await tx.caar_artifacts_v2.findMany({
    where: {
      caar_id: caar.id,
    },
    orderBy: [{ seq: "asc" }],
    select: {
      artifact_type: true,
      byte_count: true,
      name: true,
      s3_key: true,
      seq: true,
      sha256: true,
    },
  });

  const manifest = {
    artifactVersion: "phase6-claimpack-v1",
    caarExternalId: caar.caar_external_id,
    generatedAt: new Date().toISOString(),
    includedArtifacts: artifacts.map((artifact) => ({
      name: artifact.name,
      objectKey: artifact.s3_key,
      seq: artifact.seq,
      sha256: artifact.sha256,
      type: artifact.artifact_type,
    })),
    module: caar.module,
    period: caar.period,
    recoverableVarianceCents: Number(caar.recoverable_variance_cents),
    report: {
      findings: canonicalPayload.caar.findings,
      locationId: canonicalPayload.caar.locationId,
      locationName: canonicalPayload.caar.locationName,
      trustScore: caar.trust_score,
    },
    status: caar.status,
  };

  const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2), "utf8");
  const manifestSha = createHash("sha256").update(manifestBuffer).digest("hex");
  const manifestObjectKey = `${locationId}/${caar.caar_external_id}/claim-pack.json`;

  await persistArtifactBlob({
    buffer: manifestBuffer,
    objectKey: manifestObjectKey,
  });

  await tx.caars_v2.update({
    where: {
      id: caar.id,
    },
    data: {
      exportpack_s3_key: manifestObjectKey,
    },
  });

  await upsertArtifactRecord({
    byteCount: BigInt(manifestBuffer.byteLength),
    caarId: caar.id,
    name: `${caar.caar_external_id}-claim-pack.json`,
    s3Key: manifestObjectKey,
    seq: 3,
    sha256: manifestSha,
    tx,
    type: "claim_pack_manifest",
  });

  await tx.audit_log_v2.create({
    data: {
      action: "claim_pack_generated",
      customer_id: customerId,
      entity_id: String(caar.id),
      entity_type: "caars_v2",
      location_id: locationId,
      metadata: toJsonValue({
        caarExternalId,
        objectKey: manifestObjectKey,
      }),
      summary: `Generated claim pack for ${caarExternalId}.`,
    },
  });

  return {
    caarId: caar.id,
    objectKey: manifestObjectKey,
  };
}
