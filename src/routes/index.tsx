import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { LandingVideoHero } from "@/components/landing-video-hero";
import type { Sport } from "@/lib/team";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "This Is My Team — Every team deserves to be seen" },
      {
        name: "description",
        content:
          "Any school, club or league can launch a pro-level home for their team in minutes. Roster, schedule, highlights and fans, all in one place.",
      },
      { property: "og:title", content: "This Is My Team — Every team deserves to be seen" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content:
          "Every team deserves to be seen.",
      },
      { name: "twitter:title", content: "This Is My Team" },
      { name: "twitter:description", content: "Every team deserves to be seen." },
      { property: "og:url", content: "https://thisismyteam.app/" },
      { property: "og:image", content: "https://thisismyteam.app/og-image.jpg" },
      { name: "twitter:image", content: "https://thisismyteam.app/og-image.jpg" },
    ],
    links: [
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "canonical", href: "https://thisismyteam.app/" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  component: Landing,
});

const SPORT_ART: Record<string, { emoji: string; blurb: string }> = {
  football: { emoji: "🏈", blurb: "Quarters, depth chart and Friday night scores." },
  basketball: { emoji: "🏀", blurb: "Quarters, box scores and leading scorers." },
  soccer: { emoji: "⚽", blurb: "Halves, goals, assists and clean sheets." },
};

function Landing() {
  const sportsQuery = useQuery({
    queryKey: ["sports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sports")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as Sport[];
    },
  });

  const featuredQuery = useQuery({
    queryKey: ["featured-teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, slug, logo_url, primary_color, secondary_color, mascot, sports(name)")
        .eq("published", true)
        .order("published_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <LandingVideoHero />

      {/* ---------- Mission ---------- */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <p className="eyebrow text-primary">thisismyteam.app</p>
          <h1 className="display-xl mt-4 max-w-4xl text-[clamp(2.75rem,10vw,7rem)] leading-[1.05]">
            Every team
            <br />
            deserves to
            <br />
            <span className="text-primary">be seen.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            Any school, club or league can launch a pro-level home for their team in minutes. Fans
            follow, watch the highlights, get to know the players and get involved.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex h-14 items-center justify-center rounded-md bg-primary px-8 text-base font-black uppercase tracking-wide text-primary-foreground transition-transform hover:scale-[1.02]"
            >
              Create my team
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex h-14 items-center justify-center rounded-md border border-input px-8 text-base font-semibold transition-colors hover:bg-secondary"
            >
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* ---------- Sport picker ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <p className="eyebrow text-muted-foreground">Step one</p>
        <h2 className="mt-3 text-3xl sm:text-5xl">Pick your sport</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {(sportsQuery.data ?? []).map((sport) => {
            const art = SPORT_ART[sport.slug] ?? { emoji: "🏅", blurb: "" };
            return (
              <Link
                key={sport.id}
                to="/auth"
                search={{ mode: "signup", sport: sport.slug }}
                className="panel group relative overflow-hidden p-6 transition-colors hover:border-primary sm:p-8"
              >
                <span className="text-4xl sm:text-5xl">{art.emoji}</span>
                <h3 className="mt-5 text-2xl sm:text-3xl">{sport.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{art.blurb}</p>
                <p className="eyebrow mt-6 text-primary">Start with {sport.name} →</p>
              </Link>
            );
          })}
          {sportsQuery.isLoading
            ? [0, 1, 2].map((i) => <div key={i} className="panel h-56 animate-pulse" />)
            : null}
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how-it-works" className="border-y border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <p className="eyebrow text-primary">How it works</p>
          <h2 className="mt-3 text-3xl sm:text-5xl">Live in three moves</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              { n: "1", t: "Pick your sport", d: "Football, basketball or soccer — we set up the right positions and stats." },
              { n: "2", t: "Add your roster, schedule and logo", d: "Paste your roster, drop in your games, upload the logo and we pull your colors." },
              { n: "3", t: "Go live and share with your fans", d: "You get a clean team address to share everywhere." },
            ].map((step) => (
              <li key={step.n}>
                <span className="stat-number block text-6xl text-primary sm:text-7xl">{step.n}</span>
                <h3 className="mt-4 text-xl sm:text-2xl">{step.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- Featured teams ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <p className="eyebrow text-muted-foreground">Live now</p>
        <h2 className="mt-3 text-3xl sm:text-5xl">Featured teams</h2>

        {featuredQuery.data && featuredQuery.data.length > 0 ? (
          <div className="mt-8 flex gap-4 overflow-x-auto pb-4 hide-scrollbar lg:grid lg:grid-cols-4 lg:overflow-visible">
            {featuredQuery.data.map((team) => {
              const sportName =
                (team as unknown as { sports?: { name?: string } }).sports?.name ?? "Team";
              return (
                <Link
                  key={team.id}
                  to="/$slug"
                  params={{ slug: team.slug }}
                  className="panel flex w-56 shrink-0 flex-col items-center gap-3 p-6 text-center transition-colors hover:border-primary lg:w-auto"
                >
                  <span
                    className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full"
                    style={{ backgroundColor: team.primary_color }}
                  >
                    {team.logo_url ? (
                      <img
                        src={team.logo_url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="display-xl text-xl text-white">{team.name.slice(0, 1)}</span>
                    )}
                  </span>
                  <span className="text-base font-bold leading-tight">{team.name}</span>
                  <span className="eyebrow text-muted-foreground">{sportName}</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="panel mt-8 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No teams are live yet. Be the first — yours could headline this strip.
            </p>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="mt-5 inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-sm font-bold uppercase text-primary-foreground"
            >
              Create my team
            </Link>
          </div>
        )}
      </section>

      {/* ---------- Promo video placeholder ---------- */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="panel flex aspect-video w-full flex-col items-center justify-center gap-3 bg-surface-2 text-center">
          <PlayCircle className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <p className="eyebrow text-muted-foreground">Promo video coming soon</p>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-10 sm:px-6 lg:px-8">
          <span className="display-xl text-xl">This Is My Team</span>
          <span className="text-sm text-muted-foreground">Every team deserves to be seen.</span>
        </div>
      </footer>
    </div>
  );
}
