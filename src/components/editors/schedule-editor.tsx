import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Btn, Field, SelectInput, TextInput } from "@/components/ui-kit";
import type { Game } from "@/lib/team";
import type { StatColumn } from "@/lib/team";
import { LeadersEditor } from "@/components/editors/leaders-editor";
import { SaveStatus, useRowSaveStatus, useSaveStatus } from "@/components/save-status";
import { ImportPanel } from "@/components/editors/import-panel";
import { parseSchedulePaste, type ScheduleDraftRow } from "@/lib/import/schedule-parse";
import { tableToSchedule } from "@/lib/import/columns";

const blank = {
  game_date: "",
  game_time: "",
  opponent: "",
  home_away: "home",
  location: "",
  team_score: "",
  opponent_score: "",
};

export function ScheduleEditor({ teamId, seasonId, statColumns = [], year = 2026 }: { teamId: string; seasonId: string; statColumns?: StatColumn[]; year?: number }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"paste" | "one">("paste");
  const [draft, setDraft] = useState({ ...blank });
  const rowSave = useRowSaveStatus();
  const [addState, setAddState] = useSaveStatus();

  const gamesQuery = useQuery({
    queryKey: ["games", seasonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("games")
        .select("*")
        .eq("season_id", seasonId)
        .order("game_date", { nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as Game[];
    },
  });

  const addGame = useMutation({
    mutationFn: async () => {
      const hasScore = draft.team_score !== "" && draft.opponent_score !== "";
      const { error } = await supabase.from("games").insert({
        team_id: teamId,
        season_id: seasonId,
        game_date: draft.game_date || null,
        game_time: draft.game_time || null,
        opponent: draft.opponent,
        home_away: draft.home_away,
        location: draft.location || null,
        team_score: hasScore ? Number(draft.team_score) : null,
        opponent_score: hasScore ? Number(draft.opponent_score) : null,
        status: hasScore ? "final" : "scheduled",
      });
      if (error) throw error;
    },
     onMutate: () => setAddState("saving"),
     onSuccess: () => {
       setAddState("saved");
      setDraft({ ...blank });
      qc.invalidateQueries({ queryKey: ["games", seasonId] });
    },
     onError: (e: Error) => { setAddState("error"); toast.error(e.message); },
  });

  const importMany = useMutation({
    mutationFn: async (rows: ScheduleDraftRow[]) => {
      const { error } = await supabase.from("games").insert(rows.filter((r) => r.opponent.trim()).map((r) => {
        const hasScore = r.team_score !== "" && r.opponent_score !== "";
        return {
          team_id: teamId,
          season_id: seasonId,
          game_date: /^\d{4}-\d{2}-\d{2}$/.test(r.game_date) ? r.game_date : null,
          game_time: r.game_time || null,
          opponent: r.opponent.trim(),
          home_away: r.home_away,
          location: r.location || null,
          team_score: hasScore ? Number(r.team_score) : null,
          opponent_score: hasScore ? Number(r.opponent_score) : null,
          status: hasScore ? "final" : "scheduled",
        };
      }));
      if (error) throw error;
    },
    onMutate: () => setAddState("saving"),
    onSuccess: (_d, rows) => { setAddState("saved"); toast.success(`${rows.length} games added`); qc.invalidateQueries({ queryKey: ["games", seasonId] }); },
    onError: (e: Error) => { setAddState("error"); toast.error(e.message); },
  });

  type GamePatch = Partial<{
    game_date: string | null;
    game_time: string | null;
    opponent: string;
    home_away: string;
    location: string | null;
    team_score: number | null;
    opponent_score: number | null;
    status: string;
  }>;

  const updateGame = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: GamePatch }) => {
      const { error } = await supabase.from("games").update(patch).eq("id", id);
      if (error) throw error;
    },
     onMutate: ({ id }) => rowSave.set(id, "saving"),
     onSuccess: (_data, { id }) => { rowSave.set(id, "saved"); qc.invalidateQueries({ queryKey: ["games", seasonId] }); },
     onError: (e: Error, { id }) => { rowSave.set(id, "error"); toast.error(e.message); },
  });

  const removeGame = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("games").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["games", seasonId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function scorePatch(
    game: Game,
    field: "team_score" | "opponent_score",
    value: string,
  ): GamePatch {
    const next = value === "" ? null : Number(value);
    const other = field === "team_score" ? game.opponent_score : game.team_score;
    return { [field]: next, status: next != null && other != null ? "final" : "scheduled" };
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2">
        {(["paste", "one"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`h-10 rounded-md px-4 text-sm font-semibold ${tab === t ? "bg-primary text-primary-foreground" : "border border-input"}`}>
            {t === "paste" ? "Paste or upload" : "Add one game"}
          </button>
        ))}
      </div>
      {tab === "paste" ? (
        <ImportPanel<ScheduleDraftRow>
          teamId={teamId}
          kind="schedule"
          noun={["game", "games"]}
          columns={[
            { key: "game_date", label: "Date", type: "date" },
            { key: "opponent", label: "Opponent" },
            { key: "home_away", label: "H/A", options: [{ value: "home", label: "Home" }, { value: "away", label: "Away" }, { value: "neutral", label: "Neutral" }] },
            { key: "game_time", label: "Time", width: "w-24" },
            { key: "location", label: "Location" },
            { key: "team_score", label: "Us", type: "number", width: "w-16" },
            { key: "opponent_score", label: "Them", type: "number", width: "w-16" },
          ]}
          pasteLabel="One game per line"
          pasteHint="Date, opponent, home/away, time, location, score. Everything after the opponent is optional. L 39-7 means we lost 7-39."
          pastePlaceholder={"Aug 21, Valencia, Away, L 39-7\nAug 28 | Culver City | Home | W 28-14\n10/2 at Lawndale 7pm"}
          parsePaste={(text) => parseSchedulePaste(text, year)}
          parseTable={(rows) => tableToSchedule(rows, year)}
          onSave={async (rows) => { await importMany.mutateAsync(rows); }}
          saving={importMany.isPending}
        />
      ) : (
      <form
        className="panel grid gap-3 p-4 sm:grid-cols-12"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.opponent.trim()) addGame.mutate();
        }}
      >
        <Field label="Date" className="sm:col-span-2">
          <TextInput
            type="date"
            value={draft.game_date}
            onChange={(e) => setDraft({ ...draft, game_date: e.target.value })}
          />
        </Field>
        <Field label="Time" className="sm:col-span-2">
          <TextInput
            placeholder="7:00 PM"
            value={draft.game_time}
            onChange={(e) => setDraft({ ...draft, game_time: e.target.value })}
          />
        </Field>
        <Field label="Opponent" className="sm:col-span-3">
          <TextInput
            required
            value={draft.opponent}
            onChange={(e) => setDraft({ ...draft, opponent: e.target.value })}
          />
        </Field>
        <Field label="Home / away" className="sm:col-span-2">
          <SelectInput
            value={draft.home_away}
            onChange={(e) => setDraft({ ...draft, home_away: e.target.value })}
          >
            <option value="home">Home</option>
            <option value="away">Away</option>
            <option value="neutral">Neutral</option>
          </SelectInput>
        </Field>
        <Field label="Location" className="sm:col-span-3">
          <TextInput
            value={draft.location}
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
          />
        </Field>
        <Field label="Us" className="sm:col-span-2">
          <TextInput
            type="number"
            value={draft.team_score}
            onChange={(e) => setDraft({ ...draft, team_score: e.target.value })}
          />
        </Field>
        <Field label="Them" className="sm:col-span-2">
          <TextInput
            type="number"
            value={draft.opponent_score}
            onChange={(e) => setDraft({ ...draft, opponent_score: e.target.value })}
          />
        </Field>
        <div className="flex items-end sm:col-span-2">
          <Btn type="submit" className="w-full" disabled={addGame.isPending}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Btn>
        </div>
      </form>
      )}
       <div className="-mt-3"><SaveStatus state={addState} /></div>

      <div className="flex flex-col gap-2">
        <p className="eyebrow text-muted-foreground">
          Schedule — {gamesQuery.data?.length ?? 0} games
        </p>
        {(gamesQuery.data ?? []).map((g) => (
          <div key={g.id} className="panel">
          <div className="grid items-end gap-3 p-3 sm:grid-cols-12 sm:p-4">
            <Field label="Date" className="sm:col-span-2">
              <TextInput
                type="date"
                defaultValue={g.game_date ?? ""}
                 onBlur={(e) => { if (e.target.value !== (g.game_date ?? "")) updateGame.mutate({ id: g.id, patch: { game_date: e.target.value || null } }); }}
              />
            </Field>
            <Field label="Time" className="sm:col-span-2">
              <TextInput
                defaultValue={g.game_time ?? ""}
                 onBlur={(e) => { if (e.target.value !== (g.game_time ?? "")) updateGame.mutate({ id: g.id, patch: { game_time: e.target.value || null } }); }}
              />
            </Field>
            <Field label="Opponent" className="sm:col-span-2">
              <TextInput
                defaultValue={g.opponent}
                 onBlur={(e) => { if (e.target.value !== g.opponent) updateGame.mutate({ id: g.id, patch: { opponent: e.target.value } }); }}
              />
            </Field>
            <Field label="H/A" className="sm:col-span-1">
              <SelectInput
                value={g.home_away}
                onChange={(e) => updateGame.mutate({ id: g.id, patch: { home_away: e.target.value } })}
              >
                <option value="home">H</option>
                <option value="away">A</option>
                <option value="neutral">N</option>
              </SelectInput>
            </Field>
            <Field label="Location" className="sm:col-span-2">
              <TextInput
                defaultValue={g.location ?? ""}
                 onBlur={(e) => { if (e.target.value !== (g.location ?? "")) updateGame.mutate({ id: g.id, patch: { location: e.target.value || null } }); }}
              />
            </Field>
            <Field label="Us" className="sm:col-span-1">
              <TextInput
                type="number"
                defaultValue={g.team_score ?? ""}
                 onBlur={(e) => { if (e.target.value !== String(g.team_score ?? "")) updateGame.mutate({ id: g.id, patch: scorePatch(g, "team_score", e.target.value) }); }}
              />
            </Field>
            <Field label="Them" className="sm:col-span-1">
              <TextInput
                type="number"
                defaultValue={g.opponent_score ?? ""}
                 onBlur={(e) => { if (e.target.value !== String(g.opponent_score ?? "")) updateGame.mutate({ id: g.id, patch: scorePatch(g, "opponent_score", e.target.value) }); }}
              />
            </Field>
            <div className="flex justify-end sm:col-span-1">
              <button
                type="button"
                aria-label={`Remove game vs ${g.opponent}`}
                onClick={() => removeGame.mutate(g.id)}
                className="rounded-md p-2 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
           <div className="px-4 pb-2"><SaveStatus state={rowSave.state(g.id)} /></div>
          {g.status === "final" ? <LeadersEditor teamId={teamId} seasonId={seasonId} game={g} columns={statColumns} /> : null}
          </div>
        ))}
        {gamesQuery.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No games yet.</p>
        ) : null}
      </div>
    </div>
  );
}
