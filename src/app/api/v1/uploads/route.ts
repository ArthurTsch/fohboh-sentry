import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import type { SessionState } from "@/components/sentry/types";
import { requireManagerSession } from "@/lib/auth/session";
import { logServerError, writeAuditLog } from "@/lib/ops/audit";
import { getRequestContextFromRequest, withRequestHeaders } from "@/lib/ops/request";
import { checkRateLimits, getRetryAfterSeconds } from "@/lib/ops/rate-limit";
import prisma from "@/lib/prisma";
import { getArtifactPurpose, getExpectedKind } from "@/lib/uploads/definitions";
import { getScopedRestaurantWhere } from "@/lib/auth/team-access";
import {
  type PersistedUploadValidation,
  validateUploadArtifact,
} from "@/lib/uploads/intake";
import { persistUploadBlob } from "@/lib/uploads/storage";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const DATABASE_READ_RETRY_DELAY_MS = 200;

type ScopedRestaurant = {
  account_id: string | null;
  created_by: number | null;
  id: number;
  location_id: string;
  name: string;
  store_id: string | null;
  unit_id: string | null;
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

function isMissingUploadSchema(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

function isRetryableDatabaseConnectivityError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";
  return ["P1001", "P1002", "P1017"].includes(code) ||
    /EAI_AGAIN|ENOTFOUND|ECONNRESET|connection pool|server has closed the connection/i.test(error.message);
}

async function retryDatabaseRead<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (!isRetryableDatabaseConnectivityError(error)) throw error;
    await new Promise<void>((resolve) => setTimeout(resolve, DATABASE_READ_RETRY_DELAY_MS));
    return operation();
  }
}

function getDatabaseUnavailableResponse() {
  const response = NextResponse.json(
    { error: "The database connection is temporarily unavailable. Nothing was changed; retry in a moment." },
    { status: 503 },
  );
  response.headers.set("retry-after", "2");
  return response;
}

function getMissingUploadSchemaMessage() {
  return "The production upload storage tables are not fully migrated yet. Apply the latest Prisma migrations before using persisted uploads on Vercel.";
}

function toJsonValue(value: unknown) {
  return value as Prisma.InputJsonValue;
}

async function getScopedRestaurants(session: SessionState) {
  const scopedWhere = await getScopedRestaurantWhere(session);
  const restaurants = await retryDatabaseRead(() => prisma.restaurants.findMany({
    where: {
      active: true,
      ...scopedWhere,
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    select: {
      created_by: true,
      id: true,
      name: true,
      store_id: true,
      unit_id: true,
    },
  }));

  let stateRows: Array<{ account_id: string | null; location_id: string; restaurant_id: number }> = [];

  try {
    if (restaurants.length > 0) {
      stateRows = await retryDatabaseRead(() => prisma.restaurant_sentry_state.findMany({
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
      }));
    }
  } catch (error) {
    if (
      !(
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2021"
      )
    ) {
      throw error;
    }
  }

  const stateByRestaurantId = new Map(stateRows.map((row) => [row.restaurant_id, row]));

  return restaurants.map<ScopedRestaurant>((restaurant) => ({
    created_by: restaurant.created_by,
    id: restaurant.id,
    account_id: stateByRestaurantId.get(restaurant.id)?.account_id ?? null,
    location_id:
      stateByRestaurantId.get(restaurant.id)?.location_id?.trim() ||
      restaurant.unit_id?.trim() ||
      restaurant.store_id?.trim() ||
      `LOC-DB-${restaurant.id}`,
    name: restaurant.name,
    store_id: restaurant.store_id,
    unit_id: restaurant.unit_id,
  }));
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^A-Za-z0-9._-]+/g, "_");
}

function detectWrongDocumentKind(expectedKind: "csv" | "pdf" | "manual" | "csv_or_pdf", file: File) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (expectedKind === "csv_or_pdf") {
    const looksLikeCsv = name.endsWith(".csv") || type.includes("csv") || type.startsWith("text/");
    const looksLikePdf = name.endsWith(".pdf") || type.includes("pdf");
    return !looksLikeCsv && !looksLikePdf;
  }

  if (expectedKind === "csv") {
    return name.endsWith(".pdf") || type.includes("pdf");
  }

  if (expectedKind === "pdf") {
    return name.endsWith(".csv") || type.includes("csv") || type.startsWith("text/");
  }

  return false;
}

