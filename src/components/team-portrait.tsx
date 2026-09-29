import { Btn } from "@/components/ui-kit";
import { videoSource } from "@/lib/media";
import { resolveHudlVideo } from "@/lib/hudl.functions";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight } from "lucide-react";
import { useState } from "react";

type Props = { name: string; image: string | null; fallback: string; detail: string; caption?: string; onClick?: () => void };

export function TeamPortrait({ name, image, fallback, detail, caption, onClick }: Props) {
  return (
    <Btn type="button" variant="ghost" onClick={onClick} className="group relative block h-auto w-full overflow-hidden rounded-sm border border-border bg-surface p-0 text-left transition-transform hover:-translate-y-1" aria-label={`View ${name}`}>
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-team">
        {image ? <img src={image} alt={name} className="h-full w-full object-cover" /> : <span className="stat-number flex h-full items-center justify-center text-5xl text-team-foreground sm:text-7xl">{fallback}</span>}
        <div className="absolute inset-x-0 bottom-0 bg-background/90 px-3 py-3 backdrop-blur-sm sm:px-4">
          <p className="font-condensed text-lg font-bold uppercase leading-tight text-foreground sm:text-xl">{name}</p>
          <p className="mt-0.5 text-xs font-semibold uppercase text-team-secondary">{detail}</p>
          {caption ? <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p> : null}
        </div>
      </div>
    </Btn>
  );
}

export function HighlightPlayer({ url, title }: { url: string; title: string }) {
  const source = videoSource(url);
  if (!source) return <p className="text-sm text-muted-foreground">This clip cannot be played here.</p>;
  return source.kind === "hudl" ? <HudlPlayer url={url} title={title} /> : source.kind === "embed" ? (
    <iframe title={title} src={source.url} className="aspect-video w-full bg-background" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
  ) : <video src={source.url} controls playsInline preload="metadata" className="aspect-video w-full bg-background object-contain" />;
}

function HudlPlayer({ url, title }: { url: string; title: string }) {
  const [failed, setFailed] = useState(false);
  const resolve = useServerFn(resolveHudlVideo);
  const { data, isPending } = useQuery({ queryKey: ["hudl-video", url], queryFn: () => resolve({ data: { url } }), retry: false, staleTime: 60 * 60 * 1000 });
  if (isPending) return <div className="flex aspect-video items-center justify-center bg-surface-2 text-sm text-muted-foreground">Loading clip...</div>;
   if (data?.embed && !failed) return <div><iframe title={title} src={data.embed} onError={() => setFailed(true)} className="aspect-video w-full bg-background" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /><div className="flex flex-wrap items-center gap-4 p-3"><a className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline" href={data.watch ?? url} target="_blank" rel="noopener noreferrer">Watch on Hudl <ArrowUpRight className="h-4 w-4" /></a><Btn variant="ghost" onClick={() => setFailed(true)}>Player not working?</Btn></div></div>;
   return <div className="flex aspect-video flex-col items-center justify-center gap-4 bg-team p-6 text-center text-team-foreground"><span className="font-condensed text-3xl font-bold uppercase sm:text-5xl">{title}</span><a href={data?.watch ?? url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border border-current px-5 py-3 text-sm font-bold uppercase">Watch on Hudl <ArrowUpRight className="h-5 w-5" /></a></div>;
}
