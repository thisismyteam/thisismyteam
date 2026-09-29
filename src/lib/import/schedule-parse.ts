export type HomeAway = "home" | "away" | "neutral";

export type ScheduleDraftRow = {
  game_date: string; // YYYY-MM-DD or ""
  game_time: string;
  opponent: string;
  home_away: HomeAway;
  location: string;
  team_score: string;
  opponent_score: string;
  warning?: string;
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
const WEEKDAY = "(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\\.?,?\\s+";
const MONTH_NAME = "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const DATE_PATTERNS: { re: RegExp; parse: (m: RegExpMatchArray, year: number) => string | null }[] = [
  { re: /^(\d{4})-(\d{1,2})-(\d{1,2})/, parse: (m) => iso(+m[1]!, +m[2]!, +m[3]!) },
  {
    re: new RegExp(`^(?:${WEEKDAY})?${MONTH_NAME}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?`, "i"),
    parse: (m, y) => iso(m[3] ? +m[3] : y, MONTHS[m[1]!.toLowerCase()]!, +m[2]!),
  },
  {
    re: new RegExp(`^(?:${WEEKDAY})?(\\d{1,2})\\s+${MONTH_NAME}(?:,?\\s+(\\d{4}))?`, "i"),
    parse: (m, y) => iso(m[3] ? +m[3] : y, MONTHS[m[2]!.toLowerCase()]!, +m[1]!),
  },
  {
    re: new RegExp(`^(?:${WEEKDAY})?(\\d{1,2})[/.](\\d{1,2})(?:[/.](\\d{2,4}))?(?![\\d:])`, "i"),
    parse: (m, y) => {
      const yr = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : y;
      return iso(yr, +m[1]!, +m[2]!);
    },
  },
];

function iso(y: number, m: number, d: number) {
  if (!y || !m || !d || m > 12 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function parseDate(text: string, year: number): string | null {
  const t = text.trim();
  for (const p of DATE_PATTERNS) {
    const m = t.match(p.re);
    if (m) return p.parse(m, year);
  }
  return null;
}

function formatTime(h: number, min: number, ap?: string) {
  let hour = h;
  let suffix = ap ? (ap.toLowerCase().startsWith("a") ? "AM" : "PM") : hour >= 12 ? "PM" : hour < 8 ? "PM" : "AM";
  if (hour > 12) { hour -= 12; suffix = "PM"; }
  if (hour === 0) hour = 12;
  return `${hour}:${String(min).padStart(2, "0")} ${suffix}`;
}

export function homeAwayWord(text: string): HomeAway | null {
  const t = text.trim().toLowerCase().replace(/\.$/, "");
  if (["home", "h", "vs", "v", "versus"].includes(t)) return "home";
  if (["away", "a", "at", "@", "road"].includes(t)) return "away";
  if (["neutral", "n", "neutral site"].includes(t)) return "neutral";
  return null;
}

type Parsed = {
  date?: string;
  time?: string;
  ha?: HomeAway | undefined;
  us?: number;
  them?: number;
  texts: string[];
};

function extract(token: string, year: number, out: Parsed) {
  let t = token.trim();
  if (!t) return;

  const whole = homeAwayWord(t);
  if (whole) { out.ha ??= whole; return; }

  if (!out.date) {
    for (const p of DATE_PATTERNS) {
      const m = t.match(p.re);
      if (m) {
        const d = p.parse(m, year);
        if (d) { out.date = d; t = t.slice(m[0].length).trim(); }
        break;
      }
    }
  }

  const res = t.match(/\b([WLT])\s*,?\s*(\d{1,3})\s*[-–]\s*(\d{1,3})\b/i);
  if (res && out.us == null) {
    const a = +res[2]!, b = +res[3]!;
    const kind = res[1]!.toUpperCase();
    if (kind === "W") { out.us = Math.max(a, b); out.them = Math.min(a, b); }
    else if (kind === "L") { out.us = Math.min(a, b); out.them = Math.max(a, b); }
    else { out.us = a; out.them = b; }
    t = (t.slice(0, res.index) + " " + t.slice(res.index! + res[0].length)).trim();
  } else if (out.us == null) {
    const bare = t.match(/^(\d{1,3})\s*[-–]\s*(\d{1,3})$/);
    if (bare) { out.us = +bare[1]!; out.them = +bare[2]!; t = ""; }
  }

  const time = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m?\.?(?=\s|$)/i) ?? t.match(/\b(\d{1,2}):(\d{2})\b/);
  if (time && !out.time) {
    out.time = formatTime(+time[1]!, time[2] ? +time[2] : 0, time[3]);
    t = (t.slice(0, time.index) + " " + t.slice(time.index! + time[0].length)).trim();
  }
  if (/^(tba|tbd)$/i.test(t)) return;

  const prefix = t.match(/^(at|@|vs\.?|v\.?|versus)\s+/i);
  if (prefix) {
    out.ha ??= homeAwayWord(prefix[1]!) ?? undefined;
    t = t.slice(prefix[0].length).trim();
  } else if (t.startsWith("@")) {
    out.ha ??= "away";
    t = t.slice(1).trim();
  }
  const suffix = t.match(/\s+\((home|away|h|a|neutral)\)$/i);
  if (suffix) { out.ha ??= homeAwayWord(suffix[1]!) ?? undefined; t = t.slice(0, suffix.index).trim(); }

  t = t.replace(/^[-–:,\s]+|[-–:,\s]+$/g, "");
  if (t) out.texts.push(t);
}

export function parseScheduleTokens(tokens: string[], year: number): ScheduleDraftRow {
  const out: Parsed = { texts: [] };
  for (const token of tokens) extract(token, year, out);
  const [opponent = "", ...rest] = out.texts;
  const warnings: string[] = [];
  if (!opponent) warnings.push("No opponent");
  if (!out.date) warnings.push("No date");
  return {
    game_date: out.date ?? "",
    game_time: out.time ?? "",
    opponent,
    home_away: out.ha ?? "home",
    location: rest.join(", "),
    team_score: out.us != null ? String(out.us) : "",
    opponent_score: out.them != null ? String(out.them) : "",
    ...(warnings.length ? { warning: warnings.join(" · ") } : {}),
  };
}

export function splitLine(line: string) {
  const normalized = line.replace(/([A-Za-z]{3,9}\.?\s+\d{1,2}(?:st|nd|rd|th)?),\s*(\d{4})/g, "$1 $2");
  return normalized.split(/\t|\s*\|\s*|\s*,\s*|\s{2,}|\s+[–—]\s+|\s+-\s+/).map((p) => p.trim()).filter(Boolean);
}

export function parseSchedulePaste(text: string, year: number): ScheduleDraftRow[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => parseScheduleTokens(splitLine(line), year))
    .filter((r) => r.opponent || r.game_date);
}