function buildUploadResponse({
  artifactKey,
  accountId,
  id,
  locationId,
  locationName,
  moduleId,
  validation,
}: {
  artifactKey: string;
  accountId: string | null;
  id: number;
  locationId: string;
  locationName: string;
  moduleId: "M01" | "M02";
  validation: PersistedUploadValidation;
}) {
  return {
    artifactKey,
    accountId,
    detectedFormatKey: validation.detectedFormatKey,
    detectedFormatName: validation.detectedFormatName,
    expectedColumns: validation.expectedColumns,
    fields: validation.fields,
    fileName: validation.fileName,
    hashValue: validation.hashValue.slice(0, 12),
    id,
    matchedColumns: validation.matchedColumns,
    matchPct: validation.matchPct,
    metrics: validation.metrics,
    moduleId,
    pageCount: validation.pageCount,
    parseWarnings: validation.parseWarnings,
    rows: validation.rows,
    schema: validation.schema,
    sizeBytes: validation.sizeBytes,
    sourceSystemKey: validation.sourceSystemKey,
    status: validation.schema && validation.fields ? "ready" : "review",
    unmatchedHeaders: validation.unmatchedHeaders,
    updatedAt: validation.updatedAt,
    uploaded: validation.uploaded,
    vendorKey: validation.vendorKey,
    vendorName: validation.vendorName,
    locationId,
    locationName,
  };
}

