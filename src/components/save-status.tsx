import { useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

export function useSaveStatus() {
  return useState<SaveState>("idle");
}

export function SaveStatus({ state }: { state: SaveState }) {
  return <span role="status" aria-live="polite" className={`inline-block min-w-20 text-xs font-semibold ${state === "error" ? "text-destructive" : "text-muted-foreground"}`}>
    {state === "saving" ? "Saving..." : state === "saved" ? "Saved ✓" : state === "error" ? "Not saved" : ""}
  </span>;
}

export function useRowSaveStatus() {
  const [states, setStates] = useState<Record<string, SaveState>>({});
  return {
    state: (id: string) => states[id] ?? "idle",
    set: (id: string, state: SaveState) => setStates((current) => ({ ...current, [id]: state })),
  };
}