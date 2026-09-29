import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Btn, Field, TextInput } from "@/components/ui-kit";
import { uploadMedia } from "@/lib/storage";
import type { Coach } from "@/lib/team";
import { SaveStatus, useRowSaveStatus, useSaveStatus } from "@/components/save-status";
import { PhotoDay } from "@/components/editors/photo-day";

export function CoachEditor({ teamId, seasonId }: { teamId: string; seasonId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [showForm, setShowForm] = useState(true);
  const rowSave = useRowSaveStatus();
  const [addState, setAddState] = useSaveStatus();

  const coachesQuery = useQuery({
    queryKey: ["coaches", seasonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coaches")
        .select("*")
        .eq("season_id", seasonId)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Coach[];
    },
  });

  const addCoach = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("coaches").insert({
        team_id: teamId,
        season_id: seasonId,
        name,
        title: title || null,
        sort_order: coachesQuery.data?.length ?? 0,
      });
      if (error) throw error;
    },
     onMutate: () => setAddState("saving"),
     onSuccess: () => {
       setAddState("saved");
        setShowForm(false);
      setName("");
      setTitle("");
      qc.invalidateQueries({ queryKey: ["coaches", seasonId] });
    },
     onError: (e: Error) => { setAddState("error"); toast.error(e.message); },
  });

  const updateCoach = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Coach> }) => {
      const { error } = await supabase.from("coaches").update(patch).eq("id", id);
      if (error) throw error;
    },
     onMutate: ({ id }) => rowSave.set(id, "saving"),
     onSuccess: (_data, { id }) => { rowSave.set(id, "saved"); qc.invalidateQueries({ queryKey: ["coaches", seasonId] }); },
     onError: (e: Error, { id }) => { rowSave.set(id, "error"); toast.error(e.message); },
  });

  const removeCoach = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coaches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coaches", seasonId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  async function handlePhoto(id: string, file: File) {
    try {
      const url = await uploadMedia("team-photos", file, teamId);
      updateCoach.mutate({ id, patch: { photo_url: url } });
    } catch {
      toast.error("That photo didn't upload.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {showForm ? <form
        className="grid gap-3 sm:grid-cols-12"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) addCoach.mutate();
        }}
      >
        <Field label="Coach name" className="sm:col-span-5">
          <TextInput required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Title" className="sm:col-span-5">
          <TextInput
            value={title}
            placeholder="Head Coach"
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <div className="flex items-end sm:col-span-2">
          <Btn type="submit" className="w-full" disabled={addCoach.isPending}>Save coach</Btn>
        </div>
      </form> : null}
       <div className="flex items-center gap-3"><SaveStatus state={addState} />{!showForm ? <Btn type="button" variant="outline" onClick={() => { setShowForm(true); setAddState("idle"); }}><Plus className="mr-1 h-4 w-4" /> Add another coach</Btn> : null}</div>
       <PhotoDay teamId={teamId} table="coaches" people={(coachesQuery.data ?? []).map((c) => ({ id: c.id, name: c.name }))} onSaved={() => void qc.invalidateQueries({ queryKey: ["coaches", seasonId] })} />

      {(coachesQuery.data ?? []).map((c) => (
        <div key={c.id} className="panel grid items-end gap-3 p-3 sm:grid-cols-12 sm:p-4">
          <Field label="Name" className="sm:col-span-4">
            <TextInput
              defaultValue={c.name}
               onBlur={(e) => { if (e.target.value !== c.name) updateCoach.mutate({ id: c.id, patch: { name: e.target.value } }); }}
            />
          </Field>
          <Field label="Title" className="sm:col-span-5">
            <TextInput
              defaultValue={c.title ?? ""}
               onBlur={(e) => { if (e.target.value !== (c.title ?? "")) updateCoach.mutate({ id: c.id, patch: { title: e.target.value } }); }}
            />
          </Field>
          <div className="flex items-center gap-2 sm:col-span-3 sm:justify-end">
            <label className="cursor-pointer rounded-md border border-input px-3 py-2 text-xs font-semibold hover:bg-secondary">
              {c.photo_url ? "Change photo" : "Photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePhoto(c.id, f);
                }}
              />
            </label>
            <button
              type="button"
              aria-label={`Remove ${c.name}`}
              onClick={() => removeCoach.mutate(c.id)}
              className="rounded-md p-2 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
           <div className="sm:col-span-12"><SaveStatus state={rowSave.state(c.id)} /></div>
        </div>
      ))}
      {coachesQuery.data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">No coaches yet.</p>
      ) : null}
    </div>
  );
}
