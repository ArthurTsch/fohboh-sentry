import { describe, expect, it } from "vitest";

import { buildCertificationUploadLookup } from "@/lib/certification/upload-lookup";

describe("certification upload lookup", () => {
  it("uses the normalized location id where uploads_v2 records are stored", () => {
    expect(buildCertificationUploadLookup(42)).toEqual({
      location_id: 42,
      superseded_by: null,
    });
  });
});