export async function GET() {
  try {
    const session = await requireManagerSession();
    const restaurants = await getScopedRestaurants(session);
    const restaurantIds = restaurants.map((restaurant) => restaurant.id);

    if (restaurantIds.length === 0) {
      return NextResponse.json({ uploads: [] });
    }

    const uploads = await prisma.uploads_v2.findMany({
      where: {
        location_id: {
          in: restaurantIds,
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
        validation_summary: true,
      },
    });

    const restaurantById = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));

    return NextResponse.json({
      uploads: uploads
        .map((upload) => {
          const restaurant = restaurantById.get(upload.location_id);
          if (!restaurant || !upload.validation_summary || typeof upload.validation_summary !== "object") {
            return null;
          }

          return buildUploadResponse({
            artifactKey: upload.artifact_key,
            accountId: restaurant.account_id,
            id: upload.id,
            locationId: restaurant.location_id,
            locationName: restaurant.name,
            moduleId: upload.module as "M01" | "M02",
            validation: upload.validation_summary as unknown as PersistedUploadValidation,
          });
        })
        .filter(Boolean),
    });
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (isMissingUploadSchema(error)) {
      return NextResponse.json(
        {
          error: getMissingUploadSchemaMessage(),
        },
        { status: 503 },
      );
    }

    console.error("Fetch uploads failed:", error);
    return NextResponse.json(
      { error: "Unable to load persisted uploads right now." },
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
        NextResponse.json({ error: "This account cannot upload files." }, { status: 403 }),
        requestContext,
      );
    }
    if (typeof session.managerId !== "number") {
      return withRequestHeaders(NextResponse.json(
        { error: "This account is missing a database-backed manager identity." },
        { status: 403 },
      ), requestContext);
    }
    const uploaderId = session.managerId;
    const limiter = await checkRateLimits([
      {
        failureMode: "open",
        key: `upload-identity:${uploaderId}`,
        limit: 120,
        windowMs: 60 * 60 * 1000,
      },
      {
        failureMode: "open",
        key: `upload-address:${requestContext.ipAddress ?? "unknown"}`,
        limit: 600,
        windowMs: 60 * 60 * 1000,
      },
    ]);
    if (!limiter.allowed) {
      const response = NextResponse.json(
        { error: "Upload rate limit reached. Try again later." },
        { status: 429 },
      );
      response.headers.set("retry-after", String(getRetryAfterSeconds(limiter)));
      return withRequestHeaders(response, requestContext);
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const locationId = String(formData.get("locationId") ?? "").trim();
    const moduleId = String(formData.get("moduleId") ?? "").trim() as "M01" | "M02";
    const artifactKey = String(formData.get("artifactKey") ?? "").trim();
    const vendorKey = String(formData.get("vendorKey") ?? "").trim() || null;
    const vendorName = String(formData.get("vendorName") ?? "").trim() || null;

    if (!(file instanceof File)) {
      return withRequestHeaders(NextResponse.json({ error: "A file upload is required." }, { status: 400 }), requestContext);
    }

    if (!locationId || !artifactKey || (moduleId !== "M01" && moduleId !== "M02")) {
      return withRequestHeaders(NextResponse.json(
        { error: "locationId, moduleId, and artifactKey are required." },
        { status: 400 },
      ), requestContext);
    }

    if (file.size <= 0) {
      return withRequestHeaders(NextResponse.json(
        { error: "Uploaded file is empty. Use the raw export from the source system." },
        { status: 400 },
      ), requestContext);
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return withRequestHeaders(NextResponse.json(
        { error: "Maximum upload size is 100MB per file." },
        { status: 413 },
      ), requestContext);
    }

    const expectedKind = getExpectedKind(artifactKey);
    if (expectedKind === "manual") {
      return withRequestHeaders(NextResponse.json(
        { error: "This artifact is manual-entry only and does not accept file uploads." },
        { status: 400 },
      ), requestContext);
    }

    if (detectWrongDocumentKind(expectedKind, file)) {
      return withRequestHeaders(NextResponse.json(
        {
          error:
            expectedKind === "csv"
              ? "This upload expects a CSV file, not a PDF."
              : expectedKind === "pdf"
                ? "This upload expects a PDF file, not a CSV."
                : "This upload expects either the raw CSV export or the original PDF statement.",
        },
        { status: 400 },
      ), requestContext);
    }

    const restaurants = await getScopedRestaurants(session);
    const restaurant = restaurants.find((candidate) => candidate.location_id === locationId);

    if (!restaurant) {
      return withRequestHeaders(NextResponse.json(
        { error: "Upload target could not be resolved for this location." },
        { status: 404 },
      ), requestContext);
    }

    const primaryTarget = { artifactKey, moduleId, vendorKey, vendorName };
    let uploadTargets = [primaryTarget];
    if (artifactKey.includes("bank")) {
      try {
        const requestedTargets = JSON.parse(String(formData.get("sharedBankTargets") ?? "[]")) as Array<{
          artifactKey?: unknown;
          moduleId?: unknown;
          vendorKey?: unknown;
          vendorName?: unknown;
        }>;
        const validTargets = requestedTargets
          .filter((target) =>
            (target.moduleId === "M01" || target.moduleId === "M02") &&
            typeof target.artifactKey === "string" &&
            target.artifactKey.startsWith(target.moduleId === "M01" ? "m01-bank" : "m02-bank"),
          )
          .map((target) => ({
            artifactKey: String(target.artifactKey),
            moduleId: target.moduleId as "M01" | "M02",
            vendorKey: typeof target.vendorKey === "string" ? target.vendorKey.trim() || null : null,
            vendorName: typeof target.vendorName === "string" ? target.vendorName.trim() || null : null,
          }));
        uploadTargets = [...new Map(
          [primaryTarget, ...validTargets].map((target) => [
            `${target.moduleId}:${target.artifactKey}:${target.vendorKey ?? "global"}`,
            target,
          ]),
        ).values()];
      } catch {
        uploadTargets = [primaryTarget];
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validatedTargets = await Promise.all(uploadTargets.map(async (target) => ({
      ...target,
      validation: await validateUploadArtifact({
        artifactKey: target.artifactKey,
        buffer,
        contentType: file.type,
        fileName: file.name,
        vendorKey: target.vendorKey,
        vendorName: target.vendorName,
      }),
    })));
    const timestamp = Date.now();
    const objectKey = [
      String(restaurant.id),
      moduleId,
      artifactKey,
      `${timestamp}-${sanitizeFileName(file.name)}`,
    ].join("/");

    await persistUploadBlob({
      buffer,
      objectKey,
    });

    const created = await prisma.$transaction(async (tx) => {
      const uploads: Array<{ id: number }> = [];
      for (const target of validatedTargets) {
        const existing = await tx.uploads_v2.findFirst({
          where: {
            artifact_key: target.artifactKey,
            location_id: restaurant.id,
            module: target.moduleId,
            superseded_by: null,
            vendor: target.vendorKey,
          },
          orderBy: [{ uploaded_at: "desc" }, { id: "desc" }],
          select: { id: true },
        });
        const upload = await tx.uploads_v2.create({
          data: {
            artifact_key: target.artifactKey,
            byte_count: BigInt(buffer.byteLength),
            file_name: file.name,
            file_purpose: getArtifactPurpose(target.artifactKey),
            location_id: restaurant.id,
            module: target.moduleId,
            page_count: target.validation.pageCount ?? null,
            row_count: target.validation.rows ?? null,
            s3_key: objectKey,
            sha256: target.validation.hashValue,
            uploaded_by: uploaderId,
            validation_summary: toJsonValue(target.validation),
            vendor: target.vendorKey,
          },
          select: { id: true },
        });
        uploads.push(upload);
        if (existing) {
          await tx.uploads_v2.update({
            where: { id: existing.id },
            data: { superseded_by: upload.id },
          });
        }
      }

      await writeAuditLog({
        action: "upload_received",
        actorUserId: uploaderId,
        entityId: uploads.map((upload) => upload.id).join(","),
        entityType: "uploads_v2",
        ipAddress: requestContext.ipAddress,
        locationId: restaurant.id,
        metadata: {
          artifactKey,
          evidenceLinks: validatedTargets.length,
          fileName: file.name,
          moduleId,
          requestId: requestContext.requestId,
          vendorKey,
        },
        summary: validatedTargets.length > 1
          ? `Uploaded ${file.name} once and linked it to ${validatedTargets.length} bank evidence sets for ${restaurant.name}.`
          : `Uploaded ${file.name} for ${restaurant.name} (${moduleId}/${artifactKey}).`,
        userAgent: requestContext.userAgent,
      }, tx);

      return uploads;
    }, {
      maxWait: 10_000,
      timeout: 30_000,
    });

    const uploadResponses = validatedTargets.map((target, index) => buildUploadResponse({
      artifactKey: target.artifactKey,
      id: created[index].id,
      accountId: restaurant.account_id,
      locationId: restaurant.location_id,
      locationName: restaurant.name,
      moduleId: target.moduleId,
      validation: target.validation,
    }));
    return withRequestHeaders(NextResponse.json({
      upload: uploadResponses[0],
      uploads: uploadResponses,
    }), requestContext);
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return withRequestHeaders(authResponse, requestContext);
    }

    if (isMissingUploadSchema(error)) {
      return withRequestHeaders(NextResponse.json(
        {
          error: getMissingUploadSchemaMessage(),
        },
        { status: 503 },
      ), requestContext);
    }

    logServerError("upload_persist_failed", error, {
      requestId: requestContext.requestId,
    });
    return withRequestHeaders(NextResponse.json(
      { error: "Unable to persist this upload right now." },
      { status: 500 },
    ), requestContext);
  }
}

