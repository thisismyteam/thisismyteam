import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Btn, Field, SelectInput, TextInput } from "@/components/ui-kit";
import type { Game, StatColumn } from "@/lib/team";
import { searchLeaderPlayers } from "@/lib/leader-players";
import { useSeasonRoster } from "@/lib/player-picker";

type Leader = { id: string; player_id: string; leader_rank: number | null; stats: Record<string, unknown> };
export function LeadersEditor({ teamId, seasonId, game, columns }: { teamId: string; seasonId: string; game: Game; columns: StatColumn[] }) {
  const qc = useQueryClient();
  const [playerId, setPlayerId] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [stats, setStats] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const playersQuery = useSeasonRoster(teamId, seasonId);
  const leadersQuery = useQuery({ queryKey: ["leaders", game.id], queryFn: async () => {
    const { data, error } = await supabase.from("player_game_stats").select("id, player_id, leader_rank, stats")
      .eq("game_id", game.id).not("leader_rank", "is", null).order("leader_rank");
    if (error) throw error;
    return (data ?? []) as Leader[];
  }});
  const availablePlayers = searchLeaderPlayers((playersQuery.data ?? []).filter((p) => !leadersQuery.data?.some((l) => l.player_id === p.id)), playerSearch);
  async function add() {
    if (!playerId || !playersQuery.data?.some((p) => p.id === playerId) || leadersQuery.data?.some((l) => l.player_id === playerId)) return;
    const rank = [1, 2, 3].find((n) => !leadersQuery.data?.some((l) => l.leader_rank === n));
    if (!rank) return;
    const values = Object.fromEntries(Object.entries(stats).filter(([, value]) => value !== "").map(([key, value]) => [key, Number(value)]));
    if (!Object.keys(values).length || Object.values(values).some((n) => !Number.isFinite(n))) { toast.error("Add at least one valid stat."); return; }
    setBusy(true);
    const { error } = await supabase.from("player_game_stats").upsert({ team_id: teamId, season_id: seasonId, game_id: game.id, player_id: playerId, leader_rank: rank, stats: values }, { onConflict: "game_id,player_id" });
    setBusy(false);
    if (error) toast.error(error.message); else { setPlayerId(""); setPlayerSearch(""); setStats({}); void qc.invalidateQueries({ queryKey: ["leaders", game.id] }); toast.success("Leader saved"); }
  }
  async function remove(id: string) {
    const { error } = await supabase.from("player_game_stats").update({ leader_rank: null }).eq("id", id);
    if (error) toast.error(error.message); else void qc.invalidateQueries({ queryKey: ["leaders", game.id] });
  }
  if (game.status !== "final") return null;
  return <div className="border-t border-border px-4 py-4"><p className="eyebrow text-primary">Game leaders · {game.opponent}</p>
    {playersQuery.isError ? <p role="alert" className="mt-3 text-sm text-destructive">Could not load the roster. Try again.</p> : null}
    <div className="mt-3 space-y-2">{leadersQuery.data?.map((l) => { const p = playersQuery.data?.find((p) => p.id === l.player_id); return <div key={l.id} className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm"><span><strong className="font-condensed text-lg uppercase">{p?.first_name} {p?.last_name}</strong><span className="ml-3 text-muted-foreground">{columns.filter((c) => l.stats[c.key] != null).map((c) => `${c.label} ${l.stats[c.key]}`).join(" · ")}</span></span><Btn type="button" variant="danger" onClick={() => void remove(l.id)}>Remove</Btn></div>; })}</div>
    {(leadersQuery.data?.length ?? 0) < 3 ? <form className="mt-4 grid gap-3 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); void add(); }}>
      <div className="flex flex-col gap-2"><Field label="Search player"><TextInput type="search" placeholder="Name or jersey number" value={playerSearch} onChange={(e) => { setPlayerSearch(e.target.value); setPlayerId(""); }} /></Field>
      <Field label="Player"><SelectInput required value={playerId} disabled={playersQuery.isLoading || playersQuery.isError} onChange={(e) => setPlayerId(e.target.value)}><option value="">{playersQuery.isLoading ? "Loading roster..." : "Choose player"}</option>{availablePlayers.map((p) => <option key={p.id} value={p.id}>#{p.jersey_number ?? "—"} {p.first_name} {p.last_name}</option>)}</SelectInput></Field>
      {playerSearch && !availablePlayers.length && !playersQuery.isLoading ? <span className="text-xs text-muted-foreground">No matching players</span> : null}</div>
      {columns.map((column) => <Field key={column.key} label={column.label}><TextInput type="number" min="0" value={stats[column.key] ?? ""} onChange={(e) => setStats({ ...stats, [column.key]: e.target.value })} /></Field>)}
      <div className="flex items-end"><Btn type="submit" disabled={busy || !playerId || playersQuery.isError}>Add leader</Btn></div>
    </form> : null}
  </div>;
}
