import { describe, expect, it } from "vitest";

import {
  CANONICAL_RULE_CLAUSES,
  CANONICAL_RULES,
  getRuntimeRuleCrosswalk,
} from "../../src/lib/mge/canonical-registry";

describe("canonical rule registry", () => {
  it("contains exactly one definition and clause record for every R001-R198 rule", () => {
    const expected = Array.from({ length: 198 }, (_, index) => `R${String(index + 1).padStart(3, "0")}`);
    const definitions = CANONICAL_RULES.map((rule) => rule.ruleId);
    const clauses = CANONICAL_RULE_CLAUSES.map((rule) => rule.ruleId);

    expect([...new Set(definitions)].sort()).toEqual(expected);
    expect([...new Set(clauses)].sort()).toEqual(expected);
  });

  it("keeps every documented runtime-family mapping within the canonical registry", () => {
    const canonicalIds = new Set(CANONICAL_RULES.map((rule) => rule.ruleId));
    const mappings = getRuntimeRuleCrosswalk();

    expect(mappings.length).toBeGreaterThan(0);
    expect(mappings.every((mapping) => mapping.canonicalRuleIds.length > 0)).toBe(true);
    expect(mappings.flatMap((mapping) => mapping.canonicalRuleIds).every((ruleId) => canonicalIds.has(ruleId))).toBe(true);
  });
});
