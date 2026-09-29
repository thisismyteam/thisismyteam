/** Browser-only helpers: dominant colour extraction + contrast maths. */

function toHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string) {
  const [r = 0, g = 0, b = 0] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Readable text colour (near-black or near-white) on top of a given colour. */
export function onColor(hex: string) {
  return luminance(hex) > 0.45 ? "#101014" : "#ffffff";
}

export function isValidHex(value: string) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

/**
 * Pull the two most prominent colours out of an image file by quantising
 * pixels into coarse buckets and ranking by frequency + saturation.
 */
export async function extractPalette(file: File | Blob): Promise<[string, string]> {
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that image."));
      el.src = bitmapUrl;
    });

    const size = 96;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return ["#0B0B0F", "#E9E9EF"];
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] ?? 0;
      if (a < 128) continue;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
      const entry = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
      entry.count += 1;
      entry.r += r;
      entry.g += g;
      entry.b += b;
      buckets.set(key, entry);
    }

    const scored = [...buckets.values()]
      .map((e) => {
        const r = Math.round(e.r / e.count);
        const g = Math.round(e.g / e.count);
        const b = Math.round(e.b / e.count);
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const sat = max === 0 ? 0 : (max - min) / max;
        const isNearWhite = min > 232;
        const weight = e.count * (0.35 + sat) * (isNearWhite ? 0.15 : 1);
        return { hex: toHex(r, g, b), r, g, b, weight };
      })
      .sort((a, b) => b.weight - a.weight);

    if (scored.length === 0) return ["#0B0B0F", "#E9E9EF"];

    const primary = scored[0]!;
    const second =
      scored.find((c) => {
        const dist =
          Math.abs(c.r - primary.r) + Math.abs(c.g - primary.g) + Math.abs(c.b - primary.b);
        return dist > 140;
      }) ?? scored[Math.min(1, scored.length - 1)]!;

    return [primary.hex, second.hex === primary.hex ? "#E9E9EF" : second.hex];
  } catch {
    return ["#0B0B0F", "#E9E9EF"];
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}
