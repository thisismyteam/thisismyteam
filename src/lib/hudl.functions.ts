import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { videoSource } from "@/lib/media";

export const resolveHudlVideo = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ url: z.string().max(500) }).parse(input))
  .handler(async ({ data }) => {
    const source = videoSource(data.url);
    if (source?.kind !== "hudl") return { embed: null, watch: null };
    let watch = source.url;
    try {
      if (new URL(watch).pathname.startsWith("/v/")) {
        const response = await fetch(watch, { redirect: "manual", signal: AbortSignal.timeout(7000) });
        const location = response.headers.get("location");
        if (!location) return { embed: null, watch };
        const resolved = new URL(location, "https://www.hudl.com");
        if (resolved.hostname !== "www.hudl.com") return { embed: null, watch };
        watch = `${resolved.origin}${resolved.pathname}`;
      }
      const path = new URL(watch).pathname.match(/^\/video\/(\d+\/\d+\/[A-Za-z0-9_-]+)\/?$/)?.[1];
      if (!path) return { embed: null, watch };
      const embed = `https://www.hudl.com/embed/video/${path}`;
      const response = await fetch(embed, { signal: AbortSignal.timeout(7000) });
      if (!response.ok) return { embed: null, watch };
      const html = await response.text();
      if (/couldn(?:&#x27;|&#39;|’|')t find that video|video not found|this video is private/i.test(html)) return { embed: null, watch };
      return { embed, watch };
    } catch {
      return { embed: null, watch };
    }
  });