import { DropZone } from "@/components/drop-zone";
import { useRef, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Btn, SelectInput } from "@/components/ui-kit";
import { uploadMedia } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";

type Person = { id: string; name: string; jersey?: string | null };
type Assignment = { file: File; personId: string; state: "ready" | "saving" | "saved" | "error" };

const normalize = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export function matchPhoto(name: string, people: Person[]): string {
  const stem = normalize(name.replace(/\.[^.]+$/, ""));
  const tokens = stem.split(" ");
  const number = tokens.find((token) => /^\d{1,3}$/.test(token));
  const byNumber = number ? people.filter((person) => person.jersey === number) : [];
  if (byNumber.length === 1) return byNumber[0]?.id ?? "";
  const byName = people.filter((person) => {
    const parts = normalize(person.name).split(" ");
    return parts.length >= 2 && parts.every((part) => tokens.includes(part));
  });
  return byName.length === 1 ? byName[0]?.id ?? "" : "";
}

export function PhotoDay({ people, teamId, table, onSaved }: { people: Person[]; teamId: string; table: "players" | "coaches"; onSaved: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Assignment[]>([]);
  const [busy, setBusy] = useState(false);
  const update = (index: number, patch: Partial<Assignment>) => setItems((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));

  async function save() {
    setBusy(true);
    let saved = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;
      if (!item.personId || item.state === "saved") continue;
      update(i, { state: "saving" });
      try {
        const url = await uploadMedia("team-photos", item.file, teamId);
        const { error } = await (table === "players" ?
          supabase.from("players").update({ photo_url: url }).eq("id", item.personId).eq("team_id", teamId) :
          supabase.from("coaches").update({ photo_url: url }).eq("id", item.personId).eq("team_id", teamId));
        if (error) throw error;
        update(i, { state: "saved" });
        saved++;
      } catch { update(i, { state: "error" }); }
    }
    setBusy(false);
    if (saved) { onSaved(); toast.success(`${saved} photos saved`); }
    if (items.some((item) => item.personId) && saved < items.filter((item) => item.personId && item.state !== "saved").length) toast.error("Some photos couldn't be saved. Check the list and try again.");
  }

  return <div className="space-y-3">
    <DropZone label="Upload photos" hint="JPG or PNG, select several at once. Name files by jersey or name, e.g. 15_luca_brenner.jpg" accept="image/*" multiple disabled={busy} hideList onFiles={(files) => setItems(files.map((file) => ({ file, personId: matchPhoto(file.name, people), state: "ready" })))} />
    {items.length ? <div className="space-y-2 border-t border-border pt-3">
      <p className="text-sm font-semibold">Review matches · {items.filter((item) => item.personId).length} matched / {items.filter((item) => !item.personId).length} unmatched</p>
      {items.map((item, i) => <div key={`${item.file.name}-${i}`} className="grid items-center gap-2 border-b border-border py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <span className="flex min-w-0 items-center gap-1 text-sm"><span className="truncate" title={item.file.name}>{item.file.name}</span><span className="shrink-0 text-xs text-muted-foreground">{Math.max(1, Math.round(item.file.size / 1024))} KB</span>{item.state !== "saved" ? <button type="button" disabled={busy} aria-label={`Remove ${item.file.name}`} className="shrink-0 rounded p-1 hover:bg-secondary" onClick={() => setItems((all) => all.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5" /></button> : null}</span>
        <SelectInput aria-label={`Assign ${item.file.name}`} value={item.personId} disabled={busy || item.state === "saved"} onChange={(e) => update(i, { personId: e.target.value, state: "ready" })}>
          <option value="">Unmatched — skip</option>
          {people.map((person) => <option key={person.id} value={person.id}>{person.jersey ? `#${person.jersey} · ` : ""}{person.name}</option>)}
        </SelectInput>
        <span role="status" className="min-w-16 text-xs text-muted-foreground">{item.state === "saving" ? "Saving..." : item.state === "saved" ? "Saved ✓" : item.state === "error" ? "Not saved" : item.personId ? "Matched" : "Unmatched"}</span>
      </div>)}
      <div className="flex gap-2"><Btn type="button" disabled={busy || !items.some((item) => item.personId && item.state !== "saved")} onClick={() => void save()}>{busy ? "Saving..." : `Save ${items.filter((item) => item.personId && item.state !== "saved").length} photos`}</Btn><Btn type="button" variant="outline" disabled={busy} onClick={() => setItems([])}>Cancel</Btn></div>
    </div> : null}
  </div>;
}