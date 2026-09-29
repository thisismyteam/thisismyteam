import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { Btn } from "@/components/ui-kit";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My teams — This Is My Team" },
      { name: "description", content: "Manage the teams you run on This Is My Team." },
      { property: "og:title", content: "My teams — This Is My Team" },
      { property: "og:description", content: "Manage the teams you run on This Is My Team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  const teamsQuery = useQuery({
    enabled: !!user,
    queryKey: ["my-teams", user?.id],
    queryFn: async () => {
      const { error: claimError } = await supabase.rpc("claim_team_invites");
      if (claimError) throw claimError;
      const { data, error } = await supabase
        .from("team_members")
        .select(
          "role, teams(id, name, slug, logo_url, primary_color, published, level, sports(name))",
        )
        .eq("user_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-primary">Control room</p>
            <h1 className="display-xl mt-2 text-4xl sm:text-5xl">My teams</h1>
          </div>
          <Link to="/start" search={{}}>
            <Btn>New team</Btn>
          </Link>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          {(teamsQuery.data ?? []).map((row) => {
            const team = row.teams as unknown as {
              id: string;
              name: string;
              slug: string;
              logo_url: string | null;
              primary_color: string;
              published: boolean;
              level: string;
              sports?: { name?: string };
            } | null;
            if (!team) return null;
            return (
              <div
                key={team.id}
                className="panel flex flex-wrap items-center gap-4 p-4 sm:p-5"
              >
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full"
                  style={{ backgroundColor: team.primary_color }}
                >
                  {team.logo_url ? (
                    <img src={team.logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="display-xl text-lg text-white">{team.name.slice(0, 1)}</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl">{team.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {team.sports?.name} · {team.level} · {row.role} ·{" "}
                    {team.published ? "Live" : "Draft"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link to="/$slug" params={{ slug: team.slug }}>
                    <Btn variant="outline">View</Btn>
                  </Link>
                  <Link to="/admin/$teamId" params={{ teamId: team.id }}>
                    <Btn>Manage</Btn>
                  </Link>
                </div>
              </div>
            );
          })}

          {teamsQuery.isSuccess && (teamsQuery.data?.length ?? 0) === 0 ? (
            <div className="panel p-10 text-center">
              <p className="text-sm text-muted-foreground">
                You don't run a team yet. Let's fix that.
              </p>
              <Link to="/start" search={{}} className="mt-5 inline-block">
                <Btn>Create my team</Btn>
              </Link>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
