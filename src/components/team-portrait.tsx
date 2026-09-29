import { Btn } from "@/components/ui-kit";

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
  return source.kind === "embed" ? (
    <iframe title={title} src={source.url} className="aspect-video w-full bg-background" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
  ) : <video src={source.url} controls playsInline preload="metadata" className="aspect-video w-full bg-background object-contain" />;
}
import { videoSource } from "@/lib/media";
