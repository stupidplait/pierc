import type { EquippedMap } from "./types";

// URL state shape for /catalog:
//   ?anchor=<slug>            -> selected anchor
//   ?eq=<slug>:<jewId>,<slug>:<jewId>   -> equipped pieces
//   ?view=grid                -> force the WebGL fallback (2D list)

const EQ_PAIR = /^([a-z0-9-]+):([a-zA-Z0-9-]+)$/;

export function parseEquippedFromUrl(
  raw: string | undefined,
  anchorSlugToId: Map<string, string>,
): EquippedMap {
  if (!raw) return {};
  const out: EquippedMap = {};
  for (const part of raw.split(",")) {
    const m = part.trim().match(EQ_PAIR);
    if (!m) continue;
    const [, slug, jewelryId] = m;
    const anchorId = anchorSlugToId.get(slug);
    if (!anchorId) continue;
    out[anchorId] = jewelryId;
  }
  return out;
}

export function serializeEquipped(
  equipped: EquippedMap,
  anchorIdToSlug: Map<string, string>,
): string {
  const pairs: string[] = [];
  for (const [anchorId, jewelryId] of Object.entries(equipped)) {
    const slug = anchorIdToSlug.get(anchorId);
    if (!slug) continue;
    pairs.push(`${slug}:${jewelryId}`);
  }
  return pairs.join(",");
}
