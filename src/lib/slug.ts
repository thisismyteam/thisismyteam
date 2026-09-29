export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const RESERVED = new Set([
  "auth",
  "admin",
  "dashboard",
  "start",
  "api",
  "login",
  "signup",
  "about",
  "pricing",
  "teams",
  "team",
  "settings",
  "oauth",
]);

export function isReservedSlug(slug: string) {
  return RESERVED.has(slug);
}
