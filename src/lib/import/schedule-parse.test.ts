import { describe, expect, it } from "vitest";
import { parseSchedulePaste } from "./schedule-parse";
import { tableToRoster, tableToSchedule } from "./columns";

describe("parseSchedulePaste", () => {
  it("handles commas with a loss", () => {
    const [g] = parseSchedulePaste("Aug 21, Valencia, Away, L 39-7", 2026);
    expect(g).toMatchObject({ game_date: "2026-08-21", opponent: "Valencia", home_away: "away", team_score: "7", opponent_score: "39" });
  });
  it("handles pipes", () => {
    const [g] = parseSchedulePaste("Aug 21 | Valencia | Away | L 39-7", 2026);
    expect(g).toMatchObject({ game_date: "2026-08-21", opponent: "Valencia", home_away: "away", team_score: "7" });
  });
  it("handles free text", () => {
    const [g] = parseSchedulePaste("10/2 at Lawndale 7pm", 2026);
    expect(g).toMatchObject({ game_date: "2026-10-02", opponent: "Lawndale", home_away: "away", game_time: "7:00 PM", team_score: "" });
  });
  it("handles a win with time and location", () => {
    const [g] = parseSchedulePaste("Sep 5, Culver City, Home, 7:00 PM, Normans Field, W 28-14", 2026);
    expect(g).toMatchObject({ opponent: "Culver City", home_away: "home", game_time: "7:00 PM", location: "Normans Field", team_score: "28", opponent_score: "14" });
  });
  it("handles vs prefix", () => {
    const [g] = parseSchedulePaste("Fri 9/12 vs Palisades", 2026);
    expect(g).toMatchObject({ game_date: "2026-09-12", opponent: "Palisades", home_away: "home" });
  });
});

describe("column mapping", () => {
  it("maps roster headers", () => {
    const rows = tableToRoster([["No.", "Player", "Yr", "Pos"], ["12", "Jordan Miles", "11", "qb"], ["7", "Sam Ortiz", "12", "Kicker"]], ["QB", "K"], "Varsity");
    expect(rows[0]).toMatchObject({ jersey_number: "12", first_name: "Jordan", last_name: "Miles", grade: "11", position: "QB", level: "Varsity" });
    expect(rows[1]?.warning).toContain("Kicker");
  });
  it("maps schedule headers", () => {
    const rows = tableToSchedule([["Date", "Opponent", "Site", "Result"], ["2026-08-21", "Valencia", "Away", "L 39-7"]], 2026);
    expect(rows[0]).toMatchObject({ opponent: "Valencia", home_away: "away", team_score: "7", opponent_score: "39" });
  });
});
