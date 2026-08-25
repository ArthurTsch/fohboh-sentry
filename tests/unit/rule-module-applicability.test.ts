import { describe, expect, it } from "vitest";

import { ruleAppliesToModule } from "../../src/lib/mge/engine";

describe("canonical rule module applicability", () => {
  it("keeps ingestion and trust-gate rules common to every certification", () => {
    expect(ruleAppliesToModule("R010", "M01")).toBe(true);
    expect(ruleAppliesToModule("R123", "M02")).toBe(true);
    expect(ruleAppliesToModule("R146", "M03")).toBe(true);
  });

  it("restricts recovery sections to their respective module", () => {
    expect(ruleAppliesToModule("R016", "M02")).toBe(true);
    expect(ruleAppliesToModule("R016", "M01")).toBe(false);
    expect(ruleAppliesToModule("R060", "M01")).toBe(true);
    expect(ruleAppliesToModule("R060", "M02")).toBe(false);
    expect(ruleAppliesToModule("R096", "M03")).toBe(true);
    expect(ruleAppliesToModule("R096", "M01")).toBe(false);
  });

  it("does not attach cross-module rules to a single-module CAAR", () => {
    expect(ruleAppliesToModule("R166", "M01")).toBe(false);
    expect(ruleAppliesToModule("R175", "M02")).toBe(false);
  });
});
