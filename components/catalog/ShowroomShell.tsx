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

  // Bounds the draggable side-rail. Inset below the fixed site header (see the
  // bounds div) so the rail — grabbable only by its top handle — can never be
  // parked behind the header, where the handle would be unreachable and the
  // panel would be stuck.
  const dragBoundsRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative h-full w-full overflow-hidden">
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

      {/* Drag field for the inventory rail — inset below the fixed site header
          so the panel can never be dragged into the band behind it (where its
          only grab handle would sit under the header and stop responding).
          pointer-events-none so it never intercepts clicks on the 3D scene. */}
      <div
        ref={dragBoundsRef}
        aria-hidden
        className="pointer-events-none absolute inset-x-4 bottom-4 top-24"
      />

      <InventoryLayer cards={cards} constraintsRef={dragBoundsRef} {...props} />
    </div>
  );
}
