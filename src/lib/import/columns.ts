import { parseRosterPaste, type RosterDraftRow } from "@/lib/team";
import { homeAwayWord, parseDate, parseScheduleTokens, type ScheduleDraftRow } from "@/lib/import/schedule-parse";

export type RosterImportRow = RosterDraftRow & { warning?: string };

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9#/]+/g, " ").trim();

const ROSTER_ALIASES: Record<string, string[]> = {
  jersey: ["#", "no", "no.", "num", "number", "jersey", "jersey #", "jersey number", "uniform", "uni"],
  first: ["first", "first name", "fname", "given name"],
  last: ["last", "last name", "lname", "surname", "family name"],
  name: ["name", "player", "player name", "full name", "athlete"],
  grade: ["grade", "gr", "yr", "year", "class", "cl", "grad year"],
  level: ["level", "squad", "team level"],
  position: ["pos", "position", "positions", "pos."],
};

const SCHEDULE_ALIASES: Record<string, string[]> = {
  date: ["date", "day", "game date"],
  opponent: ["opponent", "opp", "opponents", "vs", "team", "school", "versus", "matchup"],
  ha: ["h/a", "ha", "home/away", "home away", "site", "h a", "home or away"],
  time: ["time", "start", "start time", "kickoff", "tip"],
  location: ["location", "venue", "field", "place", "where", "facility", "stadium"],
  result: ["result", "score", "final", "w/l", "outcome", "final score"],
};

function mapHeader(row: string[], aliases: Record<string, string[]>) {
  const map: Record<string, number> = {};
  row.forEach((cell, i) => {
    const h = norm(cell).replace(/\.$/, "");
    for (const [key, list] of Object.entries(aliases)) {
      if (map[key] == null && list.includes(h)) { map[key] = i; break; }
    }
  });
  return map;
}

function findHeader(rows: string[][], aliases: Record<string, string[]>) {
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const map = mapHeader(rows[i]!, aliases);
    if (Object.keys(map).length >= 2) return { index: i, map };
  }
  return null;
}

export function matchPosition(value: string, positions: string[]) {
  const parts = value.split(/[\/,&\s]+/).map((p) => p.trim().toUpperCase()).filter(Boolean);
  for (const p of parts) {
    const hit = positions.find((pos) => pos.toUpperCase() === p);
    if (hit) return hit;
  }
  return "";
}

function splitName(full: string) {
  const t = full.trim();
  if (t.includes(",")) {
    const [last = "", first = ""] = t.split(",").map((s) => s.trim());
    return { first, last };
  }
  const [first = "", ...rest] = t.split(/\s+/);
  return { first, last: rest.join(" ") };
}

function finishRoster(r: RosterDraftRow, rawPosition: string, positions: string[]): RosterImportRow {
  const position = rawPosition ? matchPosition(rawPosition, positions) : "";
  const warnings: string[] = [];
  if (rawPosition && !position) warnings.push(`Position "${rawPosition}" not in list`);
  if (!r.last_name) warnings.push("No last name");
  return { ...r, jersey_number: r.jersey_number.replace(/^#/, ""), position, ...(warnings.length ? { warning: warnings.join(" · ") } : {}) };
}

export function tableToRoster(rows: string[][], positions: string[], defaultLevel: string): RosterImportRow[] {
  const clean = rows.map((r) => r.map((c) => String(c ?? "").trim())).filter((r) => r.some(Boolean));
  const header = findHeader(clean, ROSTER_ALIASES);
  if (!header) {
    return parseRosterPaste(clean.map((r) => r.filter(Boolean).join("\t")).join("\n"), defaultLevel).map((r) => finishRoster(r, "", positions));
  }
  const { map } = header;
  const get = (row: string[], key: string) => (map[key] != null ? row[map[key]!] ?? "" : "");
  return clean.slice(header.index + 1).map((row) => {
    let first = get(row, "first");
    let last = get(row, "last");
    if (!first && !last) ({ first, last } = splitName(get(row, "name")));
    else if (first && !last && first.includes(" ")) ({ first, last } = splitName(first));
    return finishRoster(
      { jersey_number: get(row, "jersey"), first_name: first, last_name: last, grade: get(row, "grade"), level: get(row, "level") || defaultLevel, position: "" },
      get(row, "position"),
      positions,
    );
  }).filter((r) => r.first_name);
}

export function tableToSchedule(rows: string[][], year: number): ScheduleDraftRow[] {
  const clean = rows.map((r) => r.map((c) => String(c ?? "").trim())).filter((r) => r.some(Boolean));
  const header = findHeader(clean, SCHEDULE_ALIASES);
  if (!header) return clean.map((r) => parseScheduleTokens(r.filter(Boolean), year)).filter((r) => r.opponent);
  const { map } = header;
  const get = (row: string[], key: string) => (map[key] != null ? row[map[key]!] ?? "" : "");
  return clean.slice(header.index + 1).map((row) => {
    const date = get(row, "date");
    const haCell = get(row, "ha");
    const tokens = [date && !parseDate(date, year) ? "" : date, get(row, "opponent"), haCell, get(row, "time"), get(row, "location"), get(row, "result")];
    const parsed = parseScheduleTokens(tokens.filter(Boolean), year);
    const ha = homeAwayWord(haCell);
    return ha ? { ...parsed, home_away: ha } : parsed;
  }).filter((r) => r.opponent);
}
