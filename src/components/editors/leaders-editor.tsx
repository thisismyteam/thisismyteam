import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Btn, Field, SelectInput, TextInput } from "@/components/ui-kit";
import type { Game, Player, StatColumn } from "@/lib/team";

type Leader = { id: string; player_id: string; leader_rank: number | null; stats: Record<string, unknown> };
export function LeadersEditor({ teamId, seasonId, game, columns }: { teamId: string; seasonId: string; game: Game; columns: StatColumn[] }) {
  const qc = useQueryClient();
  const [playerId, setPlayerId] = useState("");
  const [stats, setStats] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const query = useQuery({ queryKey: ["leaders", game.id], queryFn: async () => {
    const [p, s] = await Promise.all([supabase.from("players").select("*").eq("season_id", seasonId), supabase.from("player_game_stats").select("id, player_id, leader_rank, stats").eq("game_id", game.id).not("leader_rank", "is", null).order("leader_rank")]);
    if (p.error) throw p.error; if (s.error) throw s.error;
    return { players: (p.data ?? []) as Player[], leaders: (s.data ?? []) as Leader[] };
  }});
  async function add() {
    if (!playerId || query.data?.leaders.some((l) => l.player_id === playerId)) return;
    const rank = [1, 2, 3].find((n) => !query.data?.leaders.some((l) => l.leader_rank === n));
    if (!rank) return;
    const values = Object.fromEntries(Object.entries(stats).filter(([, value]) => value !== "").map(([key, value]) => [key, Number(value)]));
    if (!Object.keys(values).length || Object.values(values).some((n) => !Number.isFinite(n))) { toast.error("Add at least one valid stat."); return; }
    setBusy(true);
    const { error } = await supabase.from("player_game_stats").upsert({ team_id: teamId, season_id: seasonId, game_id: game.id, player_id: playerId, leader_rank: rank, stats: values }, { onConflict: "game_id,player_id" });
    setBusy(false);
    if (error) toast.error(error.message); else { setPlayerId(""); setStats({}); void qc.invalidateQueries({ queryKey: ["leaders", game.id] }); toast.success("Leader saved"); }
  }
  async function remove(id: string) {
    const { error } = await supabase.from("player_game_stats").update({ leader_rank: null }).eq("id", id);
    if (error) toast.error(error.message); else void qc.invalidateQueries({ queryKey: ["leaders", game.id] });
  }
  if (game.status !== "final") return null;
  return <div className="border-t border-border px-4 py-4"><p className="eyebrow text-primary">Game leaders · {game.opponent}</p>
    <div className="mt-3 space-y-2">{query.data?.leaders.map((l) => { const p = query.data?.players.find((p) => p.id === l.player_id); return <div key={l.id} className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm"><span><strong className="font-condensed text-lg uppercase">{p?.first_name} {p?.last_name}</strong><span className="ml-3 text-muted-foreground">{columns.filter((c) => l.stats[c.key] != null).map((c) => `${c.label} ${l.stats[c.key]}`).join(" · ")}</span></span><Btn type="button" variant="danger" onClick={() => void remove(l.id)}>Remove</Btn></div>; })}</div>
    {(query.data?.leaders.length ?? 0) < 3 ? <form className="mt-4 grid gap-3 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); void add(); }}>
      <Field label="Player"><SelectInput required value={playerId} onChange={(e) => setPlayerId(e.target.value)}><option value="">Choose player</option>{query.data?.players.filter((p) => !query.data?.leaders.some((l) => l.player_id === p.id)).map((p) => <option key={p.id} value={p.id}>#{p.jersey_number ?? "—"} {p.first_name} {p.last_name}</option>)}</SelectInput></Field>
      {columns.map((column) => <Field key={column.key} label={column.label}><TextInput type="number" min="0" value={stats[column.key] ?? ""} onChange={(e) => setStats({ ...stats, [column.key]: e.target.value })} /></Field>)}
      <div className="flex items-end"><Btn type="submit" disabled={busy || !playerId}>Add leader</Btn></div>
    </form> : null}
  </div>;
}
