"use client";

import { useIsDesktop } from "@/lib/catalog/use-is-desktop";
import type { CardsVariant } from "@/lib/catalog/lab-state";
import type { CatalogViewProps } from "../views/parts";
import { Hotbar } from "./Hotbar";
import { InventoryRail } from "./InventoryRail";

/**
 * Dispatches the active card-placement variant. The full-bleed 3D stage sits
 * behind this layer; each variant positions itself over it. The right-rail and
 * radial wheel need horizontal room, so below `lg` they fall back to the hotbar
 * (which collapses cleanly to a phone-width bottom bar).
 */
export function InventoryLayer({
  cards,
  constraintsRef,
  ...props
}: CatalogViewProps & {
  cards: CardsVariant;
  constraintsRef: React.RefObject<HTMLDivElement | null>;
}) {
  const isDesktop = useIsDesktop();

  // Locked design (cards = "rail"): the side-rail on desktop, the hotbar on phone
  // widths. The radial/sheet placement variants from the design lab were removed.
  if (cards === "rail" && isDesktop) {
    return <InventoryRail {...props} constraintsRef={constraintsRef} />;
  }
  return <Hotbar {...props} />;
}
