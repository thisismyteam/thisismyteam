export const IMPORT_ACCEPT = ".txt,.csv,.xlsx,.docx,.pdf,image/*";
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

function cellToString(c: unknown): string {
  if (c == null) return "";
  if (c instanceof Date) return c.toISOString().slice(0, 10);
  return String(c).trim();
}

export type FileContent =
  | { kind: "table"; rows: string[][] }
  | { kind: "text"; text: string }
  | { kind: "dataUrl"; dataUrl: string };

export async function readImportFile(file: File): Promise<FileContent> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error("File must be 10MB or smaller.");
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt")) return { kind: "text", text: await file.text() };
  if (name.endsWith(".csv") || file.type === "text/csv") {
    const Papa = (await import("papaparse")).default;
    const res = Papa.parse<string[]>(await file.text(), { skipEmptyLines: true });
    return { kind: "table", rows: res.data.map((r) => r.map(cellToString)) };
  }
  if (name.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    const rows = await readSheet(file);
    return { kind: "table", rows: rows.map((r) => r.map(cellToString)) };
  }
  if (name.endsWith(".xls")) throw new Error("Old .xls files aren't supported. Save it as .xlsx or CSV.");
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth/mammoth.browser.js");
    const { value } = await (mammoth.default ?? mammoth).extractRawText({ arrayBuffer: await file.arrayBuffer() });
    if (!value.trim()) throw new Error("That Word file looks empty.");
    return { kind: "text", text: value };
  }
  if (name.endsWith(".pdf") || file.type.startsWith("image/")) {
    if (/\.hei[cf]$/.test(name)) throw new Error("HEIC photos aren't supported. Take a screenshot or export as JPG.");
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read that file."));
      reader.readAsDataURL(file);
    });
    return { kind: "dataUrl", dataUrl: name.endsWith(".pdf") ? dataUrl.replace(/^data:[^;]*;/, "data:application/pdf;") : dataUrl };
  }
  throw new Error("Choose a CSV, Excel, Word, PDF or photo file.");
}
