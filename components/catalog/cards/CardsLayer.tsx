"use client";

import { useIsDesktop } from "@/lib/catalog/use-is-desktop";
import type { CardsVariant } from "@/lib/catalog/lab-state";
import type { CatalogViewProps } from "../views/parts";
import { CardsHotbar } from "./CardsHotbar";
import { CardsSideRail } from "./CardsSideRail";
import { CardsRadial } from "./CardsRadial";
import { CardsSheet } from "./CardsSheet";

/**
 * Dispatches the active card-placement variant. The full-bleed 3D stage sits
 * behind this layer; each variant positions itself over it. The right-rail and
 * radial wheel need horizontal room, so below `lg` they fall back to the hotbar
 * (which collapses cleanly to a phone-width bottom bar).
 */
export function CardsLayer({
  cards,
  constraintsRef,
  ...props
}: CatalogViewProps & {
  cards: CardsVariant;
  constraintsRef: React.RefObject<HTMLDivElement | null>;
}) {
  const isDesktop = useIsDesktop();

  if ((cards === "rail" || cards === "radial") && !isDesktop) {
    return <CardsHotbar {...props} />;
  }

  switch (cards) {
    case "rail":
      return <CardsSideRail {...props} constraintsRef={constraintsRef} />;
    case "radial":
      return <CardsRadial {...props} />;
    case "sheet":
      return <CardsSheet {...props} />;
    default:
      return <CardsHotbar {...props} />;
  }
}
