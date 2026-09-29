import { useRef, useState, type DragEvent } from "react";
import { Upload, X } from "lucide-react";

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function accepts(file: File, accept?: string) {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  return accept.split(",").map((a) => a.trim().toLowerCase()).some((a) =>
    a.startsWith(".") ? name.endsWith(a) : a.endsWith("/*") ? file.type.startsWith(a.slice(0, -1)) : file.type === a,
  );
}

type Props = {
  label: string;
  hint?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  compact?: boolean;
  /** Hide the chosen-files list (e.g. when the parent already lists them). */
  hideList?: boolean;
  onFiles: (files: File[]) => void;
  onRemove?: (file: File, index: number) => void;
};

export function DropZone({ label, hint, accept, multiple, disabled, compact, hideList, onFiles, onRemove }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [chosen, setChosen] = useState<File[]>([]);

  function take(list: FileList | null) {
    let files = Array.from(list ?? []).filter((f) => accepts(f, accept));
    if (!multiple) files = files.slice(0, 1);
    if (!files.length) return;
    setChosen(files);
    onFiles(files);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    if (!disabled) take(e.dataTransfer.files);
  }

  const dragProps = {
    onDragOver: (e: DragEvent) => { e.preventDefault(); if (!disabled) setOver(true); },
    onDragLeave: () => setOver(false),
    onDrop,
  };

  const hidden = (
    <input ref={input} type="file" accept={accept} multiple={multiple} disabled={disabled} className="hidden" aria-label={label}
      onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
  );

  if (compact) {
    return (
      <button type="button" disabled={disabled} onClick={() => input.current?.click()} {...dragProps}
        className={`inline-flex items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-xs font-bold uppercase transition-colors disabled:opacity-60 ${over ? "border-primary bg-primary/10" : "border-input hover:border-primary hover:bg-secondary"}`}>
        <Upload className="h-3.5 w-3.5" />{label}{hidden}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div {...dragProps}
        className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${over ? "border-primary bg-primary/10" : "border-input bg-surface/40"} ${disabled ? "opacity-60" : ""}`}>
        <Upload className="h-7 w-7 text-primary" aria-hidden />
        <button type="button" disabled={disabled} onClick={() => input.current?.click()}
          className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-black uppercase tracking-wide text-primary-foreground disabled:opacity-60">
          {label}
        </button>
        <p className="text-xs text-muted-foreground">{hint ? `${hint} · ` : ""}or drag and drop here</p>
        {hidden}
      </div>
      {!hideList && chosen.length ? (
        <ul className="space-y-1">
          {chosen.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
              <span className="truncate" title={f.name}>{f.name}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                {formatSize(f.size)}
                <button type="button" aria-label={`Remove ${f.name}`} className="rounded p-1 hover:bg-secondary hover:text-foreground"
                  onClick={() => { setChosen((c) => c.filter((_, j) => j !== i)); onRemove?.(f, i); }}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
