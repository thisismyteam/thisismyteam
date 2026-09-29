import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Btn, Field, TextInput } from "@/components/ui-kit";
import { SaveStatus, useSaveStatus } from "@/components/save-status";

type Involved = { id: string; label: string; url: string; description: string | null; sort_order: number };
export function InvolvedEditor({ teamId, seasonId }: { teamId: string; seasonId: string }) {
  const qc = useQueryClient(); const [label, setLabel] = useState(""); const [url, setUrl] = useState(""); const [description, setDescription] = useState(""); const [editing, setEditing] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useSaveStatus();
  const query = useQuery({ queryKey: ["involved", seasonId], queryFn: async () => { const { data, error } = await supabase.from("get_involved_links").select("id,label,url,description,sort_order").eq("season_id", seasonId).order("sort_order"); if (error) throw error; return (data ?? []) as Involved[]; } });
  function refresh() { void qc.invalidateQueries({ queryKey: ["involved", seasonId] }); }
  async function save() {
    try { const parsed = new URL(url); if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw Error(); }
    catch { toast.error("Enter a valid http or https link."); return; }
    setBusy(true);
    setSaveState("saving");
    const payload = { label: label.trim(), url: url.trim(), description: description.trim() || null };
    const { error } = editing ? await supabase.from("get_involved_links").update(payload).eq("id", editing) : await supabase.from("get_involved_links").insert({ ...payload, team_id: teamId, season_id: seasonId, sort_order: query.data?.length ?? 0 });
    setBusy(false); if (error) { setSaveState("error"); toast.error(error.message); } else { setSaveState("saved"); setLabel(""); setUrl(""); setDescription(""); setEditing(null); refresh(); toast.success("Link saved"); }
  }
  return <div className="space-y-5"><form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void save(); }}><Field label="Label"><TextInput required maxLength={80} placeholder="Booster Club" value={label} onChange={(e) => setLabel(e.target.value)} /></Field><Field label="Link"><TextInput required type="url" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} /></Field><Field label="Description (optional)" className="sm:col-span-2"><TextInput value={description} onChange={(e) => setDescription(e.target.value)} /></Field><div className="flex items-center gap-2 sm:col-span-2"><Btn type="submit" disabled={busy}>{editing ? "Save link" : "Add link"}</Btn><SaveStatus state={saveState} />{editing ? <Btn type="button" variant="outline" onClick={() => { setEditing(null); setLabel(""); setUrl(""); setDescription(""); }}>Cancel</Btn> : null}</div></form>
  {query.data?.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-3 border-b border-border py-3"><div className="min-w-0 flex-1"><p className="font-condensed text-xl font-bold uppercase">{item.label}</p><p className="truncate text-xs text-muted-foreground">{item.url}</p></div><Btn type="button" variant="outline" onClick={() => { setEditing(item.id); setLabel(item.label); setUrl(item.url); setDescription(item.description ?? ""); }}>Edit</Btn><Btn type="button" variant="danger" onClick={async () => { const { error } = await supabase.from("get_involved_links").delete().eq("id", item.id); if (error) toast.error(error.message); else refresh(); }}>Remove</Btn></div>)}
  {query.data?.length === 0 ? <p className="text-sm text-muted-foreground">No links yet.</p> : null}</div>;
}
