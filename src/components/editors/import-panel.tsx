import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, FileUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/ui-kit";
import { IMPORT_ACCEPT, readImportFile } from "@/lib/import/table-file";
import { extractImportTable } from "@/lib/import.functions";

export type ImportColumn = { key: string; label: string; options?: { value: string; label: string }[]; type?: string; width?: string };

type Row = Record<string, string | undefined> & { warning?: string };

/** Paste + upload + editable preview. Nothing saves until "Save all". */
export function ImportPanel<T extends Row>({
  teamId,
  kind,
  noun,
  columns,
  pasteLabel,
  pasteHint,
  pastePlaceholder,
  parsePaste,
  parseTable,
  onSave,
  saving,
}: {
  teamId: string;
  kind: "roster" | "schedule";
  noun: [string, string];
  columns: ImportColumn[];
  pasteLabel: string;
  pasteHint: string;
  pastePlaceholder: string;
  parsePaste: (text: string) => T[];
  parseTable: (rows: string[][]) => T[];
  onSave: (rows: T[]) => Promise<void>;
  saving: boolean;
}) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<T[] | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const extract = useServerFn(extractImportTable);

  async function handleFile(file: File) {
    setReading(file.name);
    try {
      const content = await readImportFile(file);
      let table: string[][];
      if (content.kind === "table") table = content.rows;
      else {
        const res = await extract({ data: { teamId, kind, fileName: file.name, ...(content.kind === "text" ? { text: content.text } : { dataUrl: content.dataUrl }) } });
        table = res.rows;
      }
      const parsed = parseTable(table);
      if (parsed.length === 0) toast.error(`No ${noun[1]} found in that file.`);
      else setRows(parsed);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read that file.");
    } finally {
      setReading(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const update = (i: number, key: string, value: string) =>
    setRows((current) => current?.map((r, j) => (j === i ? { ...r, [key]: value, warning: undefined } : r)) ?? null);

  if (rows) {
    const warned = rows.filter((r) => r.warning).length;
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="display-xl text-2xl">{rows.length} {rows.length === 1 ? noun[0] : noun[1]} found</p>
          {warned ? <p className="flex items-center gap-1 text-xs font-semibold text-primary"><AlertTriangle className="h-3.5 w-3.5" /> {warned} to check</p> : null}
        </div>
        <p className="text-xs text-muted-foreground">Fix anything below. Nothing is saved until you press Save all.</p>
        <div className="max-h-[60vh] overflow-auto rounded-md border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr>
                {columns.map((c) => <th key={c.key} className="eyebrow px-2 py-2 text-left text-muted-foreground">{c.label}</th>)}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={`border-t border-border align-top ${r.warning ? "bg-primary/5" : ""}`}>
                  {columns.map((c) => (
                    <td key={c.key} className={`px-1 py-1 ${c.width ?? ""}`}>
                      {c.options ? (
                        <select aria-label={c.label} value={r[c.key] ?? ""} onChange={(e) => update(i, c.key, e.target.value)} className="h-9 w-full rounded border border-input bg-surface px-1">
                          {c.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (
                        <input aria-label={c.label} type={c.type ?? "text"} value={r[c.key] ?? ""} onChange={(e) => update(i, c.key, e.target.value)} className="h-9 w-full rounded border border-input bg-surface px-2" />
                      )}
                      {c.key === columns[0]!.key && r.warning ? null : null}
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <button type="button" aria-label="Remove row" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="rounded p-2 text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {warned ? (
          <ul className="text-xs text-muted-foreground">
            {rows.map((r, i) => (r.warning ? <li key={i}>Row {i + 1}: {r.warning}</li> : null))}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Btn type="button" disabled={saving || rows.length === 0} onClick={async () => { try { await onSave(rows); setRows(null); setText(""); } catch { /* toast shown by caller */ } }}>
            {saving ? "Saving..." : `Save all ${rows.length}`}
          </Btn>
          <Btn type="button" variant="outline" onClick={() => setRows(null)}>Cancel</Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="eyebrow">{pasteLabel}</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={pastePlaceholder}
          className="w-full rounded-md border border-input bg-surface p-3 font-mono text-sm outline-none focus:border-primary" />
        <span className="text-xs text-muted-foreground">{pasteHint}</span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Btn type="button" disabled={!text.trim()} onClick={() => {
          const parsed = parsePaste(text);
          if (parsed.length) setRows(parsed); else toast.error(`No ${noun[1]} found. Check the format.`);
        }}>Review list</Btn>
        <span className="text-xs text-muted-foreground">or</span>
        <Btn type="button" variant="outline" disabled={!!reading} onClick={() => fileRef.current?.click()}>
          <FileUp className="mr-1 h-4 w-4" /> {reading ? `Reading ${reading}...` : "Upload a file"}
        </Btn>
        <input ref={fileRef} type="file" accept={IMPORT_ACCEPT} className="hidden" aria-label="Upload a file"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
      </div>
      <p className="text-xs text-muted-foreground">CSV, Excel (.xlsx), Word (.docx), PDF, or a photo/screenshot. Photos, PDFs and Word files are read by AI and may take a few seconds.</p>
    </div>
  );
}
