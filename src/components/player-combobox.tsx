import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { TextInput } from "@/components/ui-kit";
import { searchLeaderPlayers } from "@/lib/leader-players";

export type PickerPlayer = { id: string; first_name: string; last_name: string; jersey_number: string | number | null };

export function playerLabel(p: PickerPlayer) {
  return `#${p.jersey_number ?? "—"} ${p.first_name} ${p.last_name}`;
}

/** One searchable dropdown: click to see all players, type to filter by name or jersey number. */
export function PlayerCombobox({ players, value, onChange, loading, error, placeholder = "Choose player" }: {
  players: PickerPlayer[];
  value: string;
  onChange: (playerId: string) => void;
  loading?: boolean;
  error?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = players.find((p) => p.id === value);
  const matches = searchLeaderPlayers(players, search);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDocClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={loading || error}
        onClick={() => { setOpen(!open); setSearch(""); }}
        className="flex min-h-11 w-full items-center justify-between gap-2 border border-border bg-surface px-3 py-2 text-left text-sm disabled:opacity-60"
      >
        <span className={selected ? "" : "text-muted-foreground"}>
          {loading ? "Loading roster..." : selected ? playerLabel(selected) : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {open ? (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto border border-border bg-surface p-2 shadow-lg">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <TextInput autoFocus aria-label="Search players" placeholder="Name or jersey number" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <ul role="listbox" className="mt-2 space-y-1">
            {matches.length ? matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={p.id === value}
                  onClick={() => { onChange(p.id); setOpen(false); setSearch(""); }}
                  className={`flex min-h-11 w-full items-center px-2 py-2 text-left text-sm hover:bg-secondary ${p.id === value ? "bg-secondary font-semibold" : ""}`}
                >
                  {playerLabel(p)}
                </button>
              </li>
            )) : <li className="px-2 py-2 text-sm text-muted-foreground">No matching players</li>}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
