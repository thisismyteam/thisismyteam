import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Btn, Field, SelectInput, TextInput } from "@/components/ui-kit";
import { uploadMedia } from "@/lib/storage";
import { emptyRosterRow, type Player, type RosterDraftRow } from "@/lib/team";
import { tableToRoster, type RosterImportRow } from "@/lib/import/columns";
import { ImportPanel } from "@/components/editors/import-panel";
import { SaveStatus, useRowSaveStatus, useSaveStatus } from "@/components/save-status";

export function RosterEditor({
  teamId,
  seasonId,
  positions,
  defaultLevel,
}: {
  teamId: string;
  seasonId: string;
  positions: string[];
  defaultLevel: string;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"paste" | "one">("paste");
  const [draft, setDraft] = useState<RosterDraftRow>(() => emptyRosterRow(defaultLevel));
  const rowSave = useRowSaveStatus();
  const [addState, setAddState] = useSaveStatus();

  const playersQuery = useQuery({
    queryKey: ["players", seasonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("season_id", seasonId)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Player[];
    },
  });

  const addMany = useMutation({
    mutationFn: async (rows: RosterDraftRow[]) => {
      const { error } = await supabase.from("players").insert(
        rows.map((r, i) => ({
          team_id: teamId,
          season_id: seasonId,
          jersey_number: r.jersey_number || null,
          first_name: r.first_name,
          last_name: r.last_name,
          grade: r.grade || null,
          level: r.level || null,
          position: r.position || null,
          sort_order: (playersQuery.data?.length ?? 0) + i,
        })),
      );
      if (error) throw error;
    },
     onMutate: () => setAddState("saving"),
     onSuccess: () => {
       setAddState("saved");
      qc.invalidateQueries({ queryKey: ["players", seasonId] });
      setDraft(emptyRosterRow(defaultLevel));
      toast.success("Roster updated");
    },
     onError: (e: Error) => { setAddState("error"); toast.error(e.message); },
  });

  const updatePlayer = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Player> }) => {
      const { error } = await supabase.from("players").update(patch).eq("id", id);
      if (error) throw error;
    },
     onMutate: ({ id }) => rowSave.set(id, "saving"),
     onSuccess: (_data, { id }) => { rowSave.set(id, "saved"); qc.invalidateQueries({ queryKey: ["players", seasonId] }); },
     onError: (e: Error, { id }) => { rowSave.set(id, "error"); toast.error(e.message); },
  });

  const removePlayer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("players").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["players", seasonId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  async function handlePhoto(playerId: string, file: File) {
    try {
      const url = await uploadMedia("team-photos", file, teamId);
      updatePlayer.mutate({ id: playerId, patch: { photo_url: url } });
    } catch {
      toast.error("That photo didn't upload.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("paste")}
          className={`h-10 rounded-md px-4 text-sm font-semibold ${tab === "paste" ? "bg-primary text-primary-foreground" : "border border-input"}`}
        >
          Paste or upload
        </button>
        <button
          type="button"
          onClick={() => setTab("one")}
          className={`h-10 rounded-md px-4 text-sm font-semibold ${tab === "one" ? "bg-primary text-primary-foreground" : "border border-input"}`}
        >
          Add one at a time
        </button>
      </div>

      {tab === "paste" ? (
        <div className="flex flex-col gap-2">
          <ImportPanel<RosterImportRow>
            teamId={teamId}
            kind="roster"
            noun={["player", "players"]}
            columns={[
              { key: "jersey_number", label: "#", width: "w-16" },
              { key: "first_name", label: "First" },
              { key: "last_name", label: "Last" },
              { key: "grade", label: "Grade", width: "w-20" },
              { key: "level", label: "Level" },
              { key: "position", label: "Position", options: [{ value: "", label: "—" }, ...positions.map((p) => ({ value: p, label: p }))] },
            ]}
            pasteLabel="One player per line"
            pasteHint="Jersey, first name, last name, grade, level"
            pastePlaceholder={"12, Jordan, Miles, 11, Varsity\n7, Sam, Ortiz, 12, Varsity"}
            parsePaste={(text) => tableToRoster(text.split(/\r?\n/).filter((l) => l.trim()).map((l) => [l]), positions, defaultLevel)}
            parseTable={(rows) => tableToRoster(rows, positions, defaultLevel)}
            onSave={async (rows) => { await addMany.mutateAsync(rows); }}
            saving={addMany.isPending}
          />
          <SaveStatus state={addState} />
        </div>
      ) : (
        <form
          className="grid gap-3 sm:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.first_name) return;
            addMany.mutate([draft]);
          }}
        >
          <Field label="#" className="sm:col-span-1">
            <TextInput
              value={draft.jersey_number}
              onChange={(e) => setDraft({ ...draft, jersey_number: e.target.value })}
            />
          </Field>
          <Field label="First name" className="sm:col-span-2">
            <TextInput
              required
              value={draft.first_name}
              onChange={(e) => setDraft({ ...draft, first_name: e.target.value })}
            />
          </Field>
          <Field label="Last name" className="sm:col-span-3">
            <TextInput
              value={draft.last_name}
              onChange={(e) => setDraft({ ...draft, last_name: e.target.value })}
            />
          </Field>
          <Field label="Grade" className="sm:col-span-1">
            <TextInput
              value={draft.grade}
              onChange={(e) => setDraft({ ...draft, grade: e.target.value })}
            />
          </Field>
          <Field label="Level" className="sm:col-span-2">
            <TextInput
              value={draft.level}
              onChange={(e) => setDraft({ ...draft, level: e.target.value })}
            />
          </Field>
          <Field label="Position" className="sm:col-span-2">
            <SelectInput
              value={draft.position}
              onChange={(e) => setDraft({ ...draft, position: e.target.value })}
            >
              <option value="">—</option>
              {positions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </SelectInput>
          </Field>
           <div className="flex items-end sm:col-span-1">
            <Btn type="submit" className="w-full" disabled={addMany.isPending}>
              <Plus className="h-4 w-4" />
            </Btn>
          </div>
           <div className="flex items-end pb-3"><SaveStatus state={addState} /></div>
        </form>
      )}

      <div className="flex flex-col gap-2">
        <p className="eyebrow text-muted-foreground">
          Roster — {playersQuery.data?.length ?? 0} players
        </p>
        {(playersQuery.data ?? []).map((p) => (
          <div
            key={p.id}
            className="panel grid grid-cols-2 items-end gap-3 p-3 sm:grid-cols-12 sm:p-4"
          >
            <Field label="#" className="sm:col-span-1">
              <TextInput
                defaultValue={p.jersey_number ?? ""}
                 onBlur={(e) => { if (e.target.value !== (p.jersey_number ?? "")) updatePlayer.mutate({ id: p.id, patch: { jersey_number: e.target.value } }); }}
              />
            </Field>
            <Field label="First" className="sm:col-span-2">
              <TextInput
                defaultValue={p.first_name}
                 onBlur={(e) => { if (e.target.value !== p.first_name) updatePlayer.mutate({ id: p.id, patch: { first_name: e.target.value } }); }}
              />
            </Field>
            <Field label="Last" className="sm:col-span-2">
              <TextInput
                defaultValue={p.last_name}
                 onBlur={(e) => { if (e.target.value !== p.last_name) updatePlayer.mutate({ id: p.id, patch: { last_name: e.target.value } }); }}
              />
            </Field>
            <Field label="Grade" className="sm:col-span-1">
              <TextInput
                defaultValue={p.grade ?? ""}
                 onBlur={(e) => { if (e.target.value !== (p.grade ?? "")) updatePlayer.mutate({ id: p.id, patch: { grade: e.target.value } }); }}
              />
            </Field>
            <Field label="Level" className="sm:col-span-2">
              <TextInput
                defaultValue={p.level ?? ""}
                 onBlur={(e) => { if (e.target.value !== (p.level ?? "")) updatePlayer.mutate({ id: p.id, patch: { level: e.target.value } }); }}
              />
            </Field>
            <Field label="Position" className="sm:col-span-2">
              <SelectInput
                value={p.position ?? ""}
                onChange={(e) =>
                  updatePlayer.mutate({ id: p.id, patch: { position: e.target.value } })
                }
              >
                <option value="">—</option>
                {positions.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <div className="col-span-2 flex items-center gap-2 sm:col-span-2 sm:justify-end">
              <label className="cursor-pointer rounded-md border border-input px-3 py-2 text-xs font-semibold hover:bg-secondary">
                {p.photo_url ? "Change photo" : "Photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handlePhoto(p.id, f);
                  }}
                />
              </label>
              <button
                type="button"
                aria-label={`Remove ${p.first_name}`}
                onClick={() => removePlayer.mutate(p.id)}
                className="rounded-md p-2 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
             <div className="col-span-2 sm:col-span-12"><SaveStatus state={rowSave.state(p.id)} /></div>
          </div>
        ))}
        {playersQuery.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No players yet.</p>
        ) : null}
      </div>
    </div>
  );
}
