import { describe, expect, it } from "vitest";

import { uniqueRuleCitationsByRuleId } from "@/lib/certification/rule-citation-persistence";

describe("rule citation persistence", () => {
  it("keeps only the first citation for each rule in a certification run", () => {
    const citations = uniqueRuleCitationsByRuleId([
      { ruleId: "R010", source: "assessment" },
      { ruleId: "R010", source: "duplicate" },
      { ruleId: "R019", source: "assessment" },
    ]);

    expect(citations).toEqual([
      { ruleId: "R010", source: "assessment" },
      { ruleId: "R019", source: "assessment" },
    ]);
  });

  it("excludes overall citations already persisted for the module assessment", () => {
    const citations = uniqueRuleCitationsByRuleId(
      [{ ruleId: "R019" }, { ruleId: "R123" }],
      new Set(["R019"]),
    );

    expect(citations).toEqual([{ ruleId: "R123" }]);
  });
});
