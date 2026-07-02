import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

function resolveStorageRoot(envKey: string, fallbackSegments: string[]) {
  return process.env[envKey]?.trim()
    ? path.resolve(process.env[envKey]!.trim())
    : path.join(process.cwd(), ...fallbackSegments);
}

export async function persistUploadBlob({
  buffer,
  objectKey,
}: {
  buffer: Buffer;
  objectKey: string;
}) {
  const root = resolveStorageRoot("SENTRY_UPLOAD_DIR", ["storage", "uploads-v2"]);
  const targetPath = path.join(root, ...objectKey.split("/"));
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, buffer);
  return {
    objectKey,
    storageMode: "local" as const,
  };
}

export async function persistArtifactBlob({
  buffer,
  objectKey,
}: {
  buffer: Buffer;
  objectKey: string;
}) {
  const root = resolveStorageRoot("SENTRY_ARTIFACT_DIR", ["storage", "artifacts-v2"]);
  const targetPath = path.join(root, ...objectKey.split("/"));
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, buffer);
  return {
    objectKey,
    storageMode: "local" as const,
  };
}

export async function readArtifactBlob(objectKey: string) {
  const root = resolveStorageRoot("SENTRY_ARTIFACT_DIR", ["storage", "artifacts-v2"]);
  const targetPath = path.join(root, ...objectKey.split("/"));
  return readFile(targetPath);
}
