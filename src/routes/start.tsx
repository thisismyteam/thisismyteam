import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { Btn, Field, SelectInput, TextInput, SectionTitle } from "@/components/ui-kit";
import {
  TeamBasicsForm,
  emptyTeamBasics,
  type TeamBasics,
} from "@/components/editors/team-basics-form";
import { RosterEditor } from "@/components/editors/roster-editor";
import { CoachEditor } from "@/components/editors/coach-editor";
import { ScheduleEditor } from "@/components/editors/schedule-editor";
import { isReservedSlug, slugify } from "@/lib/slug";
import { ORG_TYPES, type Sport } from "@/lib/team";
import { startTeamCheckout } from "@/lib/billing.functions";

export const Route = createFileRoute("/start")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { sport?: string; teamId?: string; checkout?: string } => {
    const sport = search["sport"];
    return {
      ...(typeof sport === "string" ? { sport } : {}),
      ...(typeof search["teamId"] === "string" ? { teamId: search["teamId"] as string } : {}),
      ...(search["checkout"] === "cancel" ? { checkout: "cancel" } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Set up your team — This Is My Team" },
      {
        name: "description",
        content: "Add your organization, team, roster and schedule, then go live.",
      },
      { property: "og:title", content: "Set up your team — This Is My Team" },
      {
        property: "og:description",
        content: "Add your organization, team, roster and schedule, then go live.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Wizard,
});

const STEPS = ["Organization", "Team", "Roster", "Schedule", "Review"];

function Wizard() {
  const { sport: sportSlug, teamId: resumedTeamId, checkout } = Route.useSearch();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState("school");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [basics, setBasics] = useState<TeamBasics>(emptyTeamBasics);
  const [resumeError, setResumeError] = useState("");
  const checkoutFn = useServerFn(startTeamCheckout);

  useEffect(() => {
    if (!user || !resumedTeamId) return;
    let active = true;
    (async () => {
      const { data: membership } = await supabase.from("team_members").select("role").eq("team_id", resumedTeamId).eq("user_id", user.id).maybeSingle();
      if (membership?.role !== "owner") throw new Error("Only the team Owner can return to checkout.");
      const { data: team, error } = await supabase.from("teams").select("*, organizations(name, org_type)").eq("id", resumedTeamId).single();
      if (error || !team || team.published) throw new Error("This team is already live or unavailable.");
      const { data: season } = await supabase.from("seasons").select("id, label").eq("team_id", resumedTeamId).eq("is_current", true).maybeSingle();
      if (!season) throw new Error("Season unavailable.");
      if (!active) return;
      setTeamId(team.id); setSeasonId(season.id); setOrgId(team.organization_id);
      setOrgName(team.organizations?.name ?? ""); setOrgType(team.organizations?.org_type ?? "school"); setSportId(team.sport_id);
      setBasics({ name: team.name, mascot: team.mascot ?? "", level: team.level, seasonLabel: season.label,
        slug: team.slug, slugTouched: true, logo_url: team.logo_url, primary_color: team.primary_color,
        secondary_color: team.secondary_color, tagline: team.tagline ?? "" });
      setStep(5);
    })().catch((e) => { if (active) setResumeError(e instanceof Error ? e.message : "Could not load the review."); });
    return () => { active = false; };
  }, [user, resumedTeamId]);

  useEffect(() => {
    if (!loading && !user) navigate({
        to: "/auth",
        search: sportSlug ? { sport: sportSlug } : {},
        replace: true,
      });
  }, [loading, user, sportSlug, navigate]);

  const sportsQuery = useQuery({
    queryKey: ["sports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sports").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as Sport[];
    },
  });

  const [sportId, setSportId] = useState<string | null>(null);
  useEffect(() => {
    if (!sportsQuery.data || sportId) return;
    const match = sportsQuery.data.find((s) => s.slug === sportSlug);
    setSportId((match ?? sportsQuery.data[0])?.id ?? null);
  }, [sportsQuery.data, sportSlug, sportId]);

  const sport = sportsQuery.data?.find((s) => s.id === sportId) ?? null;

  async function saveOrganization() {
    if (!orgName.trim()) return;
    setBusy(true);
    try {
      if (orgId) {
        const { error } = await supabase
          .from("organizations")
          .update({ name: orgName, org_type: orgType })
          .eq("id", orgId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("organizations")
          .insert({ name: orgName, org_type: orgType })
          .select("id")
          .single();
        if (error) throw error;
        setOrgId(data.id);
      }
      setStep(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  }

  async function saveTeam() {
    if (!orgId || !sportId || !basics.name.trim()) return;
    setBusy(true);
    try {
      let slug = basics.slug || slugify(basics.name);
      if (isReservedSlug(slug)) slug = `${slug}-team`;

      if (teamId) {
        const { error } = await supabase
          .from("teams")
          .update({
            name: basics.name,
            mascot: basics.mascot || null,
            level: basics.level,
            slug,
            logo_url: basics.logo_url,
            primary_color: basics.primary_color,
            secondary_color: basics.secondary_color,
            tagline: basics.tagline || null,
          })
          .eq("id", teamId);
        if (error) throw error;
        if (seasonId) {
          await supabase
            .from("seasons")
            .update({ label: basics.seasonLabel, year: Number(basics.seasonLabel) || 2026 })
            .eq("id", seasonId);
        }
      } else {
        // Ensure the address is free, adding a suffix if needed.
        let attempt = slug;
        for (let i = 2; i < 30; i += 1) {
          const { data: taken } = await supabase
            .from("teams")
            .select("id")
            .eq("slug", attempt)
            .maybeSingle();
          if (!taken) break;
          attempt = `${slug}-${i}`;
        }
        slug = attempt;

        const { data: team, error } = await supabase
          .from("teams")
          .insert({
            organization_id: orgId,
            sport_id: sportId,
            name: basics.name,
            mascot: basics.mascot || null,
            level: basics.level,
            slug,
            logo_url: basics.logo_url,
            primary_color: basics.primary_color,
            secondary_color: basics.secondary_color,
            tagline: basics.tagline || null,
          })
          .select("id, slug")
          .single();
        if (error) throw error;

        const { error: memberError } = await supabase
          .from("team_members")
          .insert({ team_id: team.id, user_id: user!.id, role: "owner" });
        if (memberError) throw memberError;

        const { data: season, error: seasonError } = await supabase
          .from("seasons")
          .insert({
            team_id: team.id,
            label: basics.seasonLabel || "2026",
            year: Number(basics.seasonLabel) || 2026,
            is_current: true,
          })
          .select("id")
          .single();
        if (seasonError) throw seasonError;

        setTeamId(team.id);
        setSeasonId(season.id);
      }
      setBasics((b) => ({ ...b, slug }));
      setStep(3);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your team.");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!teamId) return;
    setBusy(true);
    try {
      const { url } = await checkoutFn({ data: { teamId } });
      window.location.assign(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start checkout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <div className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-4 hide-scrollbar sm:px-6">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const state = n === step ? "current" : n < step ? "done" : "todo";
            return (
              <div key={label} className="flex min-w-fit flex-1 items-center gap-2 pr-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    state === "current"
                      ? "bg-primary text-primary-foreground"
                      : state === "done"
                        ? "bg-foreground text-background"
                        : "border border-border text-muted-foreground"
                  }`}
                >
                  {n}
                </span>
                <span
                  className={`eyebrow ${state === "todo" ? "text-muted-foreground" : "text-foreground"}`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-8 pb-24 sm:px-6 sm:py-12">
        {resumeError ? <p role="alert" className="mb-6 text-destructive">{resumeError}</p> : null}
        {step === 1 ? (
          <form
            className="flex flex-col gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              saveOrganization();
            }}
          >
            <SectionTitle eyebrow="Step 1" title="Your organization" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Organization name">
                <TextInput
                  required
                  value={orgName}
                  placeholder="Northside High School"
                  onChange={(e) => setOrgName(e.target.value)}
                />
              </Field>
              <Field label="Type">
                <SelectInput value={orgType} onChange={(e) => setOrgType(e.target.value)}>
                  {ORG_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Sport">
                <SelectInput
                  value={sportId ?? ""}
                  onChange={(e) => setSportId(e.target.value)}
                  disabled={!sportsQuery.data}
                >
                  {(sportsQuery.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>
            <div>
              <Btn type="submit" disabled={busy}>
                Continue
              </Btn>
            </div>
          </form>
        ) : null}

        {step === 2 ? (
          <form
            className="flex flex-col gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              saveTeam();
            }}
          >
            <SectionTitle eyebrow="Step 2" title="Team basics" />
            <TeamBasicsForm value={basics} onChange={setBasics} uploadPrefix={teamId ?? user?.id ?? "new"} />
            <div className="flex gap-2">
              <Btn type="button" variant="outline" onClick={() => setStep(1)}>
                Back
              </Btn>
              <Btn type="submit" disabled={busy}>
                Continue
              </Btn>
            </div>
          </form>
        ) : null}

        {step === 3 && teamId && seasonId ? (
          <div className="flex flex-col gap-8">
            <SectionTitle eyebrow="Step 3" title="Roster and coaches" />
            <RosterEditor
              teamId={teamId}
              seasonId={seasonId}
              positions={sport?.positions ?? []}
              defaultLevel={basics.level}
            />
            <div className="border-t border-border pt-8">
              <SectionTitle title="Coaches" />
              <div className="mt-5">
                <CoachEditor teamId={teamId} seasonId={seasonId} />
              </div>
            </div>
            <div className="flex gap-2">
              <Btn variant="outline" onClick={() => setStep(2)}>
                Back
              </Btn>
              <Btn onClick={() => setStep(4)}>Continue</Btn>
            </div>
          </div>
        ) : null}

        {step === 4 && teamId && seasonId ? (
          <div className="flex flex-col gap-6">
            <SectionTitle eyebrow="Step 4" title="Schedule" />
            <ScheduleEditor teamId={teamId} seasonId={seasonId} />
            <div className="flex gap-2">
              <Btn variant="outline" onClick={() => setStep(3)}>
                Back
              </Btn>
              <Btn onClick={() => setStep(5)}>Continue</Btn>
            </div>
          </div>
        ) : null}

        {step === 5 && teamId ? (
          <div className="flex flex-col gap-6">
            <SectionTitle eyebrow="Step 5" title="Review and go live" />
            {checkout === "cancel" ? <p role="alert" className="border-l-4 border-primary bg-surface p-4 text-sm">Checkout was cancelled. No payment was made and your team is still unpublished.</p> : null}
            <div className="panel flex flex-col gap-4 p-6">
              <div className="flex items-center gap-4">
                <span
                  className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full"
                  style={{ backgroundColor: basics.primary_color }}
                >
                  {basics.logo_url ? (
                    <img src={basics.logo_url} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </span>
                <div>
                  <h3 className="text-2xl">{basics.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {orgName} · {sport?.name} · {basics.level} · {basics.seasonLabel}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Your page will live at{" "}
                <span className="font-semibold text-foreground">
                  thisismyteam.app/{basics.slug}
                </span>
              </p>
            </div>
            <div className="flex items-baseline justify-between border-y border-border py-5">
              <span className="font-semibold">This Is My Team - Team Season</span>
              <span className="display-xl text-2xl">$299 / season</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn variant="outline" onClick={() => setStep(4)}>
                Back
              </Btn>
              <Btn onClick={publish} disabled={busy} className="px-8">
                Pay and publish
              </Btn>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
