import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { HighlightPlayer } from "@/components/team-portrait";

type Clip = { id: string; title: string; video_url: string | null };

/** Full-screen highlight popup with prev/next, counter, arrow keys, swipe and auto-advance. */
export function ClipViewer({ clips, index, onIndex, onClose }: { clips: Clip[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const clip = clips[index];
  const total = clips.length;
  const touch = useRef<{ x: number; y: number } | null>(null);
  const go = (d: number) => { const n = index + d; if (n >= 0 && n < total) onIndex(n); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  });

  if (!clip?.video_url) return null;
  const navBtn = "flex h-14 min-w-14 items-center justify-center gap-1 rounded-full bg-surface px-4 font-condensed text-lg font-bold uppercase text-foreground disabled:opacity-30";

  return (
    <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 sm:p-8" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={clip.title}
        className="flex h-full w-full max-w-5xl flex-col justify-center bg-background sm:h-auto sm:bg-surface"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => { const t = e.touches[0]; if (!t) return; touch.current = { x: t.clientX, y: t.clientY }; }}
        onTouchEnd={(e) => {
          const s = touch.current; touch.current = null; if (!s) return;
          const t = e.changedTouches[0]; if (!t) return; const dx = t.clientX - s.x; const dy = t.clientY - s.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
        }}
      >
        <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
          <div className="min-w-0">
            <p className="eyebrow text-team-secondary">{index + 1} of {total}</p>
            <h3 className="truncate font-condensed text-2xl font-bold uppercase">{clip.title}</h3>
          </div>
          <button type="button" aria-label="Close clip" onClick={onClose} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface text-foreground sm:bg-background"><X className="h-6 w-6" /></button>
        </div>
        <HighlightPlayer key={clip.id} url={clip.video_url} title={clip.title} autoPlay onEnded={() => go(1)} />
        {total > 1 ? (
          <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
            <button type="button" className={navBtn} onClick={() => go(-1)} disabled={index === 0} aria-label="Previous clip"><ChevronLeft className="h-6 w-6" /><span className="hidden sm:inline">Previous</span></button>
            <span className="font-condensed text-xl font-bold tabular-nums">{index + 1} / {total}</span>
            <button type="button" className={navBtn} onClick={() => go(1)} disabled={index === total - 1} aria-label="Next clip"><span className="hidden sm:inline">Next</span><ChevronRight className="h-6 w-6" /></button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
