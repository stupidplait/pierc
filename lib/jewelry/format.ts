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
    const candidate = p as { url?: unknown; alt?: unknown };
    if (typeof candidate.url !== "string" || candidate.url.length === 0) continue;
    out.push({
      url: candidate.url,
      alt: typeof candidate.alt === "string" ? candidate.alt : "",
    });
  }
  return out;
}

export function firstPhotoUrl(photos: unknown): string | null {
  const list = asPhotos(photos);
  return list[0]?.url ?? null;
}
