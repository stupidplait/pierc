import type { Decimal } from "@prisma/client/runtime/library";

// ─── Price formatting ─────────────────────────────────────────────────────

const rubleFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export function formatPrice(price: Decimal | number | string): string {
  const n =
    typeof price === "number"
      ? price
      : typeof price === "string"
        ? Number(price)
        : Number(price.toString());
  return rubleFormatter.format(Number.isFinite(n) ? n : 0);
}

// ─── Photo array shape (the JSON column on Jewelry) ───────────────────────

export interface JewelryPhoto {
  url: string;
  alt: string;
  /** Opt-in flag: include this shot as an input to 3D auto-generation. */
  gen?: boolean;
}

/**
 * Robustly coerce the JSON `photos` column into a JewelryPhoto[].
 * Tolerates missing fields and unknown extras so historical rows don't break.
 */
export function asPhotos(photos: unknown): JewelryPhoto[] {
  if (!Array.isArray(photos)) return [];
  const out: JewelryPhoto[] = [];
  for (const p of photos) {
    if (!p || typeof p !== "object") continue;
    const candidate = p as { url?: unknown; alt?: unknown; gen?: unknown };
    if (typeof candidate.url !== "string" || candidate.url.length === 0)
      continue;
    out.push({
      url: candidate.url,
      alt: typeof candidate.alt === "string" ? candidate.alt : "",
      // Only carry the flag when truthy so untouched rows stay lean.
      ...(candidate.gen === true ? { gen: true } : {}),
    });
  }
  return out;
}

export function firstPhotoUrl(photos: unknown): string | null {
  const list = asPhotos(photos);
  return list[0]?.url ?? null;
}

/**
 * URLs of the photos flagged for 3D generation. If none are flagged, falls back
 * to the cover (first) photo so a piece with photos can always generate.
 */
export function genPhotoUrls(photos: unknown): string[] {
  const list = asPhotos(photos);
  const flagged = list.filter((p) => p.gen).map((p) => p.url);
  if (flagged.length > 0) return flagged;
  return list[0] ? [list[0].url] : [];
}
