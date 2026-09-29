import { DropZone } from "@/components/drop-zone";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Btn, Field, SelectInput, TextInput } from "@/components/ui-kit";
import { uploadMedia } from "@/lib/storage";
import { extractPalette, isValidHex, onColor } from "@/lib/colors";
import { slugify } from "@/lib/slug";
import { TEAM_LEVELS } from "@/lib/team";
import { suggestedTeamName } from "@/lib/team-naming";

export type TeamBasics = {
  name: string;
  mascot: string;
  level: string;
  seasonLabel: string;
  slug: string;
  slugTouched: boolean;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  tagline: string;
};

export function emptyTeamBasics(): TeamBasics {
  return {
    name: "",
    mascot: "",
    level: "Varsity",
    seasonLabel: "2026",
    slug: "",
    slugTouched: false,
    logo_url: null,
    primary_color: "#0B0B0F",
    secondary_color: "#E9E9EF",
    tagline: "",
  };
}

export function TeamBasicsForm({
  value,
  onChange,
  uploadPrefix,
  showSeason = true,
  organizationName = "",
}: {
  value: TeamBasics;
  onChange: (next: TeamBasics) => void;
  uploadPrefix: string;
  showSeason?: boolean;
  organizationName?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof TeamBasics>(key: K, v: TeamBasics[K]) {
    onChange({ ...value, [key]: v });
  }

  function setName(name: string, mascot = value.mascot) {
    onChange({
      ...value,
      name,
      mascot,
      slug: value.slugTouched ? value.slug : slugify(name),
    });
  }

  async function handleLogo(file: File) {
    setUploading(true);
    try {
      const [primary, secondary] = await extractPalette(file);
      const url = await uploadMedia("team-logos", file, uploadPrefix);
      onChange({ ...value, logo_url: url, primary_color: primary, secondary_color: secondary });
      toast.success("Logo added — colors pulled from it");
    } catch {
      toast.error("That logo didn't upload.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-12">
       <Field label="What's your mascot or team nickname?" className="sm:col-span-12">
        <TextInput
          required
          value={value.mascot}
           placeholder="e.g. Normans"
          onChange={(e) => {
            const next = e.target.value;
            const previousSuggestion = suggestedTeamName(organizationName, value.mascot);
            if (!value.name || value.name === previousSuggestion) setName(suggestedTeamName(organizationName, next), next);
            else set("mascot", next);
          }}
        />
      </Field>
       <div className="border-l-4 border-primary bg-surface px-4 py-4 sm:col-span-12 sm:px-6" aria-live="polite">
         <p className="font-condensed text-sm font-bold uppercase text-muted-foreground">{organizationName || "Your school, club or league"}</p>
         <p className="display-xl mt-2 break-words text-3xl uppercase leading-none sm:text-5xl">{value.name || suggestedTeamName(organizationName, value.mascot) || "Your team name"}</p>
         <Btn type="button" variant="ghost" className="mt-2 h-auto px-0 py-1 text-primary" onClick={() => setEditingDisplayName((open) => !open)} aria-expanded={editingDisplayName}>
           {editingDisplayName ? "Done editing" : "Edit display name"}
         </Btn>
         {editingDisplayName ? <Field label="Display name" className="mt-2 max-w-lg">
           <TextInput required value={value.name} placeholder={suggestedTeamName(organizationName, value.mascot) || "Beverly Hills Normans"} onChange={(e) => setName(e.target.value)} />
         </Field> : null}
       </div>

      <Field label="Level" className="sm:col-span-4">
        <SelectInput value={value.level} onChange={(e) => set("level", e.target.value)}>
          {TEAM_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </SelectInput>
      </Field>
      {showSeason ? (
        <Field label="Season" className="sm:col-span-4">
          <TextInput
            value={value.seasonLabel}
            onChange={(e) => set("seasonLabel", e.target.value)}
          />
        </Field>
      ) : null}
      <Field
        label="Team address"
        hint={`thisismyteam.app/${value.slug || "your-team"}`}
        className={showSeason ? "sm:col-span-4" : "sm:col-span-8"}
      >
        <TextInput
          value={value.slug}
          onChange={(e) => onChange({ ...value, slug: slugify(e.target.value), slugTouched: true })}
        />
      </Field>

      <Field label="Tagline" className="sm:col-span-12">
        <TextInput
          value={value.tagline}
          placeholder="One town. One team."
          onChange={(e) => set("tagline", e.target.value)}
        />
      </Field>

      {/* Logo + colours */}
      <div className="sm:col-span-6">
        <p className="eyebrow mb-1.5 text-muted-foreground">Logo</p>
        <div className="panel flex items-center gap-4 p-4">
          <span
            className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full"
            style={{ backgroundColor: value.primary_color }}
          >
            {value.logo_url ? (
              <img src={value.logo_url} alt="Team logo" className="h-full w-full object-cover" />
            ) : (
              <span
                className="display-xl text-2xl"
                style={{ color: onColor(value.primary_color) }}
              >
                {value.name.slice(0, 1) || "T"}
              </span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <DropZone
              label={uploading ? "Uploading…" : value.logo_url ? "Replace logo" : "Upload logo"}
              hint="PNG or JPG · we pull your two main colors from it"
              accept="image/*"
              disabled={uploading}
              onFiles={(files) => { const f = files[0]; if (f) handleLogo(f); }}
            />
          </div>
        </div>
      </div>

      <div className="sm:col-span-6">
        <p className="eyebrow mb-1.5 text-muted-foreground">Team colors</p>
        <div className="panel flex flex-col gap-3 p-4">
          {(["primary_color", "secondary_color"] as const).map((key) => (
            <div key={key} className="flex items-center gap-3">
              <input
                type="color"
                aria-label={key === "primary_color" ? "Primary color" : "Secondary color"}
                value={isValidHex(value[key]) ? value[key] : "#000000"}
                onChange={(e) => set(key, e.target.value)}
                className="h-10 w-12 cursor-pointer rounded border border-input bg-transparent"
              />
              <TextInput
                value={value[key]}
                onChange={(e) => set(key, e.target.value)}
                className="font-mono"
              />
              <span className="eyebrow w-20 text-muted-foreground">
                {key === "primary_color" ? "Primary" : "Second"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
