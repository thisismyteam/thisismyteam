import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Btn } from "@/components/ui-kit";
import { uploadMedia } from "@/lib/storage";
import { validateVideo } from "@/lib/media";

export function HeroVideoEditor({ teamId, value, onChange }: { teamId: string; value: string | null; onChange: (url: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  async function save(url: string | null) {
    const { error } = await supabase.from("teams").update({ hero_video_url: url }).eq("id", teamId);
    if (error) throw error;
    onChange(url);
  }
  async function upload(file: File) {
    setBusy(true); setProgress(1);
    try {
      validateVideo(file);
      const interval = window.setInterval(() => setProgress((p) => Math.min(p + 5, 90)), 800);
      try { const url = await uploadMedia("team-videos", file, teamId); await save(url); setProgress(100); toast.success("Team video saved"); }
      finally { window.clearInterval(interval); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Video upload failed."); }
    finally { setBusy(false); }
  }
  return <section className="border-t border-border pt-6">
    <h3 className="font-condensed text-2xl font-bold uppercase">Team video</h3>
    {value ? <video src={value} controls playsInline className="mt-3 aspect-video w-full max-w-xl bg-surface object-cover" onError={() => toast.error("This video may not play in this browser. Try MP4.")} /> : <p className="mt-2 text-sm text-muted-foreground">The team logo appears until a video is added.</p>}
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <label className="inline-flex h-11 cursor-pointer items-center rounded-md bg-primary px-5 text-sm font-bold uppercase text-primary-foreground">{busy ? "Uploading…" : value ? "Replace video" : "Upload video"}<input type="file" accept=".mp4,.mov,video/mp4,video/quicktime" className="hidden" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ""; }} /></label>
      {value ? <Btn type="button" variant="danger" disabled={busy} onClick={async () => { setBusy(true); try { await save(null); toast.success("Video removed"); } catch { toast.error("Could not remove video."); } finally { setBusy(false); } }}>Remove</Btn> : null}
      <span className="text-xs text-muted-foreground">MP4 or MOV · 100MB max</span>
    </div>
    {busy ? <progress className="mt-3 w-full max-w-xl accent-primary" value={progress} max={100} aria-label="Video upload progress" /> : null}
  </section>;
}
