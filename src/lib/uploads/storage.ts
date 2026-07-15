import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import prisma from "@/lib/prisma";

type BlobBucket = "artifacts" | "uploads";

function resolveStorageRoot(envKey: string, fallbackSegments: string[]) {
  return process.env[envKey]?.trim()
    ? path.resolve(process.env[envKey]!.trim())
    : path.join(process.cwd(), ...fallbackSegments);
}

function resolveStorageMode() {
  const explicit = process.env.SENTRY_STORAGE_MODE?.trim().toLowerCase();
  if (explicit === "local" || explicit === "database") {
    return explicit;
  }

  return process.env.VERCEL ? "database" : "local";
}

function toStorageKey(bucket: BlobBucket, objectKey: string) {
  return `${bucket}:${objectKey}`;
}

function toPrismaBytes(buffer: Buffer) {
  return new Uint8Array(buffer);
}

async function persistLocalBlob(root: string, objectKey: string, buffer: Buffer) {
  const targetPath = path.join(root, ...objectKey.split("/"));
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, buffer);
}

async function readLocalBlob(root: string, objectKey: string) {
  const targetPath = path.join(root, ...objectKey.split("/"));
  return readFile(targetPath);
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

async function persistBlob({
  bucket,
  buffer,
  localEnvKey,
  localFallbackSegments,
  objectKey,
}: {
  bucket: BlobBucket;
  buffer: Buffer;
  localEnvKey: string;
  localFallbackSegments: string[];
  objectKey: string;
}) {
  if (resolveStorageMode() === "database") {
    await persistDatabaseBlob(bucket, objectKey, buffer);
    return {
      objectKey,
      storageMode: "database" as const,
    };
  }

  const root = resolveStorageRoot(localEnvKey, localFallbackSegments);
  await persistLocalBlob(root, objectKey, buffer);
  return {
    objectKey,
    storageMode: "local" as const,
  };
}

async function readBlob({
  bucket,
  localEnvKey,
  localFallbackSegments,
  objectKey,
}: {
  bucket: BlobBucket;
  localEnvKey: string;
  localFallbackSegments: string[];
  objectKey: string;
}) {
  if (resolveStorageMode() === "database") {
    return readDatabaseBlob(bucket, objectKey);
  }

  const root = resolveStorageRoot(localEnvKey, localFallbackSegments);
  return readLocalBlob(root, objectKey);
}

export async function persistUploadBlob({
  buffer,
  objectKey,
}: {
  buffer: Buffer;
  objectKey: string;
}) {
  return persistBlob({
    bucket: "uploads",
    buffer,
    localEnvKey: "SENTRY_UPLOAD_DIR",
    localFallbackSegments: ["storage", "uploads-v2"],
    objectKey,
  });
}

export async function persistArtifactBlob({
  buffer,
  objectKey,
}: {
  buffer: Buffer;
  objectKey: string;
}) {
  return persistBlob({
    bucket: "artifacts",
    buffer,
    localEnvKey: "SENTRY_ARTIFACT_DIR",
    localFallbackSegments: ["storage", "artifacts-v2"],
    objectKey,
  });
}

export async function readArtifactBlob(objectKey: string) {
  return readBlob({
    bucket: "artifacts",
    localEnvKey: "SENTRY_ARTIFACT_DIR",
    localFallbackSegments: ["storage", "artifacts-v2"],
    objectKey,
  });
}

export async function readUploadBlob(objectKey: string) {
  return readBlob({
    bucket: "uploads",
    localEnvKey: "SENTRY_UPLOAD_DIR",
    localFallbackSegments: ["storage", "uploads-v2"],
    objectKey,
  });
}
