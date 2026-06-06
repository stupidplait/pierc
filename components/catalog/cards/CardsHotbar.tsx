"use client";

import { catalogStrings } from "@/lib/i18n/ru";
import {
  ct,
  useCatalogModel,
  type CatalogViewProps,
} from "../views/parts";
import { AnchorChipRail, CatalogTray, renderSlot } from "./shared";

/**
 * Loadout hotbar — a bottom-center game action-bar. Anchor filter + tray on the
 * top row, a horizontal snap-scroll filmstrip of slots below. Minimal chrome so
 * the 3D stage dominates. (The gamier descendant of the original console dock.)
 */
export function CardsHotbar(props: CatalogViewProps) {
  const { selectedAnchorId, onSelectAnchor, onUnequip, canBook, onBook } = props;
  const {
    grouped,
    filtered,
    equippedItems,
    selectedAnchor,
    trayCount,
    limitReached,
    equippedAtActive,
  } = useCatalogModel(props);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-3 sm:px-5 sm:pb-4">
      <div className="pointer-events-auto mx-auto flex max-w-6xl flex-col gap-3 rounded-2xl border border-line bg-bg-elev/80 p-4 shadow-elev-up backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4">
          <AnchorChipRail
            grouped={grouped}
            selectedAnchorId={selectedAnchorId}
            onSelectAnchor={onSelectAnchor}
          />
          <CatalogTray
            equippedItems={equippedItems}
            trayCount={trayCount}
            limitReached={limitReached}
            canBook={canBook}
            onBook={onBook}
            onUnequip={onUnequip}
          />
        </div>

        <div className="h-px bg-line" />

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink">
              {selectedAnchor ? selectedAnchor.name : ct.anchorAll}
            </p>
            <span className="font-mono text-xs text-mute">
              {filtered.length} {ct.pieces}
            </span>
          </div>

          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-mute">
              {selectedAnchorId ? ct.listEmpty : catalogStrings.empty}
            </p>
          ) : (
            <div className="-mx-1 flex snap-x items-stretch gap-3 overflow-x-auto px-1 pb-1">
              {filtered.map((j) =>
                renderSlot(j, {
                  selectedAnchorId,
                  onEquip: props.onEquip,
                  onUnequip,
                  onInspect: props.onInspect,
                  equippedAtActive,
                  limitReached,
                  sizeClass: "w-40 shrink-0 snap-start",
                }),
              )}
            </div>
          )}

          {!selectedAnchorId ? (
            <p className="text-center font-mono text-[11px] text-mute">
              {ct.listAnchorPrompt}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
