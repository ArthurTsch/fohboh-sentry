import { mkdir, writeFile } from "fs/promises";
import path from "path";

export async function persistUploadBlob({
  buffer,
  objectKey,
}: {
  buffer: Buffer;
  objectKey: string;
}) {
  const root = process.env.SENTRY_UPLOAD_DIR?.trim()
    ? path.resolve(process.env.SENTRY_UPLOAD_DIR.trim())
    : path.join(process.cwd(), "storage", "uploads-v2");
  const targetPath = path.join(root, ...objectKey.split("/"));
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, buffer);
  return {
    objectKey,
    storageMode: "local" as const,
  };
}
