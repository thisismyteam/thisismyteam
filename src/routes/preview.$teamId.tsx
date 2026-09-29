import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Btn } from "@/components/ui-kit";
import { TeamPageView, type TeamPageData } from "@/components/team-page-view";
import { startTeamCheckout } from "@/lib/billing.functions";

export const Route = createFileRoute("/preview/$teamId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Preview your team page — This Is My Team" },
      { name: "description", content: "Private preview of your team page before it goes live." },
      { property: "og:title", content: "Preview your team page — This Is My Team" },
      { property: "og:description", content: "Private preview of your team page before it goes live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PreviewPage,
});

// Reads as the signed-in admin: RLS only returns draft rows to that team's Owner/Contributors.
async function loadPreview(teamId: string, userId: string) {
  const { data: member } = await supabase.from("team_members").select("role").eq("team_id", teamId).eq("user_id", userId).maybeSingle();
  if (!member) return null;
  const { data: team, error } = await supabase.from("teams").select("*, sports(*), organizations(name, org_type)").eq("id", teamId).maybeSingle();
  if (error) throw error;
  if (!team) return null;
  const { data: season } = await supabase.from("seasons").select("*").eq("team_id", teamId).order("is_current", { ascending: false }).limit(1).maybeSingle();
  const empty = { players: [], coaches: [], games: [], highlights: [], highlightPlayers: [], leaders: [], involved: [], followerCount: 0 };
  if (!season) return { role: member.role, data: { team, season: null, ...empty } as unknown as TeamPageData };
  const [players, coaches, games, highlights, highlightPlayers, leaders, involved] = await Promise.all([
    supabase.from("players").select("*").eq("season_id", season.id).order("jersey_number", { nullsFirst: false }),
    supabase.from("coaches").select("*").eq("season_id", season.id).order("sort_order"),
    supabase.from("games").select("*").eq("season_id", season.id).order("game_date"),
    supabase.from("highlights").select("id,title,video_url,featured,game_id,created_at").eq("season_id", season.id).order("featured", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("highlight_players").select("highlight_id,player_id").eq("season_id", season.id),
    supabase.from("player_game_stats").select("id,game_id,player_id,leader_rank,stats").eq("season_id", season.id).not("leader_rank", "is", null),
    supabase.from("get_involved_links").select("id,label,url,description,sort_order").eq("season_id", season.id).order("sort_order"),
  ]);
  return {
    role: member.role,
    data: {
      team, season,
      players: players.data ?? [], coaches: coaches.data ?? [], games: games.data ?? [],
      highlights: highlights.data ?? [], highlightPlayers: highlightPlayers.data ?? [],
      leaders: leaders.data ?? [], involved: involved.data ?? [], followerCount: 0,
    } as unknown as TeamPageData,
  };
}

function PreviewPage() {
  const { teamId } = Route.useParams();
  const { user, loading } = useAuth();
  const checkoutFn = useServerFn(startTeamCheckout);
  const [busy, setBusy] = useState(false);
  const preview = useQuery({ queryKey: ["team-preview", teamId, user?.id], enabled: !!user, queryFn: () => loadPreview(teamId, user!.id) });

  if (loading || (user && preview.isLoading)) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading preview…</div>;
  if (!user) return <Centered title="Sign in to preview" action={<Link to="/auth" className="text-sm font-semibold text-primary underline">Sign in</Link>} />;
  if (!preview.data) return <Centered title="Preview not available" action={<Link to="/dashboard" className="text-sm font-semibold text-primary underline">Back to My Teams</Link>} />;

  const { data, role } = preview.data;
  const published = (data.team as { published?: boolean }).published;

  async function pay() {
    setBusy(true);
    try {
      const { url } = await checkoutFn({ data: { teamId } });
      window.location.assign(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start checkout.");
      setBusy(false);
    }
  }

  const bar = (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="font-condensed text-lg font-bold uppercase leading-tight sm:text-xl">
          {published ? "This is your team. It's live." : <>This is your team. Go live for <span className="text-primary">$299 / season</span></>}
        </p>
        <div className="flex gap-2">
          <Link to="/start" search={{ teamId }} className="inline-flex h-11 items-center rounded-md border border-border px-4 text-sm font-bold uppercase hover:bg-surface-2">Back</Link>
          {published ? null : role === "owner" ? (
            <Btn onClick={pay} disabled={busy} className="flex-1 px-6 sm:flex-none">{busy ? "Opening…" : "Pay and publish"}</Btn>
          ) : (
            <p className="self-center text-xs text-muted-foreground">Only the team Owner can pay.</p>
          )}
        </div>
      </div>
    </div>
  );

  return <TeamPageView data={data} bottomBar={bar} />;
}

function Centered({ title, action }: { title: string; action: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="display-xl text-4xl">{title}</h1>
      {action}
    </div>
  );
}
