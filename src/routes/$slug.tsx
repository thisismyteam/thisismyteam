import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { getPublicTeam } from "@/lib/public-team.functions";
import { TeamPageView } from "@/components/team-page-view";

export const Route = createFileRoute("/$slug")({
  loader: async ({ params }) => {
    const data = await getPublicTeam({ data: { slug: params.slug } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Team not found" }, { name: "robots", content: "noindex" }],
      };
    }
    const team = loaderData.team as { name: string; tagline: string | null; mascot: string | null };
    const title = `${team.name} — This Is My Team`;
    const description =
      team.tagline ?? `Follow ${team.name}: roster, schedule, results and highlights.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <p className="text-sm text-muted-foreground">This team page didn't load. Try refreshing.</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="display-xl text-5xl">No team here</h1>
      <p className="text-sm text-muted-foreground">
        This team address isn't taken yet — or the team isn't live.
      </p>
      <Link to="/" className="text-sm font-semibold text-primary underline">
        Back to This Is My Team
      </Link>
    </div>
  ),
  component: TeamPage,
});

function TeamPage() {
  return <TeamPageView data={Route.useLoaderData()} />;
}
