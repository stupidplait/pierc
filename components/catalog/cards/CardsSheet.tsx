"use client";

import { useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { LayoutGrid, X } from "lucide-react";
import { catalogStrings } from "@/lib/i18n/ru";
import {
  ct,
  useCatalogModel,
  type CatalogViewProps,
} from "../views/parts";
import { AnchorChipRail, CatalogTray, renderSlot } from "./shared";

/**
 * Fullscreen inventory — keeps the 3D stage completely unobstructed behind a
 * minimal control cluster (open-inventory button + equipped tray). Pressing
 * "Каталог" opens a fullscreen gaming grid (like opening your bag) to browse
 * and equip; picking a piece keeps the sheet open so several can be equipped.
 */
export function CardsSheet(props: CatalogViewProps) {
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
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  // Inspecting closes the sheet so the inspect overlay isn't buried under it.
  const onInspect = props.onInspect
    ? (id: string) => {
        setOpen(false);
        props.onInspect!(id);
      }
    : undefined;

  return (
    <>
      {/* Minimal control cluster — bottom center. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-4 pb-4 sm:px-6 sm:pb-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-line bg-bg-elev/80 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.16em] text-ink shadow-lg backdrop-blur-xl transition-colors hover:border-accent hover:text-accent"
        >
          <LayoutGrid className="size-4" />
          {ct.inventory}
        </button>
        <div className="pointer-events-auto rounded-full border border-line bg-bg-elev/80 px-3 py-2 backdrop-blur-xl">
          <CatalogTray
            equippedItems={equippedItems}
            trayCount={trayCount}
            limitReached={limitReached}
            canBook={canBook}
            onBook={onBook}
            onUnequip={onUnequip}
          />
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <m.div
            className="absolute inset-0 z-30 flex flex-col bg-bg/85 backdrop-blur-xl"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between gap-4 border-b border-line p-4 sm:px-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink">
                {ct.inventory}
                <span className="ml-3 text-mute">
                  {filtered.length} {ct.pieces}
                </span>
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-mute transition-colors hover:text-ink"
              >
                {ct.inventoryClose}
                <X className="size-4" />
              </button>
            </div>

            <div className="border-b border-line px-4 py-3 sm:px-6">
              <AnchorChipRail
                grouped={grouped}
                selectedAnchorId={selectedAnchorId}
                onSelectAnchor={onSelectAnchor}
              />
              <p className="mt-1 font-display text-sm text-ink">
                {selectedAnchor ? selectedAnchor.name : ct.anchorAll}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {filtered.length === 0 ? (
                <p className="py-16 text-center text-sm text-mute">
                  {selectedAnchorId ? ct.listEmpty : catalogStrings.empty}
                </p>
              ) : (
                <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                  {filtered.map((j) =>
                    renderSlot(j, {
                      selectedAnchorId,
                      onEquip: props.onEquip,
                      onUnequip,
                      onInspect,
                      equippedAtActive,
                      limitReached,
                    }),
                  )}
                </div>
              )}
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
