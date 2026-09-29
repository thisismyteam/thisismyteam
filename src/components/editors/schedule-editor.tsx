import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Btn, Field, SelectInput, TextInput } from "@/components/ui-kit";
import type { Game } from "@/lib/team";

const blank = {
  game_date: "",
  game_time: "",
  opponent: "",
  home_away: "home",
  location: "",
  team_score: "",
  opponent_score: "",
};

export function ScheduleEditor({ teamId, seasonId }: { teamId: string; seasonId: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState({ ...blank });

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
    onSuccess: () => {
      setDraft({ ...blank });
      qc.invalidateQueries({ queryKey: ["games", seasonId] });
    },
    onError: (e: Error) => toast.error(e.message),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["games", seasonId] }),
    onError: (e: Error) => toast.error(e.message),
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

      <div className="flex flex-col gap-2">
        <p className="eyebrow text-muted-foreground">
          Schedule — {gamesQuery.data?.length ?? 0} games
        </p>
        {(gamesQuery.data ?? []).map((g) => (
          <div key={g.id} className="panel grid items-end gap-3 p-3 sm:grid-cols-12 sm:p-4">
            <Field label="Date" className="sm:col-span-2">
              <TextInput
                type="date"
                defaultValue={g.game_date ?? ""}
                onBlur={(e) =>
                  updateGame.mutate({ id: g.id, patch: { game_date: e.target.value || null } })
                }
              />
            </Field>
            <Field label="Time" className="sm:col-span-2">
              <TextInput
                defaultValue={g.game_time ?? ""}
                onBlur={(e) =>
                  updateGame.mutate({ id: g.id, patch: { game_time: e.target.value || null } })
                }
              />
            </Field>
            <Field label="Opponent" className="sm:col-span-2">
              <TextInput
                defaultValue={g.opponent}
                onBlur={(e) => updateGame.mutate({ id: g.id, patch: { opponent: e.target.value } })}
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
                onBlur={(e) =>
                  updateGame.mutate({ id: g.id, patch: { location: e.target.value || null } })
                }
              />
            </Field>
            <Field label="Us" className="sm:col-span-1">
              <TextInput
                type="number"
                defaultValue={g.team_score ?? ""}
                onBlur={(e) =>
                  updateGame.mutate({ id: g.id, patch: scorePatch(g, "team_score", e.target.value) })
                }
              />
            </Field>
            <Field label="Them" className="sm:col-span-1">
              <TextInput
                type="number"
                defaultValue={g.opponent_score ?? ""}
                onBlur={(e) =>
                  updateGame.mutate({
                    id: g.id,
                    patch: scorePatch(g, "opponent_score", e.target.value),
                  })
                }
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
        ))}
        {gamesQuery.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No games yet.</p>
        ) : null}
      </div>
    </div>
  );
}
