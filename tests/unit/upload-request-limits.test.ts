import { afterEach, describe, expect, it } from "vitest";
import {
  acquireMultipartAdmission,
  getDeclaredRequestBytes,
  getMultipartAdmissionSnapshot,
  isDeclaredRequestTooLarge,
  MAX_MULTIPART_REQUEST_BYTES,
} from "@/lib/uploads/request-limits";

const releases: Array<() => void> = [];

afterEach(() => {
  while (releases.length > 0) releases.pop()?.();
  expect(getMultipartAdmissionSnapshot().reservedBytes).toBe(0);
});

function requestWithLength(length: string) {
  return new Request("http://test/upload", { headers: { "content-length": length } });
}

describe("multipart request limits", () => {
  it("rejects a declared body before parsing when it exceeds the platform limit", () => {
    const request = requestWithLength(String(MAX_MULTIPART_REQUEST_BYTES + 1));
    expect(getDeclaredRequestBytes(request)).toBe(MAX_MULTIPART_REQUEST_BYTES + 1);
    expect(isDeclaredRequestTooLarge(request)).toBe(true);
  });

  it("accepts the exact request boundary and treats invalid lengths as undeclared", () => {
    expect(isDeclaredRequestTooLarge(requestWithLength(String(MAX_MULTIPART_REQUEST_BYTES)))).toBe(false);
    expect(getDeclaredRequestBytes(requestWithLength("invalid"))).toBeNull();
  });

  it("bounds concurrent buffered requests and releases capacity idempotently", () => {
    for (let index = 0; index < 5; index += 1) {
      const release = acquireMultipartAdmission(requestWithLength(String(MAX_MULTIPART_REQUEST_BYTES)));
      expect(release).not.toBeNull();
      releases.push(release!);
    }

    expect(acquireMultipartAdmission(requestWithLength(String(MAX_MULTIPART_REQUEST_BYTES)))).toBeNull();
    const released = releases.pop()!;
    released();
    released();
    const replacement = acquireMultipartAdmission(requestWithLength(String(MAX_MULTIPART_REQUEST_BYTES)));
    expect(replacement).not.toBeNull();
    releases.push(replacement!);
  });
});
