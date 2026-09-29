import { describe, expect, it } from "vitest";
import { matchPhoto } from "./photo-day";

const people = [
  { id: "luca", name: "Luca Brenner", jersey: "15" },
  { id: "jeff", name: "Jeff Bailey" },
  { id: "other", name: "Sam Ortega", jersey: "22" },
];

describe("photo day matching", () => {
  it("matches a jersey number with or without a name", () => {
    expect(matchPhoto("15_luca_brenner.jpg", people)).toBe("luca");
    expect(matchPhoto("15.jpg", people)).toBe("luca");
  });
  it("matches full names and coach prefixes", () => {
    expect(matchPhoto("luca-brenner.jpg", people)).toBe("luca");
    expect(matchPhoto("coach_jeff_bailey.jpg", people)).toBe("jeff");
  });
  it("leaves ambiguous or unknown names for review", () => {
    expect(matchPhoto("team-photo.jpg", people)).toBe("");
    expect(matchPhoto("15.jpg", [...people, { id: "another", name: "Another Player", jersey: "15" }])).toBe("");
  });
});