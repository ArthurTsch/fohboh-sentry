import { describe, expect, it } from "vitest";
import { mapTeamRoleToAppRole, normalizeAccessScope, normalizeTeamRole } from "@/lib/auth/team-access";

describe("team role and scope normalization", () => {
  it.each([
    ["Owner", "Admin"],
    ["Finance", "Admin"],
    ["Location Manager", "Manager"],
    ["Read-only", "Viewer"],
  ] as const)("maps %s to %s", (teamRole, appRole) => {
    expect(mapTeamRoleToAppRole(teamRole)).toBe(appRole);
  });

  it("fails closed for unknown roles and scopes", () => {
    expect(normalizeTeamRole("Global Admin")).toBeNull();
    expect(normalizeAccessScope("anything_else")).toBe("all_locations");
  });
});
