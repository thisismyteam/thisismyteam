import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadMedia } from "@/lib/storage";
import { Btn } from "@/components/ui-kit";
import { SaveStatus, useSaveStatus } from "@/components/save-status";

function readSize(file: File) {
  return new Promise<{ w: number; h: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { reject(new Error("Could not read that image.")); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

export function AppIconEditor({ teamId, teamName, value, logoUrl, color, onSaved }: {
  teamId: string; teamName: string; value: string | null; logoUrl: string | null; color: string; onSaved: () => void;
}) {
  const [icon, setIcon] = useState(value);
  const [state, setState] = useSaveStatus();
  const input = useRef<HTMLInputElement>(null);
  const shown = icon || logoUrl;

  async function save(url: string | null) {
    setState("saving");
    const { error } = await supabase.from("teams").update({ app_icon_url: url }).eq("id", teamId);
    if (error) { setState("error"); toast.error(error.message); return; }
    setIcon(url); setState("saved"); onSaved();
  }

  async function pick(file?: File) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return toast.error("Use a PNG, JPG or WebP image.");
    try {
      const { w, h } = await readSize(file);
      if (w < 512 || h < 512) return toast.error(`That image is ${w}x${h}. Use at least 512x512.`);
      if (Math.abs(w - h) > 2) return toast.error("The app icon must be square.");
      setState("saving");
      const url = await uploadMedia("team-logos", file, teamId);
      await save(url);
    } catch (e) {
      setState("error");
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    }
  }

  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-condensed text-xl font-bold uppercase">App icon <span className="text-sm font-semibold normal-case text-muted-foreground">(optional)</span></p>
          <p className="mt-1 text-sm text-muted-foreground">Square image, at least 512x512. Used when fans add your team page to their phone's home screen. Without one, we use your logo.</p>
        </div>
        <SaveStatus state={state} />
      </div>
      <div className="mt-4 flex items-center gap-5">
        <div className="flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-2xl bg-muted p-3">
          <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[22%] shadow-md" style={{ backgroundColor: color }}>
            {shown ? <img src={shown} alt="Home screen icon preview" className={icon ? "h-full w-full object-cover" : "h-4/5 w-4/5 object-contain"} /> : <span className="font-condensed text-2xl font-bold text-primary-foreground">{teamName.slice(0, 1)}</span>}
          </span>
          <span className="w-full truncate text-center text-[10px] text-foreground">{teamName}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
          <Btn type="button" variant="outline" onClick={() => input.current?.click()}>{icon ? "Replace icon" : "Upload icon"}</Btn>
          {icon ? <Btn type="button" variant="ghost" onClick={() => void save(null)}>Remove</Btn> : null}
        </div>
      </div>
    </div>
  );
}
