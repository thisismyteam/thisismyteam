import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * A single published team used as the homepage showcase. Returns null when the
 * team is missing, unpublished or has no hero video, so the section can hide
 * itself instead of showing a placeholder.
 */
export const getShowcaseTeam = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const supabase = publicClient();

    const { data: team } = await supabase
      .from("teams")
      .select("name, slug, logo_url, primary_color, secondary_color, hero_video_url")
      .eq("slug", data.slug)
      .eq("published", true)
      .maybeSingle();

    if (!team?.hero_video_url || !/^https:\/\//.test(team.hero_video_url)) return null;

    return team;
  });

export const getPublicTeam = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const supabase = publicClient();

    const { data: team } = await supabase
      .from("teams")
      .select("*, sports(*), organizations(name, org_type)")
      .ilike("slug", data.slug)
      .eq("published", true)
      .maybeSingle();

    if (!team) return null;

    const { data: season } = await supabase
      .from("seasons")
      .select("*")
      .eq("team_id", team.id)
      .order("is_current", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!season) return { team, season: null, players: [], coaches: [], games: [], highlights: [], highlightPlayers: [], leaders: [], involved: [], followerCount: 0 };

    const [players, coaches, games, highlights, highlightPlayers, leaders, involved, count] = await Promise.all([
      supabase
        .from("players")
        .select("*")
        .eq("season_id", season.id)
        .order("jersey_number", { nullsFirst: false }),
      supabase.from("coaches").select("*").eq("season_id", season.id).order("sort_order"),
      supabase.from("games").select("*").eq("season_id", season.id).order("game_date"),
      supabase.from("highlights").select("id,title,video_url,featured,game_id,created_at").eq("season_id", season.id).order("featured", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("highlight_players").select("highlight_id,player_id").eq("season_id", season.id),
      supabase.from("player_game_stats").select("id,game_id,player_id,leader_rank,stats").eq("season_id", season.id).not("leader_rank", "is", null),
      supabase.from("get_involved_links").select("id,label,url,description,sort_order").eq("season_id", season.id).order("sort_order"),
      supabase.rpc("team_follower_count", { _team_id: team.id }),
    ]);

    return {
      team,
      season,
      players: players.data ?? [],
      coaches: coaches.data ?? [],
      games: games.data ?? [],
      highlights: highlights.data ?? [],
      highlightPlayers: highlightPlayers.data ?? [],
      leaders: leaders.data ?? [],
      involved: involved.data ?? [],
      followerCount: count.data ?? 0,
    };
  });
