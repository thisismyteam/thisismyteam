export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export function validateVideo(file: File) {
  if (file.size > MAX_VIDEO_BYTES) throw new Error("Video must be 100MB or smaller.");
  if (!/\.(mp4|mov)$/i.test(file.name) || !["video/mp4", "video/quicktime", ""].includes(file.type))
    throw new Error("Choose an MP4 or MOV video.");
}

export function videoSource(url: string): { kind: "file" | "embed" | "hudl"; url: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && /^(www\.)?hudl\.com$/i.test(parsed.hostname))) return null;
    const host = parsed.hostname.toLowerCase();
    if (host === "youtu.be" || host === "www.youtube.com" || host === "youtube.com" || host === "m.youtube.com") {
      const id = host === "youtu.be" ? parsed.pathname.slice(1) : parsed.pathname.startsWith("/shorts/") ? parsed.pathname.split("/")[2] : parsed.searchParams.get("v");
      if (!id || !/^[\w-]{11}$/.test(id)) return null;
      return { kind: "embed", url: `https://www.youtube-nocookie.com/embed/${id}` };
    }
    if (host === "www.hudl.com" || host === "hudl.com") {
      const path = parsed.pathname;
      if (!/^\/(?:v\/[A-Za-z0-9_-]+|(?:embed\/)?video\/\d+\/\d+\/[A-Za-z0-9_-]+)\/?$/.test(path)) return null;
      return { kind: "hudl", url: `https://www.hudl.com${path.replace(/^\/embed/, "")}` };
    }
    // Direct files are only supported from our team's private media bucket.
    if (parsed.pathname.includes("/storage/v1/object/sign/team-videos/") && /\.(mp4|mov|webm)$/i.test(parsed.pathname))
      return { kind: "file", url };
  } catch { return null; }
  return null;
}
