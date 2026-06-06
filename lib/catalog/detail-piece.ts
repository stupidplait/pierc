import type { AnchorWire, JewelryWire } from "./types";
import type { DetailPiece } from "@/components/catalog/detail/parts";
import { buildSpecs } from "./build-detail";
import { formatPrice } from "@/lib/jewelry/format";

/** The view-ready piece shape the detail atoms render. Re-exported so callers
 *  can type a built piece without reaching into the components layer. */
export type DetailLike = DetailPiece;

/**
 * Flatten a showroom {@link JewelryWire} (+ the anchor list, for chip names)
 * into the {@link DetailPiece} the detail atoms render. Mirrors the server
 * detail page client-side so the inspect overlay AND the in-rail detail build
 * identical pieces from the data already in memory.
 */
export function toDetailPiece(
  j: JewelryWire,
  anchors: AnchorWire[],
): DetailPiece {
  const nameById = new Map(anchors.map((a) => [a.id, a.name]));
  const seen = new Set<string>();
  const anchorChips: DetailPiece["anchorChips"] = [];
  for (const id of j.anchorIds) {
    const name = nameById.get(id);
    if (name && !seen.has(id)) {
      seen.add(id);
      anchorChips.push({ id, name });
    }
  }
  return {
    id: j.id,
    name: j.name,
    priceLabel: formatPrice(j.price),
    categoryName: j.categoryName,
    description: j.description,
    photos: j.photo ? [{ url: j.photo, alt: j.name }] : [],
    glbUrl: j.glbUrl,
    specs: buildSpecs({
      material: j.material,
      gauge: j.gauge,
      size: j.size,
      color: j.color,
      stones: j.stones,
      inStock: j.inStock,
    }),
    anchorChips,
    primaryAnchorId: j.anchorBindings[0]?.anchorId ?? null,
    tryOnHref: null,
    outOfStock: j.inStock <= 0,
  };
}
