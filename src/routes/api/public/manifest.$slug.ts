import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Per-team web app manifest so a team page saved to a phone uses the team's icon.
export const Route = createFileRoute("/api/public/manifest/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slug = String(params.slug ?? "").slice(0, 80);
        const supabase = createClient<Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: team } = await supabase
          .from("teams")
          .select("name, slug, app_icon_url, logo_url, primary_color")
          .eq("slug", slug)
          .eq("published", true)
          .maybeSingle();
        if (!team) return new Response("Not found", { status: 404 });
        const icon = team.app_icon_url || team.logo_url;
        const manifest = {
          name: team.name,
          short_name: team.name.length > 12 ? team.name.split(" ").slice(-1)[0] : team.name,
          start_url: `/${team.slug}`,
          scope: "/",
          display: "standalone",
          background_color: "#141418",
          theme_color: "#141418",
          icons: icon
            ? [
                { src: icon, sizes: "512x512", type: "image/png" },
                { src: icon, sizes: "192x192", type: "image/png" },
              ]
            : [
                { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
                { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
              ],
        };
        return new Response(JSON.stringify(manifest), {
          headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=300" },
        });
      },
    },
  },
});
