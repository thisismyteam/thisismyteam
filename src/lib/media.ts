export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export function validateVideo(file: File) {
  if (file.size > MAX_VIDEO_BYTES) throw new Error("Video must be 100MB or smaller.");
  if (!/\.(mp4|mov)$/i.test(file.name) || !["video/mp4", "video/quicktime", ""].includes(file.type))
    throw new Error("Choose an MP4 or MOV video.");
}

export function videoSource(url: string): { kind: "file" | "embed"; url: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    const host = parsed.hostname.toLowerCase();
    if (host === "youtu.be" || host === "www.youtube.com" || host === "youtube.com" || host === "m.youtube.com") {
      const id = host === "youtu.be" ? parsed.pathname.slice(1) : parsed.pathname.startsWith("/shorts/") ? parsed.pathname.split("/")[2] : parsed.searchParams.get("v");
      if (!id || !/^[\w-]{11}$/.test(id)) return null;
      return { kind: "embed", url: `https://www.youtube-nocookie.com/embed/${id}` };
    }
    if (host === "www.hudl.com" || host === "hudl.com") {
      // Hudl's share pages expose a player at /embed/video/<id>; never embed arbitrary URLs.
      const id = parsed.pathname.match(/^\/(?:video\/\d+\/|embed\/video\/)([a-zA-Z0-9_-]+)/)?.[1];
      if (!id) return null;
      return { kind: "embed", url: `https://www.hudl.com/embed/video/${id}` };
    }
    if (/\.(mp4|mov|webm)$/i.test(parsed.pathname) || parsed.pathname.includes("/storage/v1/object/sign/team-videos/"))
      return { kind: "file", url };
  } catch { return null; }
  return null;
}
