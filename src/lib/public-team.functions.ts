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

export const getPublicTeam = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const supabase = publicClient();

    const { data: team } = await supabase
      .from("teams")
      .select("*, sports(*), organizations(name, org_type)")
      .eq("slug", data.slug)
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

    if (!season) return { team, season: null, players: [], coaches: [], games: [] };

    const [players, coaches, games] = await Promise.all([
      supabase
        .from("players")
        .select("*")
        .eq("season_id", season.id)
        .order("jersey_number", { nullsFirst: false }),
      supabase.from("coaches").select("*").eq("season_id", season.id).order("sort_order"),
      supabase.from("games").select("*").eq("season_id", season.id).order("game_date"),
    ]);

    return {
      team,
      season,
      players: players.data ?? [],
      coaches: coaches.data ?? [],
      games: games.data ?? [],
    };
  });
