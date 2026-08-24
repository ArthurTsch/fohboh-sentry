import { describe, expect, it } from "vitest";

import {
  buildAgreementUploadLookup,
  matchesAgreementUploadVendor,
} from "@/lib/governance/agreement-upload";

describe("governance agreement upload lookup", () => {
  it("uses the normalized location id that uploads_v2 persists", () => {
    const where = buildAgreementUploadLookup({
      artifactKey: "m01-agreement",
      moduleId: "M01",
      normalizedLocationId: 42,
    });

    expect(where).toEqual({
      artifact_key: "m01-agreement",
      location_id: 42,
      module: "M01",
      superseded_by: null,
    });
  });

  it("matches persisted vendor keys against display-name candidates without case sensitivity", () => {
    expect(matchesAgreementUploadVendor("toast", ["Toast", "toast"])).toBe(true);
    expect(matchesAgreementUploadVendor("DoorDash", ["Uber Eats", "ubereats"])).toBe(false);
  });
});
