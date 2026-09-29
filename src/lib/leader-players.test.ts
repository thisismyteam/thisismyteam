import { describe, expect, it } from "vitest";
import type { Player } from "@/lib/team";
import { searchLeaderPlayers, sortedLeaderPlayers } from "./leader-players";

const player = (id: string, jersey_number: string | null, first_name: string, last_name: string) =>
  ({ id, jersey_number, first_name, last_name }) as Player;

describe("Game Leaders roster", () => {
  it("keeps all players, including duplicate jersey numbers, in numeric order", () => {
    const roster = [player("a", "22", "Zoe", "Lee"), player("luca", "15", "Luca", "Brenner"), player("c", "2", "Ali", "Chen"), player("d", "15", "Drew", "Gray"), player("e", null, "No", "Number")];
    expect(sortedLeaderPlayers(roster).map((p) => p.id)).toEqual(["c", "d", "luca", "a", "e"]);
    expect(roster[0]?.id).toBe("a");
  });

  it("searches by name or jersey without excluding a roster member", () => {
    const roster = [player("luca", "15", "Luca", "Brenner"), player("sam", "15", "Sam", "West")];
    expect(searchLeaderPlayers(roster, "15").map((p) => p.id)).toEqual(["luca", "sam"]);
    expect(searchLeaderPlayers(roster, "luca").map((p) => p.id)).toEqual(["luca"]);
    expect(searchLeaderPlayers(roster, "15 Brenner").map((p) => p.id)).toEqual(["luca"]);
  });
});