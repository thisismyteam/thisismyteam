import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Volume2, VolumeX, Play, Heart, Film, Trophy, HandHeart } from "lucide-react";
import { getPublicTeam } from "@/lib/public-team.functions";
import { onColor } from "@/lib/colors";
import {
  computeRecord,
  computeStreak,
  formatGameDate,
  gameResult,
  nextGame,
  type Coach,
  type Game,
  type Player,
} from "@/lib/team";

export const Route = createFileRoute("/$slug")({
  loader: async ({ params }) => {
    const data = await getPublicTeam({ data: { slug: params.slug } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Team not found" }, { name: "robots", content: "noindex" }],
      };
    }
    const team = loaderData.team as { name: string; tagline: string | null; mascot: string | null };
    const title = `${team.name} — This Is My Team`;
    const description =
      team.tagline ?? `Follow ${team.name}: roster, schedule, results and highlights.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <p className="text-sm text-muted-foreground">This team page didn't load. Try refreshing.</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="display-xl text-5xl">No team here</h1>
      <p className="text-sm text-muted-foreground">
        This team address isn't taken yet — or the team isn't live.
      </p>
      <Link to="/" className="text-sm font-semibold text-primary underline">
        Back to This Is My Team
      </Link>
    </div>
  ),
  component: TeamPage,
});

function TeamPage() {
  const data = Route.useLoaderData();
  const team = data.team as Record<string, any>;
  const players = (data.players ?? []) as unknown as Player[];
  const coaches = (data.coaches ?? []) as unknown as Coach[];
  const games = (data.games ?? []) as unknown as Game[];
  const sport = team.sports as { name: string } | null;

  const primary = team.primary_color as string;
  const secondary = team.secondary_color as string;
  const record = computeRecord(games);
  const streak = computeStreak(games);
  const upcoming = nextGame(games);
  const [player, setPlayer] = useState<Player | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  return (
    <div
      className="min-h-screen bg-background"
      style={
        {
          "--team-primary": primary,
          "--team-secondary": secondary,
          "--team-on-primary": onColor(primary),
        } as React.CSSProperties
      }
    >
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="relative h-[62vh] min-h-[420px] w-full sm:h-[70vh]">
          {team.hero_video_url ? (
            <>
              <video
                ref={videoRef}
                src={team.hero_video_url}
                autoPlay
                muted={muted}
                loop
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
              />
              <button
                onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  v.muted = !v.muted;
                  setMuted(v.muted);
                  void v.play();
                }}
                className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur"
                aria-label={muted ? "Turn sound on" : "Turn sound off"}
              >
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
            </>
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center field-lines"
              style={{
                background: `linear-gradient(160deg, ${primary} 0%, ${primary} 55%, ${secondary} 190%)`,
              }}
            >
              {team.logo_url ? (
                <img
                  src={team.logo_url}
                  alt={`${team.name} logo`}
                  className="h-40 w-40 rounded-full object-cover sm:h-52 sm:w-52"
                />
              ) : (
                <span
                  className="display-xl text-8xl"
                  style={{ color: onColor(primary) }}
                >
                  {String(team.name).slice(0, 1)}
                </span>
              )}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-4 pb-8 sm:px-6 sm:pb-12">
            <p className="eyebrow" style={{ color: secondary }}>
              {(team.organizations as any)?.name} · {sport?.name} · {team.level}
            </p>
            <h1 className="display-xl mt-2 text-5xl leading-[0.9] sm:text-7xl lg:text-8xl">
              {team.name}
            </h1>
            {team.tagline ? (
              <p className="mt-3 max-w-xl text-base text-muted-foreground sm:text-lg">
                {team.tagline}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      {/* Record bar */}
      <section
        className="border-y border-border"
        style={{ backgroundColor: primary, color: onColor(primary) }}
      >
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 py-6 sm:grid-cols-4 sm:px-6">
          <Stat label="Record" value={`${record.wins}-${record.losses}`} />
          <Stat label="Streak" value={streak || "—"} />
          <Stat
            label="Next game"
            value={upcoming ? (upcoming.opponent_name ?? "TBD") : "—"}
            sub={upcoming ? formatGameDate(upcoming) : "Season complete"}
          />
          <Stat label="Roster" value={String(players.length)} sub="players" />
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        {/* Schedule */}
        <Section title="Schedule">
          <div className="flex flex-col gap-2">
            {games.map((g) => {
              const result = gameResult(g);
              return (
                <div
                  key={g.id}
                  className="panel flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
                >
                  <span className="w-28 shrink-0 text-xs text-muted-foreground">
                    {formatGameDate(g)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    <span className="mr-1.5 text-xs uppercase text-muted-foreground">
                      {g.home_away === "home" ? "vs" : g.home_away === "away" ? "at" : "vs"}
                    </span>
                    {g.opponent_name}
                  </span>
                  {g.location ? (
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      {g.location}
                    </span>
                  ) : null}
                  {g.status === "final" ? (
                    <span className="flex items-center gap-2">
                      <span
                        className={`stat-number text-lg ${
                          result === "W" ? "text-win" : result === "L" ? "text-loss" : ""
                        }`}
                      >
                        {result}
                      </span>
                      <span className="stat-number text-lg">
                        {g.team_score}-{g.opponent_score}
                      </span>
                    </span>
                  ) : (
                    <span className="eyebrow text-muted-foreground">
                      {g.game_time ? g.game_time.slice(0, 5) : "TBD"}
                    </span>
                  )}
                </div>
              );
            })}
            {games.length === 0 ? <Empty>Schedule coming soon.</Empty> : null}
          </div>
        </Section>

        {/* Roster */}
        <Section title="Roster">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlayer(p)}
                className="panel group overflow-hidden text-left transition-transform hover:-translate-y-0.5"
              >
                <div
                  className="flex aspect-[3/4] items-center justify-center overflow-hidden"
                  style={{ backgroundColor: primary }}
                >
                  {p.photo_url ? (
                    <img
                      src={p.photo_url}
                      alt={`${p.first_name} ${p.last_name}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="stat-number text-5xl" style={{ color: onColor(primary) }}>
                      {p.jersey_number ?? "—"}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-bold uppercase">
                    {p.first_name} {p.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    #{p.jersey_number ?? "—"} · {p.position ?? "—"}
                    {p.grade ? ` · ${p.grade}` : ""}
                  </p>
                </div>
              </button>
            ))}
            {players.length === 0 ? <Empty>Roster coming soon.</Empty> : null}
          </div>
        </Section>

        {/* Coaches */}
        {coaches.length ? (
          <Section title="Coaches">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {coaches.map((c) => (
                <div key={c.id} className="panel flex items-center gap-3 p-3">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full"
                    style={{ backgroundColor: secondary }}
                  >
                    {c.photo_url ? (
                      <img src={c.photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold" style={{ color: onColor(secondary) }}>
                        {c.name.slice(0, 1)}
                      </span>
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold uppercase">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {/* Reserved sections */}
        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          <Placeholder icon={<Film className="h-5 w-5" />} title="Highlights">
            Video highlights from every game land here.
          </Placeholder>
          <Placeholder icon={<Trophy className="h-5 w-5" />} title="Last game leaders">
            Top performers from the most recent game.
          </Placeholder>
          <Placeholder icon={<HandHeart className="h-5 w-5" />} title="Get involved">
            Volunteer, sponsor and booster links.
          </Placeholder>
          <div className="panel flex flex-col items-start gap-3 p-6">
            <p className="eyebrow text-muted-foreground">Fans</p>
            <h3 className="text-2xl">Follow this team</h3>
            <button
              disabled
              className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-bold uppercase tracking-wide opacity-70"
              style={{ backgroundColor: primary, color: onColor(primary) }}
            >
              <Heart className="h-4 w-4" /> Follow
            </button>
            <p className="text-xs text-muted-foreground">Following opens up soon.</p>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-8 text-center">
        <Link to="/" className="eyebrow text-muted-foreground hover:text-foreground">
          Powered by This Is My Team
        </Link>
      </footer>

      {player ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6"
          onClick={() => setPlayer(null)}
        >
          <div
            className="panel w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex aspect-[4/3] items-center justify-center overflow-hidden"
              style={{ backgroundColor: primary }}
            >
              {player.photo_url ? (
                <img src={player.photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="stat-number text-7xl" style={{ color: onColor(primary) }}>
                  {player.jersey_number ?? "—"}
                </span>
              )}
            </div>
            <div className="p-6">
              <p className="eyebrow text-muted-foreground">
                #{player.jersey_number ?? "—"} · {player.position ?? "—"}
              </p>
              <h3 className="display-xl mt-1 text-3xl">
                {player.first_name} {player.last_name}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {[player.grade, player.level, player.height, player.weight]
                  .filter(Boolean)
                  .join(" · ") || team.name}
              </p>
              {player.bio ? <p className="mt-4 text-sm">{player.bio}</p> : null}
              <button
                onClick={() => setPlayer(null)}
                className="mt-6 h-10 w-full rounded-md border border-input text-sm font-semibold hover:bg-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-2 py-2">
      <p className="eyebrow opacity-70">{label}</p>
      <p className="stat-number mt-1 text-3xl leading-none sm:text-4xl">{value}</p>
      {sub ? <p className="mt-1 text-xs opacity-70">{sub}</p> : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="display-xl mb-5 text-3xl sm:text-4xl">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="panel col-span-full p-8 text-center text-sm text-muted-foreground">{children}</p>
  );
}

function Placeholder({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel flex flex-col gap-2 p-6">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-muted-foreground">
        {icon}
      </span>
      <h3 className="text-2xl">{title}</h3>
      <p className="text-sm text-muted-foreground">{children}</p>
      <span className="eyebrow mt-2 inline-flex items-center gap-1 text-muted-foreground">
        <Play className="h-3 w-3" /> Coming next
      </span>
    </div>
  );
}
