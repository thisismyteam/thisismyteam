import { DropZone } from "@/components/drop-zone";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Btn, Field, TextInput, SelectInput } from "@/components/ui-kit";
import { HighlightPlayer } from "@/components/team-portrait";
import { uploadMedia } from "@/lib/storage";
import { validateVideo, videoSource } from "@/lib/media";
import type { Game } from "@/lib/team";
import type { Database } from "@/integrations/supabase/types";
import { Search, X } from "lucide-react";
import { searchLeaderPlayers } from "@/lib/leader-players";
import { useSeasonRoster } from "@/lib/player-picker";

type Highlight = Database["public"]["Tables"]["highlights"]["Row"];
type Tag = Database["public"]["Tables"]["highlight_players"]["Row"];
const empty = { title: "", game_id: "", video_url: "", featured: false, playerIds: [] as string[] };
type QueuedClip = { file: File; title: string; progress: number; state: "ready" | "uploading" | "saved" | "error" };

export function HighlightsEditor({ teamId, seasonId }: { teamId: string; seasonId: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState({ ...empty });
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [queue, setQueue] = useState<QueuedClip[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [tagOpen, setTagOpen] = useState(false);
  const playersQuery = useSeasonRoster(teamId, seasonId);
  const query = useQuery({ queryKey: ["highlights", seasonId], queryFn: async () => {
    const [h, t, g] = await Promise.all([
      supabase.from("highlights").select("*").eq("season_id", seasonId).order("featured", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("highlight_players").select("*").eq("season_id", seasonId),
      supabase.from("games").select("*").eq("season_id", seasonId),
    ]);
    for (const result of [h, t, g]) if (result.error) throw result.error;
    return { clips: (h.data ?? []) as Highlight[], tags: (t.data ?? []) as Tag[], games: (g.data ?? []) as Game[] };
  }});
  const tagPlayers = searchLeaderPlayers(playersQuery.data ?? [], tagSearch);
  function refresh() { void qc.invalidateQueries({ queryKey: ["highlights", seasonId] }); }
  const tidyTitle = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  async function saveQueue(items: QueuedClip[] = queue, offset = 0) {
    setBusy(true);
    for (let k = 0; k < items.length; k++) {
      const i = k + offset;
      const clip = items[k];
      if (!clip) continue;
      if (clip.state === "saved") continue;
      try {
        validateVideo(clip.file);
        setQueue((items) => items.map((item, j) => j === i ? { ...item, state: "uploading", progress: 1 } : item));
        const url = await uploadMedia("team-videos", clip.file, teamId);
        setQueue((items) => items.map((item, j) => j === i ? { ...item, progress: 90 } : item));
        const { data: saved, error } = await supabase.from("highlights").insert({ team_id: teamId, season_id: seasonId, title: clip.title.trim() || tidyTitle(clip.file.name), video_url: url, game_id: draft.game_id || null, featured: draft.featured }).select("id").single();
        if (error) throw error;
        if (draft.playerIds.length) {
          const { error: tagError } = await supabase.from("highlight_players").insert(draft.playerIds.map((player_id) => ({ highlight_id: saved.id, player_id, team_id: teamId, season_id: seasonId })));
          if (tagError) toast.error(`Saved ${clip.title}, but player tags could not be added.`);
        }
        setQueue((items) => items.map((item, j) => j === i ? { ...item, progress: 100, state: "saved" } : item));
        toast.success(`Clip added: ${clip.title.trim() || tidyTitle(clip.file.name)}`);
        refresh();
      } catch (e) {
        setQueue((items) => items.map((item, j) => j === i ? { ...item, state: "error", progress: 0 } : item));
        toast.error(e instanceof Error ? e.message : `Could not save ${clip.file.name}`);
      }
    }
    setBusy(false); refresh();
  }
  async function handleFile(file: File) {
    try {
      validateVideo(file);
      setBusy(true); setProgress(1);
      const timer = window.setInterval(() => setProgress((p) => Math.min(90, p + 4)), 800);
      try { const url = await uploadMedia("team-videos", file, teamId); setDraft((d) => ({ ...d, video_url: url })); setProgress(100); toast.success("Clip uploaded"); }
      finally { window.clearInterval(timer); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Clip upload failed"); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!draft.title.trim() || !videoSource(draft.video_url)) { toast.error("Add a title and a valid uploaded video, YouTube or Hudl link."); return; }
    setBusy(true);
    try {
      const payload = { title: draft.title.trim(), video_url: draft.video_url.trim(), game_id: draft.game_id || null, featured: draft.featured };
      const result = editing ? await supabase.from("highlights").update(payload).eq("id", editing).select("id").single() : await supabase.from("highlights").insert({ ...payload, team_id: teamId, season_id: seasonId }).select("id").single();
      if (result.error) throw result.error;
      const id = result.data.id;
      const { error: deleteError } = await supabase.from("highlight_players").delete().eq("highlight_id", id);
      if (deleteError) throw deleteError;
      if (draft.playerIds.length) {
        const { error } = await supabase.from("highlight_players").insert(draft.playerIds.map((player_id) => ({ highlight_id: id, player_id, team_id: teamId, season_id: seasonId })));
        if (error) throw error;
      }
      setEditing(null); setDraft({ ...empty, playerIds: [] }); refresh(); toast.success("Highlight saved");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save highlight"); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!window.confirm("Remove this highlight?")) return;
    const { error } = await supabase.from("highlights").delete().eq("id", id);
    if (error) toast.error(error.message); else { refresh(); toast.success("Highlight removed"); }
  }
  return <div className="space-y-8">
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <Field label="Clip title"><TextInput required maxLength={120} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
      <Field label="Game (optional)"><SelectInput value={draft.game_id} onChange={(e) => setDraft({ ...draft, game_id: e.target.value })}><option value="">No game</option>{query.data?.games.map((g) => <option key={g.id} value={g.id}>{g.opponent} · {g.game_date ?? "TBD"}</option>)}</SelectInput></Field>
      <Field label="YouTube or Hudl link"><TextInput type="url" value={draft.video_url.startsWith("http") ? draft.video_url : ""} placeholder="https://www.youtube.com/watch?v=..." onChange={(e) => setDraft({ ...draft, video_url: e.target.value })} /></Field>
       <Field label="Or upload clips"><DropZone label="Upload clips" hint="MP4 or MOV, up to 100MB each, select several at once" multiple accept=".mp4,.mov,video/mp4,video/quicktime" disabled={busy} hideList={queue.length > 0} onFiles={(files) => { try { files.forEach(validateVideo); } catch (err) { toast.error(err instanceof Error ? err.message : "Invalid video"); return; } const items: QueuedClip[] = files.map((file) => ({ file, title: tidyTitle(file.name), progress: 0, state: "ready" })); const offset = queue.length; setQueue((prev) => [...prev, ...items]); void saveQueue(items, offset); }} /></Field>
       {queue.length ? <div className="space-y-3 sm:col-span-2"><p className="eyebrow">Uploads</p>{queue.map((clip, i) => <div key={`${clip.file.name}-${i}`} className="border-b border-border pb-3"><div className="flex items-start gap-2"><Field label={`${clip.file.name} · ${(clip.file.size / 1024 / 1024).toFixed(1)} MB`} className="flex-1"><TextInput value={clip.title} disabled={clip.state !== "error"} onChange={(e) => setQueue((items) => items.map((item, j) => j === i ? { ...item, title: e.target.value } : item))} /></Field>{clip.state !== "saved" ? <button type="button" disabled={busy} aria-label={`Remove ${clip.file.name}`} className="mt-7 rounded p-2 hover:bg-secondary" onClick={() => setQueue((items) => items.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button> : null}</div><progress value={clip.state === "uploading" ? undefined : clip.progress} max={100} className="mt-2 h-2 w-full accent-primary" aria-label={`${clip.file.name} upload progress`} /><span className="text-xs text-muted-foreground">{clip.state === "saved" ? "Clip added ✓" : clip.state === "error" ? "Not saved — retry" : clip.state === "uploading" ? "Uploading..." : "Ready"}</span></div>)}<div className="flex gap-2">{queue.some((item) => item.state === "error") ? <Btn type="button" disabled={busy} onClick={() => void saveQueue()}>Retry failed uploads</Btn> : null}<Btn type="button" variant="outline" disabled={busy} onClick={() => setQueue([])}>Clear</Btn></div></div> : null}
      {busy && progress > 0 ? <progress value={progress} max={100} className="w-full accent-primary" aria-label="Clip upload progress" /> : null}
      <div className="sm:col-span-2">
        <p className="eyebrow mb-2 text-muted-foreground">Tagged players</p>
          <div className="relative max-w-md"><Btn type="button" variant="outline" aria-expanded={tagOpen} onClick={() => setTagOpen(!tagOpen)}><Search className="mr-2 h-4 w-4" /> Players ({draft.playerIds.length})</Btn>{tagOpen ? <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto border border-border bg-surface p-2 shadow-lg"><TextInput aria-label="Search players" placeholder="Search name or jersey" value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} /><div className="mt-2 space-y-1">{playersQuery.isLoading ? <p className="px-2 py-2 text-sm text-muted-foreground">Loading roster...</p> : playersQuery.isError ? <p role="alert" className="px-2 py-2 text-sm text-destructive">Could not load the roster. Try again.</p> : tagPlayers.map((p) => <label key={p.id} className="flex cursor-pointer items-center gap-2 px-2 py-2 text-sm hover:bg-secondary"><input type="checkbox" value={p.id} checked={draft.playerIds.includes(p.id)} onChange={(e) => setDraft((current) => ({ ...current, playerIds: e.target.checked ? [...current.playerIds, p.id] : current.playerIds.filter((id) => id !== p.id) }))} />#{p.jersey_number ?? "—"} {p.first_name} {p.last_name}</label>)}</div></div> : null}</div>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={draft.featured} onChange={(e) => setDraft({ ...draft, featured: e.target.checked })} /> Featured</label>
      <div className="flex flex-wrap gap-2 sm:col-span-2"><Btn type="submit" disabled={busy}>{editing ? "Save clip" : "Add clip"}</Btn>{editing ? <Btn type="button" variant="outline" onClick={() => { setEditing(null); setDraft({ ...empty, playerIds: [] }); }}>Cancel</Btn> : null}</div>
    </form>
    <div className="grid gap-4 sm:grid-cols-2">{query.data?.clips.map((clip) => <article key={clip.id} className="border border-border bg-surface"><HighlightPlayer url={clip.video_url ?? ""} title={clip.title} /><div className="p-4"><h3 className="font-condensed text-xl font-bold uppercase">{clip.title}</h3><p className="text-xs text-muted-foreground">{clip.featured ? "Featured · " : ""}{query.data?.tags.filter((t) => t.highlight_id === clip.id).map((t) => playersQuery.data?.find((p) => p.id === t.player_id)?.first_name).filter(Boolean).join(", ")}</p><div className="mt-3 flex gap-2"><Btn type="button" variant="outline" onClick={() => { setEditing(clip.id); setDraft({ title: clip.title, game_id: clip.game_id ?? "", video_url: clip.video_url ?? "", featured: clip.featured, playerIds: query.data?.tags.filter((t) => t.highlight_id === clip.id).map((t) => t.player_id) ?? [] }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</Btn><Btn type="button" variant="danger" onClick={() => void remove(clip.id)}>Remove</Btn></div></div></article>)}</div>
    {query.data?.clips.length === 0 ? <p className="text-sm text-muted-foreground">No highlights yet.</p> : null}
  </div>;
}
