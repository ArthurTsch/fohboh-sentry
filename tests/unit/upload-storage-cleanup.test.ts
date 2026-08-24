import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteMany = vi.fn();
const findManyBlobs = vi.fn();
const findManyUploads = vi.fn();
const findManyTickets = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    object_blobs_v2: { deleteMany, findMany: findManyBlobs },
    support_tickets_v2: { findMany: findManyTickets },
    uploads_v2: { findMany: findManyUploads },
  },
}));

describe("upload blob cleanup", () => {
  beforeEach(() => {
    deleteMany.mockReset();
    findManyBlobs.mockReset();
    findManyUploads.mockReset();
    findManyTickets.mockReset();
    findManyBlobs.mockResolvedValue([
      { byte_count: BigInt(10), storage_key: "uploads:evidence/referenced.csv" },
      { byte_count: BigInt(20), storage_key: "uploads:support/referenced.txt" },
      { byte_count: BigInt(30), storage_key: "uploads:orphan.bin" },
    ]);
    findManyUploads.mockResolvedValue([{ s3_key: "evidence/referenced.csv" }]);
    findManyTickets.mockResolvedValue([{
      issue: `TICKET_V2:${JSON.stringify({
        attachments: [{
          contentType: "text/plain",
          id: "attachment-1",
          name: "referenced.txt",
          objectKey: "support/referenced.txt",
          sizeBytes: 20,
        }],
      })}`,
    }]);
  });

  it("reports only unreferenced objects during a dry run", async () => {
    const { cleanupUnreferencedUploadBlobs } = await import("@/lib/uploads/storage");
    const result = await cleanupUnreferencedUploadBlobs({ olderThan: new Date(0) });
    expect(result).toMatchObject({ applied: false, byteCount: BigInt(30), orphanCount: 1 });
    expect(result.keys).toEqual(["uploads:orphan.bin"]);
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("deletes only the reviewed orphan keys when apply is enabled", async () => {
    deleteMany.mockResolvedValue({ count: 1 });
    const { cleanupUnreferencedUploadBlobs } = await import("@/lib/uploads/storage");
    await cleanupUnreferencedUploadBlobs({ apply: true, olderThan: new Date(0) });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { storage_key: { in: ["uploads:orphan.bin"] } },
    });
  });
});