export async function DELETE(request: Request) {
  const requestContext = getRequestContextFromRequest(request);
  try {
    const session = await requireManagerSession();
    if (session.role === "Viewer") {
      return withRequestHeaders(
        NextResponse.json({ error: "This account cannot manage uploads." }, { status: 403 }),
        requestContext,
      );
    }

    const body = (await request.json().catch(() => null)) as
      | {
          locationId?: string;
          resetLocation?: boolean;
          uploadId?: number;
        }
      | null;

    const scopedRestaurants = await getScopedRestaurants(session);

    if (typeof body?.uploadId === "number" && Number.isFinite(body.uploadId)) {
      const upload = await prisma.uploads_v2.findFirst({
        where: {
          id: body.uploadId,
          superseded_by: null,
        },
        select: {
          artifact_key: true,
          id: true,
          location_id: true,
          module: true,
          s3_key: true,
          vendor: true,
        },
      });

      if (!upload) {
        return withRequestHeaders(
          NextResponse.json({ error: "Saved upload could not be found." }, { status: 404 }),
          requestContext,
        );
      }

      const restaurant = scopedRestaurants.find((item) => item.id === upload.location_id);
      if (!restaurant) {
        return withRequestHeaders(
          NextResponse.json({ error: "Forbidden." }, { status: 403 }),
          requestContext,
        );
      }

      const linkedUploads = upload.artifact_key.includes("bank")
        ? await prisma.uploads_v2.findMany({
            where: {
              location_id: upload.location_id,
              s3_key: upload.s3_key,
              superseded_by: null,
            },
            select: { id: true },
          })
        : [{ id: upload.id }];

      await prisma.$transaction(async (tx) => {
        for (const linkedUpload of linkedUploads) {
          await tx.uploads_v2.update({
            where: { id: linkedUpload.id },
            data: { superseded_by: linkedUpload.id },
          });
        }

        await writeAuditLog(
          {
            action: "upload_removed",
            actorUserId: typeof session.managerId === "number" ? session.managerId : null,
            entityId: String(upload.id),
            entityType: "uploads_v2",
            ipAddress: requestContext.ipAddress,
            locationId: restaurant.id,
            metadata: {
              artifactKey: upload.artifact_key,
              moduleId: upload.module,
              requestId: requestContext.requestId,
              vendorKey: upload.vendor,
            },
            summary: `Removed saved upload for ${restaurant.name} (${upload.module}/${upload.artifact_key}).`,
            userAgent: requestContext.userAgent,
          },
          tx,
        );
      });

      return withRequestHeaders(NextResponse.json({
        ok: true,
        removedUploadId: upload.id,
        removedUploadIds: linkedUploads.map((item) => item.id),
      }), requestContext);
    }

    const locationId = String(body?.locationId ?? "").trim();
    if (!locationId || body?.resetLocation !== true) {
      return withRequestHeaders(
        NextResponse.json({ error: "uploadId or { locationId, resetLocation: true } is required." }, { status: 400 }),
        requestContext,
      );
    }

    const restaurant = scopedRestaurants.find((item) => item.location_id === locationId);
    if (!restaurant) {
      return withRequestHeaders(
        NextResponse.json({ error: "Upload target could not be resolved for this location." }, { status: 404 }),
        requestContext,
      );
    }

    const activeUploads = await prisma.uploads_v2.findMany({
      where: {
        location_id: restaurant.id,
        superseded_by: null,
      },
      select: {
        artifact_key: true,
        id: true,
        module: true,
        vendor: true,
      },
    });

    await prisma.$transaction(async (tx) => {
      for (const upload of activeUploads) {
        await tx.uploads_v2.update({
          where: { id: upload.id },
          data: { superseded_by: upload.id },
        });
      }

      await writeAuditLog(
        {
          action: "location_uploads_reset",
          actorUserId: typeof session.managerId === "number" ? session.managerId : null,
          entityId: locationId,
          entityType: "location_upload_set",
          ipAddress: requestContext.ipAddress,
          locationId: restaurant.id,
          metadata: {
            removedUploadCount: activeUploads.length,
            requestId: requestContext.requestId,
          },
          summary: `Cleared current upload set for ${restaurant.name}.`,
          userAgent: requestContext.userAgent,
        },
        tx,
      );
    });

    return withRequestHeaders(
      NextResponse.json({ ok: true, removedCount: activeUploads.length }),
      requestContext,
    );
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return withRequestHeaders(authResponse, requestContext);
    }

    if (isMissingUploadSchema(error)) {
      return withRequestHeaders(
        NextResponse.json(
          {
            error: getMissingUploadSchemaMessage(),
          },
          { status: 503 },
        ),
        requestContext,
      );
    }

    if (isRetryableDatabaseConnectivityError(error)) {
      logServerError("upload_delete_database_unavailable", error, {
        requestId: requestContext.requestId,
      });
      return withRequestHeaders(getDatabaseUnavailableResponse(), requestContext);
    }

    logServerError("upload_delete_failed", error, {
      requestId: requestContext.requestId,
    });
    return withRequestHeaders(
      NextResponse.json({ error: "Unable to update saved uploads right now." }, { status: 500 }),
      requestContext,
    );
  }
}
