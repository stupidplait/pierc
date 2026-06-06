"use client";

import { Crosshair } from "lucide-react";
import {
  ct,
  useCatalogModel,
  type CatalogViewProps,
} from "../views/parts";
import { CatalogTray, renderSlot } from "./shared";

// How many pieces fan out on the arc at once.
const ARC_MAX = 7;
// Arc geometry (px): radius from the hub, half-spread in radians.
const ARC_RADIUS = 270;
const ARC_HALF = (74 * Math.PI) / 180;

/**
 * Radial wheel — a weapon-wheel of pieces that fans above a hub. Anchor
 * selection happens by clicking the dots in the 3D scene (or the "show all"
 * toggle); the wheel then shows the compatible pieces as a quick-equip arc.
 * Best for the focused set of a selected anchor; caps at {@link ARC_MAX} with
 * a "+N" affordance so a large "show all" set stays legible.
 */
export function CardsRadial(props: CatalogViewProps) {
  const { selectedAnchorId, onSelectAnchor, onUnequip, canBook, onBook } = props;
  const {
    filtered,
    equippedItems,
    selectedAnchor,
    trayCount,
    limitReached,
    equippedAtActive,
  } = useCatalogModel(props);

  const shown = filtered.slice(0, ARC_MAX);
  const overflow = filtered.length - shown.length;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center px-4 pb-5">
      {/* Arc of pieces */}
      <div className="pointer-events-none relative h-84 w-full max-w-3xl">
        {shown.map((j, i) => {
          // Spread the items across the arc; centre a lone item.
          const t = shown.length === 1 ? 0.5 : i / (shown.length - 1);
          const angle = -ARC_HALF + t * (ARC_HALF * 2);
          const x = Math.sin(angle) * ARC_RADIUS;
          const y = -Math.cos(angle) * ARC_RADIUS;
          return (
            <div
              key={j.id}
              className="pointer-events-auto absolute left-1/2 bottom-0"
              style={{ transform: `translate(calc(-50% + ${x}px), ${y}px)` }}
            >
              {renderSlot(j, {
                selectedAnchorId,
                onEquip: props.onEquip,
                onUnequip,
                onInspect: props.onInspect,
                equippedAtActive,
                limitReached,
                sizeClass: "w-28",
              })}
            </div>
          );
        })}
      </div>

      {/* Hub */}
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-line bg-bg-elev/85 px-4 py-2 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => onSelectAnchor(null)}
          className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink"
          title={ct.anchorAll}
        >
          <Crosshair className="size-4 text-accent" />
          {selectedAnchor ? selectedAnchor.name : ct.anchorAll}
        </button>
        {overflow > 0 ? (
          <span className="rounded-full bg-bg/60 px-2 py-0.5 font-mono text-[10px] text-mute">
            +{overflow}
          </span>
        ) : null}
        <span className="h-5 w-px bg-line" />
        <CatalogTray
          equippedItems={equippedItems}
          trayCount={trayCount}
          limitReached={limitReached}
          canBook={canBook}
          onBook={onBook}
          onUnequip={onUnequip}
        />
      </div>

      {!selectedAnchorId ? (
        <p className="pointer-events-none mt-2 text-center font-mono text-[11px] text-mute">
          {ct.listAnchorPrompt}
        </p>
      ) : null}
    </div>
  );
}
