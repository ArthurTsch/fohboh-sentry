import prisma from "@/lib/prisma";
import { parseSupportTicketIssue } from "@/lib/support/tickets";

type BlobBucket = "artifacts" | "uploads";

function toStorageKey(bucket: BlobBucket, objectKey: string) {
  return `${bucket}:${objectKey}`;
}

function toPrismaBytes(buffer: Buffer) {
  return new Uint8Array(buffer);
}

async function persistDatabaseBlob(bucket: BlobBucket, objectKey: string, buffer: Buffer) {
  await prisma.object_blobs_v2.upsert({
    where: {
      storage_key: toStorageKey(bucket, objectKey),
    },
    update: {
      byte_count: BigInt(buffer.byteLength),
      payload: toPrismaBytes(buffer),
      updated_at: new Date(),
    },
    create: {
      bucket,
      byte_count: BigInt(buffer.byteLength),
      payload: toPrismaBytes(buffer),
      storage_key: toStorageKey(bucket, objectKey),
    },
  });
}

async function readDatabaseBlob(bucket: BlobBucket, objectKey: string) {
  const record = await prisma.object_blobs_v2.findUnique({
    where: {
      storage_key: toStorageKey(bucket, objectKey),
    },
    select: {
      payload: true,
    },
  });

  if (!record) {
    throw new Error(`Stored blob not found for ${bucket}:${objectKey}`);
  }

  return Buffer.from(record.payload);
}

export async function persistUploadBlob({
  buffer,
  objectKey,
}: {
  buffer: Buffer;
  objectKey: string;
}) {
  await persistDatabaseBlob("uploads", objectKey, buffer);
  return {
    objectKey,
    storageMode: "database" as const,
  };
}

export async function persistArtifactBlob({
  buffer,
  objectKey,
}: {
  buffer: Buffer;
  objectKey: string;
}) {
  await persistDatabaseBlob("artifacts", objectKey, buffer);
  return {
    objectKey,
    storageMode: "database" as const,
  };
}

export async function readArtifactBlob(objectKey: string) {
  return readDatabaseBlob("artifacts", objectKey);
}

export async function readUploadBlob(objectKey: string) {
  return readDatabaseBlob("uploads", objectKey);
}

export async function deleteUploadBlob(objectKey: string) {
  return prisma.object_blobs_v2.deleteMany({
    where: { storage_key: toStorageKey("uploads", objectKey) },
  });
}

export async function cleanupUnreferencedUploadBlobs({
  apply = false,
  olderThan = new Date(Date.now() - 24 * 60 * 60 * 1000),
}: {
  apply?: boolean;
  olderThan?: Date;
} = {}) {
  const [blobs, uploads, tickets] = await Promise.all([
    prisma.object_blobs_v2.findMany({
      where: { bucket: "uploads", created_at: { lt: olderThan } },
      select: { byte_count: true, storage_key: true },
    }),
    prisma.uploads_v2.findMany({ select: { s3_key: true } }),
    prisma.support_tickets_v2.findMany({ select: { issue: true } }),
  ]);
  const referencedKeys = new Set(uploads.map((upload) => toStorageKey("uploads", upload.s3_key)));
  for (const ticket of tickets) {
    for (const attachment of parseSupportTicketIssue(ticket.issue).attachments) {
      if (attachment.objectKey) referencedKeys.add(toStorageKey("uploads", attachment.objectKey));
    }
  }
  const orphaned = blobs.filter((blob) => !referencedKeys.has(blob.storage_key));
  if (apply && orphaned.length > 0) {
    await prisma.object_blobs_v2.deleteMany({
      where: { storage_key: { in: orphaned.map((blob) => blob.storage_key) } },
    });
  }
  return {
    applied: apply,
    byteCount: orphaned.reduce((sum, blob) => sum + blob.byte_count, BigInt(0)),
    keys: orphaned.map((blob) => blob.storage_key),
    orphanCount: orphaned.length,
  };
}
