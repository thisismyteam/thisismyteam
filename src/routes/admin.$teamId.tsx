import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { Btn, SectionTitle } from "@/components/ui-kit";
import { TeamBasicsForm, type TeamBasics } from "@/components/editors/team-basics-form";
import { RosterEditor } from "@/components/editors/roster-editor";
import { CoachEditor } from "@/components/editors/coach-editor";
import { ScheduleEditor } from "@/components/editors/schedule-editor";
import { HeroVideoEditor } from "@/components/editors/hero-video-editor";
import { HighlightsEditor } from "@/components/editors/highlights-editor";
import { InvolvedEditor } from "@/components/editors/involved-editor";
import { FollowersEditor } from "@/components/editors/followers-editor";
import { MembersEditor } from "@/components/editors/members-editor";
import { isReservedSlug, slugify } from "@/lib/slug";
import type { Season, Sport, Team } from "@/lib/team";

export const Route = createFileRoute("/admin/$teamId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Manage your team — This Is My Team" },
      {
        name: "description",
        content: "Edit your team info, roster, coaches, schedule and scores any time.",
      },
      { property: "og:title", content: "Manage your team — This Is My Team" },
      {
        property: "og:description",
        content: "Edit your team info, roster, coaches, schedule and scores any time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const TABS = ["Team info", "Roster", "Coaches", "Schedule", "Highlights", "Get involved", "Followers", "Team members"] as const;

function AdminPage() {
  const { teamId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Team info");
  const [basics, setBasics] = useState<TeamBasics | null>(null);
  const [saving, setSaving] = useState(false);
  const [heroVideo, setHeroVideo] = useState<string | null | undefined>();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  const teamQuery = useQuery({
    enabled: !!user,
    queryKey: ["admin-team", teamId],
    queryFn: async () => {
      const { data: team, error } = await supabase
        .from("teams")
        .select("*")
        .eq("id", teamId)
        .single();
      if (error) throw error;

      const { data: season } = await supabase
        .from("seasons")
        .select("*")
        .eq("team_id", teamId)
        .order("is_current", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: sport } = await supabase
        .from("sports")
        .select("*")
        .eq("id", team.sport_id)
        .single();

      const { data: membership } = await supabase
        .from("team_members").select("role").eq("team_id", teamId).eq("user_id", user?.id ?? "").maybeSingle();
      if (!membership) throw new Error("You do not have access to manage this team.");

      return {
        team: team as unknown as Team,
        season: (season ?? null) as unknown as Season | null,
        sport: sport as unknown as Sport,
        isOwner: membership.role === "owner",
      };
    },
  });

  useEffect(() => {
    if (!teamQuery.data || basics) return;
    const { team, season } = teamQuery.data;
    setBasics({
      name: team.name,
      mascot: team.mascot ?? "",
      level: team.level,
      seasonLabel: season?.label ?? "2026",
      slug: team.slug,
      slugTouched: true,
      logo_url: team.logo_url,
      primary_color: team.primary_color,
      secondary_color: team.secondary_color,
      tagline: team.tagline ?? "",
    });
  }, [teamQuery.data, basics]);

  async function saveBasics() {
    if (!basics || !teamQuery.data) return;
    setSaving(true);
    try {
      let slug = basics.slug || slugify(basics.name);
      if (isReservedSlug(slug)) slug = `${slug}-team`;

      if (slug !== teamQuery.data.team.slug) {
        const { data: taken } = await supabase
          .from("teams")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        if (taken) {
          toast.error("That team address is already taken. Try another.");
          setSaving(false);
          return;
        }
      }

      const { error } = await supabase
        .from("teams")
        .update({
          name: basics.name,
          mascot: basics.mascot || null,
          level: basics.level,
          slug,
          logo_url: basics.logo_url,
          primary_color: basics.primary_color,
          secondary_color: basics.secondary_color,
          tagline: basics.tagline || null,
        })
        .eq("id", teamId);
      if (error) throw error;

      if (teamQuery.data.season) {
        await supabase
          .from("seasons")
          .update({
            label: basics.seasonLabel,
            year: Number(basics.seasonLabel) || teamQuery.data.season.year,
          })
          .eq("id", teamQuery.data.season.id);
      }

      setBasics({ ...basics, slug });
      qc.invalidateQueries({ queryKey: ["admin-team", teamId] });
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish() {
    if (!teamQuery.data) return;
    const next = !teamQuery.data.team.published;
    const { error } = await supabase
      .from("teams")
      .update({ published: next, published_at: next ? new Date().toISOString() : null })
      .eq("id", teamId);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin-team", teamId] });
    toast.success(next ? "Your team is live" : "Your team is now a draft");
  }

  if (teamQuery.isError) return <div className="min-h-screen bg-background"><SiteHeader /><main className="mx-auto max-w-5xl px-4 py-16"><h1 className="text-3xl">Team unavailable</h1><p className="mt-3 text-muted-foreground">You don't have access to manage this team.</p><Link to="/dashboard" className="mt-4 inline-block text-primary">Back to my teams</Link></main></div>;
  if (teamQuery.isLoading || !basics || !teamQuery.data) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-5xl px-4 py-16">
          <div className="panel h-40 animate-pulse" />
        </div>
      </div>
    );
  }

  const { team, season, sport, isOwner } = teamQuery.data;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <div className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-6 sm:px-6">
          <span
            className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full"
            style={{ backgroundColor: team.primary_color }}
          >
            {team.logo_url ? (
              <img src={team.logo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="display-xl text-lg text-white">{team.name.slice(0, 1)}</span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl sm:text-3xl">{team.name}</h1>
            <p className="text-xs text-muted-foreground">
              {sport.name} · {team.level} · {season?.label ?? "—"} ·{" "}
              {team.published ? "Live" : "Draft"}
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/$slug" params={{ slug: team.slug }}>
              <Btn variant="outline">
                View page <ExternalLink className="ml-2 h-4 w-4" />
              </Btn>
            </Link>
            <Btn variant={team.published ? "outline" : "primary"} onClick={togglePublish}>
              {team.published ? "Unpublish" : "Publish"}
            </Btn>
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 hide-scrollbar sm:px-6">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                tab === t
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 sm:py-12">
        {tab === "Team info" ? (
          <form
            className="flex flex-col gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              saveBasics();
            }}
          >
            <SectionTitle title="Team info" />
            <TeamBasicsForm value={basics} onChange={setBasics} uploadPrefix={team.id} />
            <HeroVideoEditor teamId={team.id} value={heroVideo === undefined ? team.hero_video_url : heroVideo} onChange={setHeroVideo} />
            <div>
              <Btn type="submit" disabled={saving}>
                Save changes
              </Btn>
            </div>
          </form>
        ) : null}

        {tab === "Roster" && season ? (
          <div className="flex flex-col gap-6">
            <SectionTitle title="Roster" />
            <RosterEditor
              teamId={team.id}
              seasonId={season.id}
              positions={sport.positions ?? []}
              defaultLevel={team.level}
            />
          </div>
        ) : null}

        {tab === "Coaches" && season ? (
          <div className="flex flex-col gap-6">
            <SectionTitle title="Coaches" />
            <CoachEditor teamId={team.id} seasonId={season.id} />
          </div>
        ) : null}

        {tab === "Schedule" && season ? (
          <div className="flex flex-col gap-6">
            <SectionTitle title="Schedule and scores" />
            <ScheduleEditor teamId={team.id} seasonId={season.id} statColumns={sport.player_stats ?? []} />
          </div>
        ) : null}
        {tab === "Highlights" && season ? <div className="space-y-6"><SectionTitle title="Highlights" /><HighlightsEditor teamId={team.id} seasonId={season.id} /></div> : null}
        {tab === "Get involved" && season ? <div className="space-y-6"><SectionTitle title="Get involved" /><InvolvedEditor teamId={team.id} seasonId={season.id} /></div> : null}
        {tab === "Followers" ? <div className="space-y-6"><SectionTitle title="Followers" /><FollowersEditor teamId={team.id} /></div> : null}
        {tab === "Team members" ? <div className="space-y-6"><SectionTitle title="Team members" /><MembersEditor teamId={team.id} isOwner={isOwner} /></div> : null}
      </main>
    </div>
  );
}
