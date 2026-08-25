import { describe, expect, it } from "vitest";

import { buildScopedUploadLookup } from "@/lib/uploads/scoped-upload-lookup";

describe("extracted-text upload lookup", () => {
  it("scopes uploads by normalized locations_v2 ids", () => {
    expect(buildScopedUploadLookup(404, [37, 41])).toEqual({
      id: 404,
      location_id: { in: [37, 41] },
      superseded_by: null,
    });
  });
});
