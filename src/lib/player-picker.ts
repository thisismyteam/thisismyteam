import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Player } from "@/lib/team";
import { sortedLeaderPlayers } from "@/lib/leader-players";

export const seasonRosterQueryKey = (teamId: string, seasonId: string) => ["season-roster", teamId, seasonId] as const;

async function fetchSeasonRoster(teamId: string, seasonId: string): Promise<Player[]> {
  const players: Player[] = [];

  // Page explicitly so a backend row cap can never silently truncate a roster.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("team_id", teamId)
      .eq("season_id", seasonId)
      .order("id")
      .range(offset, offset + 499);
    if (error) throw error;
    players.push(...((data ?? []) as Player[]));
    if (!data || data.length < 500) break;
  }

  return sortedLeaderPlayers(players);
}

export function useSeasonRoster(teamId: string, seasonId: string) {
  return useQuery({
    queryKey: seasonRosterQueryKey(teamId, seasonId),
    queryFn: () => fetchSeasonRoster(teamId, seasonId),
    refetchOnMount: "always",
  });
}