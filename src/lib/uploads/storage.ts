import prisma from "@/lib/prisma";

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
