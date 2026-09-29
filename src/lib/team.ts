export type StatColumn = { key: string; label: string };

export type Sport = {
  id: string;
  slug: string;
  name: string;
  period_label: string;
  period_count: number;
  positions: string[];
  player_stats: StatColumn[];
  team_headline_stats: StatColumn[];
  sort_order: number;
};

export type Organization = {
  id: string;
  name: string;
  org_type: "school" | "club" | "league";
  city: string | null;
  state: string | null;
};

export type Team = {
  id: string;
  organization_id: string;
  sport_id: string;
  name: string;
  mascot: string | null;
  level: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  hero_video_url: string | null;
  tagline: string | null;
  published: boolean;
};

export type Season = { id: string; team_id: string; label: string; year: number; is_current: boolean };

export type Player = {
  id: string;
  jersey_number: string | null;
  first_name: string;
  last_name: string;
  grade: string | null;
  level: string | null;
  position: string | null;
  height: string | null;
  weight: string | null;
  hometown: string | null;
  bio: string | null;
  photo_url: string | null;
  sort_order: number;
};

export type Coach = {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  photo_url: string | null;
  sort_order: number;
};

export type Game = {
  id: string;
  game_date: string | null;
  game_time: string | null;
  opponent: string;
  home_away: "home" | "away" | "neutral";
  location: string | null;
  team_score: number | null;
  opponent_score: number | null;
  status: "scheduled" | "final" | "postponed" | "canceled";
};

export const TEAM_LEVELS = ["Varsity", "JV", "Freshman", "One program"] as const;
export const ORG_TYPES = [
  { value: "school", label: "School" },
  { value: "club", label: "Club" },
  { value: "league", label: "League" },
] as const;

export function gameResult(game: Game): "W" | "L" | "T" | null {
  if (game.status !== "final" || game.team_score == null || game.opponent_score == null) return null;
  if (game.team_score > game.opponent_score) return "W";
  if (game.team_score < game.opponent_score) return "L";
  return "T";
}

function byDateAsc(a: Game, b: Game) {
  return (a.game_date ?? "9999").localeCompare(b.game_date ?? "9999");
}

export function computeRecord(games: Game[]) {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  for (const g of games) {
    const r = gameResult(g);
    if (r === "W") wins += 1;
    else if (r === "L") losses += 1;
    else if (r === "T") ties += 1;
  }
  return { wins, losses, ties };
}

export function computeStreak(games: Game[]) {
  const played = [...games]
    .filter((g) => gameResult(g) !== null)
    .sort(byDateAsc)
    .reverse();
  if (played.length === 0) return null;
  const latest = gameResult(played[0]!);
  let count = 0;
  for (const g of played) {
    if (gameResult(g) !== latest) break;
    count += 1;
  }
  return { type: latest as "W" | "L" | "T", count };
}

export function nextGame(games: Game[]) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    [...games]
      .filter((g) => g.status === "scheduled" && (g.game_date ?? "9999") >= today)
      .sort(byDateAsc)[0] ?? null
  );
}

export function lastGame(games: Game[]) {
  return (
    [...games]
      .filter((g) => gameResult(g) !== null)
      .sort(byDateAsc)
      .reverse()[0] ?? null
  );
}

export function formatGameDate(date: string | null) {
  if (!date) return "TBD";
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export type RosterDraftRow = {
  jersey_number: string;
  first_name: string;
  last_name: string;
  grade: string;
  level: string;
  position: string;
};

export function emptyRosterRow(level = ""): RosterDraftRow {
  return { jersey_number: "", first_name: "", last_name: "", grade: "", level, position: "" };
}

/** Parse pasted roster text: one player per line — jersey, first, last, grade, level. */
export function parseRosterPaste(text: string, defaultLevel = ""): RosterDraftRow[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line
        .split(/\t|,|\s{2,}|\s*\|\s*/)
        .map((p) => p.trim())
        .filter(Boolean);

      let jersey = "";
      let rest = parts;
      const firstPart = parts[0] ?? "";
      if (firstPart && /^#?\d{1,3}$/.test(firstPart)) {
        jersey = firstPart.replace("#", "");
        rest = parts.slice(1);
      }

      // Single-token fallback: "12 Jordan Miles 11 Varsity"
      const only = rest[0];
      if (rest.length === 1 && only && only.includes(" ")) {
        rest = only.split(/\s+/);
      }

      const [first = "", last = "", grade = "", level = ""] = rest;
      return {
        jersey_number: jersey,
        first_name: first,
        last_name: last,
        grade,
        level: level || defaultLevel,
        position: "",
      };
    })
    .filter((r) => r.first_name.length > 0);
}
