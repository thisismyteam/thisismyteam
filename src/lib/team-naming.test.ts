import { describe, expect, it } from "vitest";
import { organizationShortName, suggestedTeamName } from "./team-naming";

describe("team name suggestions", () => {
  it.each(["High School", "HS", "Academy", "School"])("strips trailing %s from the organization name", (suffix) => {
    expect(organizationShortName(`Beverly Hills ${suffix}`)).toBe("Beverly Hills");
    expect(suggestedTeamName(`Beverly Hills ${suffix}`, "Normans")).toBe("Beverly Hills Normans");
  });
  it("keeps the original name when there is no suffix", () => {
    expect(suggestedTeamName("Bay Ridge", "Lavenders")).toBe("Bay Ridge Lavenders");
  });
});