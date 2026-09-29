import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { Volume2, VolumeX, Heart, ArrowUpRight, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Btn, TextInput } from "@/components/ui-kit";
import { TeamPortrait } from "@/components/team-portrait";
import { ClipViewer } from "@/components/clip-viewer";
import type { getPublicTeam } from "@/lib/public-team.functions";
import { onColor } from "@/lib/colors";
import {
  computeRecord,
  computeStreak,
  formatGameDate,
  gameResult,
  lastGame,
  nextGame,
  type Coach,
  type Team,
  type Game,
  type Player,
} from "@/lib/team";

export type TeamPageData = NonNullable<Awaited<ReturnType<typeof getPublicTeam>>>;

export function TeamPageView({ data, bottomBar }: { data: TeamPageData; bottomBar?: React.ReactNode }) {
  const team = data.team as unknown as Team & {
    sports: { name: string } | null;
    organizations: { name: string } | null;
  };
  const players = (data.players ?? []) as unknown as Player[];
  const coaches = (data.coaches ?? []) as unknown as Coach[];
  const games = (data.games ?? []) as unknown as Game[];
  const sport = team.sports;

  const primary = team.primary_color;
  const secondary = team.secondary_color;
  const record = computeRecord(games);
  const streak = computeStreak(games);
  const upcoming = nextGame(games);
  const latest = lastGame(games);
  const highlights = data.highlights ?? [];
  const tags = data.highlightPlayers ?? [];
  const leaders = (data.leaders ?? []).filter((l) => l.game_id === latest?.id).sort((a, b) => (a.leader_rank ?? 9) - (b.leader_rank ?? 9)).slice(0, 3);
  const involved = data.involved ?? [];
  const statColumns = (team as unknown as { sports?: { player_stats?: { key: string; label: string }[] } }).sports?.player_stats ?? [];
  const [player, setPlayer] = useState<Player | null>(null);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [clip, setClip] = useState<(typeof highlights)[number] | null>(null);
  const playable = highlights.filter((h) => h.video_url);
  const [email, setEmail] = useState("");
  const [following, setFollowing] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [followerCount, setFollowerCount] = useState(data.followerCount ?? 0);
  const { user } = useAuth();
  const membership = useQuery({ queryKey: ["team-access", team.id, user?.id], enabled: !!user, queryFn: async () => {
    const { data: row, error } = await supabase.from("team_members").select("role").eq("team_id", team.id).eq("user_id", user?.id ?? "").maybeSingle();
    if (error) throw error;
    return row;
  } });

  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [soundHint, setSoundHint] = useState(true);

  return (
    <div
      className={bottomBar ? "min-h-screen bg-background pb-36 sm:pb-24" : "min-h-screen bg-background"}
      style={
        {
          "--team-primary": primary,
          "--team-secondary": secondary,
          "--team-on-primary": onColor(primary),
        } as React.CSSProperties
      }
    >
      <SiteHeader slim extra={membership.data?.role === "owner" || membership.data?.role === "contributor" ? <Link to="/admin/$teamId" params={{ teamId: team.id }} className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-bold uppercase hover:bg-surface-2">Manage team</Link> : null} />
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
              <button type="button"
                onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  v.muted = !v.muted;
                  setMuted(v.muted);
                  setSoundHint(false);
                  void v.play();
                }}
                className="absolute right-4 top-4 z-20 flex items-center gap-2"
                aria-label={muted ? "Turn sound on" : "Turn sound off"}
              >
                {muted && soundHint ? <span className="rounded-full bg-hero-scrim px-3 py-1.5 font-condensed text-sm font-bold uppercase tracking-wider text-hero-light backdrop-blur">Tap for sound</span> : null}
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-hero-scrim text-hero-light ring-1 ring-hero-light/30 backdrop-blur">
                  {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </span>
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
                  {team.name.slice(0, 1)}
                </span>
              )}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-4 pb-8 sm:px-6 sm:pb-12">
             <p className="font-condensed text-sm font-bold uppercase tracking-[0.2em] text-hero-light drop-shadow sm:text-base">
               {team.organizations?.name}
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
          <Stat label="Streak" value={streak ? `${streak.count}${streak.type}` : "—"} />
          <Stat
            label="Next game"
            value={upcoming ? upcoming.opponent : "—"}
            sub={upcoming ? formatGameDate(upcoming.game_date) : "Season complete"}
          />
          <Stat label="Roster" value={String(players.length)} sub="players" />
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        {leaders.length ? <Section title="Last game leaders"><p className="eyebrow mb-4 text-team-secondary">{latest ? `${latest.home_away === "away" ? "AT" : "VS"} ${latest.opponent} · ${formatGameDate(latest.game_date)}` : ""}</p><div className="grid gap-3 sm:grid-cols-3">{leaders.map((leader, index) => { const p = players.find((p) => p.id === leader.player_id); const stats = leader.stats && typeof leader.stats === "object" && !Array.isArray(leader.stats) ? leader.stats as Record<string, unknown> : {}; return <div key={leader.id} className="flex min-h-40 items-center gap-4 border-l-4 border-team bg-surface p-5"><span className="stat-number text-5xl text-team-secondary">0{index + 1}</span><div><p className="font-condensed text-2xl font-bold uppercase">{p?.first_name} {p?.last_name}</p><p className="mt-2 font-condensed text-lg font-semibold uppercase text-muted-foreground">{statColumns.filter((column) => stats[column.key] != null).map((column) => `${column.label} ${stats[column.key]}`).join(" · ")}</p></div></div>; })}</div></Section> : null}
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
                    {formatGameDate(g.game_date)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    <span className="mr-1.5 text-xs uppercase text-muted-foreground">
                      {g.home_away === "away" ? "AT" : "VS"}
                    </span>
                    {g.opponent}
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
              <TeamPortrait key={p.id} name={`${p.first_name} ${p.last_name}`} image={p.photo_url} fallback={p.jersey_number ?? "—"} detail={`#${p.jersey_number ?? "—"} · ${p.position ?? "—"}`} caption={p.grade ?? ""} onClick={() => setPlayer(p)} />
            ))}
            {players.length === 0 ? <Empty>Roster coming soon.</Empty> : null}
          </div>
        </Section>

        {/* Coaches */}
        {coaches.length ? (
          <Section title="Coaches">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {coaches.map((c) => (
                <TeamPortrait key={c.id} name={c.name} image={c.photo_url} fallback={c.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()} detail={c.title ?? "Coach"} caption="Coaching staff" onClick={() => setCoach(c)} />
              ))}
            </div>
          </Section>
        ) : null}

         <Section title="Highlights"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{highlights.map((highlight) => <Btn key={highlight.id} type="button" variant="ghost" className="block h-auto w-full overflow-hidden rounded-sm border border-border bg-surface p-0 text-left" onClick={() => setClip(highlight)}><div className="relative flex aspect-video items-center justify-center overflow-hidden bg-team">{team.logo_url ? <img src={team.logo_url} alt="" className="h-28 w-28 object-contain" /> : <span className="font-condensed text-6xl font-bold text-team-foreground">{team.name.slice(0, 1)}</span>}<span className="absolute flex h-16 w-16 items-center justify-center rounded-full bg-background/80 text-foreground"><span className="ml-1 text-2xl">▶</span></span></div><div className="p-4"><p className="eyebrow text-team-secondary">{highlight.featured ? "Featured · " : ""}{games.find((g) => g.id === highlight.game_id)?.opponent ?? "Team clip"}</p><h3 className="mt-1 font-condensed text-2xl font-bold uppercase">{highlight.title}</h3></div></Btn>)}</div>{highlights.length === 0 ? <Empty>No highlights yet.</Empty> : null}</Section>
        <Section title="Get involved"><div className="grid gap-3 sm:grid-cols-2">{involved.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="flex min-h-24 items-center justify-between gap-4 border-l-4 border-team bg-surface p-5 transition-colors hover:bg-surface-2"><div><p className="font-condensed text-2xl font-bold uppercase">{link.label}</p>{link.description ? <p className="mt-1 text-sm text-muted-foreground">{link.description}</p> : null}</div><ArrowUpRight className="h-6 w-6 shrink-0 text-team-secondary" /></a>)}</div>{involved.length === 0 ? <Empty>No links yet.</Empty> : null}</Section>
        <Section title="Follow this team"><div className="border-l-4 border-team bg-surface p-5 sm:p-7"><p className="font-condensed text-3xl font-bold uppercase">{followerCount.toLocaleString()} followers</p><p className="mt-2 text-sm text-muted-foreground">Stay connected with {team.name}.</p><form className="mt-5 flex max-w-lg flex-col gap-3 sm:flex-row" onSubmit={async (e) => { e.preventDefault(); if (following || followed) return; setFollowing(true); const { data: success, error } = await supabase.rpc("follow_team_by_email", { _team_id: team.id, _email: email.trim() }); setFollowing(false); if (error) toast.error(error.message); else if (success === "ok") { setFollowed(true); const { data: count } = await supabase.rpc("team_follower_count", { _team_id: team.id }); if (count != null) setFollowerCount(count); toast.success("You're following this team"); } else toast.error("Could not follow right now. Try again later."); }}><TextInput type="email" aria-label="Email address" required placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} disabled={followed} /><Btn type="submit" disabled={following || followed} className="shrink-0"><Heart className="mr-2 h-4 w-4" />{followed ? "Following" : following ? "Saving…" : "Follow"}</Btn></form></div></Section>
      </main>

      <footer className="border-t border-border py-8 text-center">
        <Link to="/" className="eyebrow text-muted-foreground hover:text-foreground">
          Powered by This Is My Team
        </Link>
      </footer>

      {player ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-0 sm:items-center sm:p-6"
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
              {highlights.filter((h) => tags.some((tag) => tag.highlight_id === h.id && tag.player_id === player.id)).length ? <div className="mt-5"><p className="eyebrow mb-2 text-team-secondary">Highlights</p><div className="flex flex-wrap gap-2">{highlights.filter((h) => tags.some((tag) => tag.highlight_id === h.id && tag.player_id === player.id)).map((h) => <Btn key={h.id} variant="outline" type="button" onClick={() => { setPlayer(null); setClip(h); }}>{h.title}</Btn>)}</div></div> : null}
              <Btn variant="outline"
                onClick={() => setPlayer(null)}
                className="mt-6 h-10 w-full rounded-md border border-input text-sm font-semibold hover:bg-secondary"
              >
                Close
              </Btn>
            </div>
          </div>
        </div>
      ) : null}
      {coach ? <div role="presentation" className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 sm:items-center sm:p-6" onClick={() => setCoach(null)}><div role="dialog" aria-modal="true" aria-label={coach.name} className="max-h-[90vh] w-full max-w-md overflow-y-auto border border-border bg-surface" onClick={(e) => e.stopPropagation()}>{coach.photo_url ? <img src={coach.photo_url} alt={coach.name} className="aspect-[4/3] w-full object-cover" /> : <div className="flex aspect-[4/3] items-center justify-center bg-team font-condensed text-7xl text-team-foreground">{coach.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}</div>}<div className="p-6"><p className="eyebrow text-team-secondary">{coach.title ?? "Coach"}</p><h3 className="display-xl mt-1 text-3xl">{coach.name}</h3>{coach.bio ? <p className="mt-4 text-sm">{coach.bio}</p> : null}<Btn type="button" variant="outline" className="mt-6 w-full" onClick={() => setCoach(null)}>Close</Btn></div></div></div> : null}
      {bottomBar}
      {clip ? <ClipViewer clips={playable} index={Math.max(0, playable.findIndex((h) => h.id === clip.id))} onIndex={(n) => setClip(playable[n])} onClose={() => setClip(null)} /> : null}
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

