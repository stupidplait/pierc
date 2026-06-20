"use client";

import { useRef } from "react";
import { ShowroomStage } from "./scene/LazyStage";
import { InventoryLayer } from "./inventory/InventoryLayer";
import { PlaceBar } from "./place/PlaceBar";
import type { CatalogViewProps } from "./views/parts";
import type { CardsVariant } from "@/lib/catalog/lab-state";

/**
 * ShowroomShell — the showroom surface: a single full-bleed 3D <ShowroomStage>
 * with the inventory side-rail and the floating zone bar composited over it.
 * One WebGL canvas on all breakpoints — the stage is responsive and the card
 * layer collapses to a hotbar on phones.
 */
export function ShowroomShell({
  cards,
  ...props
}: CatalogViewProps & { cards: CardsVariant }) {
  const {
    anchors,
    jewelry,
    selectedAnchorId,
    equipped,
    onSelectAnchor,
    env = "dais",
    hud = "full",
    bg = "glow",
    dots = "ring",
    loader = "spinner",
  } = props;

  // Constrains the draggable side-rail so it can't be flung off-screen.
  const shellRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={shellRef} className="relative h-full w-full overflow-hidden">
      <ShowroomStage
        anchors={anchors}
        jewelry={jewelry}
        selectedId={selectedAnchorId}
        equipped={equipped}
        onSelectAnchor={onSelectAnchor}
        env={env}
        hud={hud}
        bg={bg}
        dots={dots}
        loader={loader}
      />

      <PlaceBar
        anchors={anchors}
        selectedAnchorId={selectedAnchorId}
        onSelectAnchor={onSelectAnchor}
      />

      <InventoryLayer cards={cards} constraintsRef={shellRef} {...props} />
    </div>
  );
}
