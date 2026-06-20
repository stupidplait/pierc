import { catalogStrings } from "@/lib/i18n/ru";
import type { DetailSpec } from "@/components/catalog/detail/parts";

/** The piece attributes a spec ledger is built from — the subset of the
 *  `Jewelry` scalars that render as label/value rows. Shared so the server
 *  detail page and the client inspect overlay produce identical ledgers. */
export interface SpecSource {
  material: string | null;
  gauge: number | null;
  size: number | null;
  color: string | null;
  stones: string | null;
  inStock: number;
}

/**
 * Build the spec ledger rows for a piece — only rows that have a value, plus
 * an always-present stock row. Single source of truth for both the standalone
 * detail page ([id]/page.tsx) and the in-catalog DetailModal.
 */
export function buildSpecs(src: SpecSource): DetailSpec[] {
  const attrs = catalogStrings.attributes;
  const units = catalogStrings.units;
  const specs: DetailSpec[] = [];
  if (src.material) specs.push({ label: attrs.material, value: src.material });
  if (src.gauge != null)
    specs.push({ label: attrs.gauge, value: `${src.gauge} ${units.mm}` });
  if (src.size != null)
    specs.push({ label: attrs.size, value: `${src.size} ${units.mm}` });
  if (src.color) specs.push({ label: attrs.color, value: src.color });
  if (src.stones) specs.push({ label: attrs.stones, value: src.stones });
  specs.push({
    label: attrs.inStock,
    value:
      src.inStock <= 0
        ? catalogStrings.outOfStock
        : `${src.inStock} ${units.pcs}`,
  });
  return specs;
}
