"use client";

import { useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { ChevronUp } from "lucide-react";
import { catalogStrings } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";
import {
  ct,
  useCatalogModel,
  type CatalogViewProps,
} from "../views/parts";
import { AnchorChipRail, CatalogTray, renderSlot } from "./shared";

/**
 * Loadout hotbar — a bottom-center game action-bar (phone widths). A compact
 * header (collapse toggle · active zone + count · equipped tray) is always
 * visible; the anchor filter and the snap-scroll filmstrip of slots live in a
 * collapsible body so the player can fold the bar away and free the 3D stage —
 * the expanded bar otherwise covers the lower body dots. The gamier descendant
 * of the original console dock.
 */
export function Hotbar(props: CatalogViewProps) {
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
  const [collapsed, setCollapsed] = useState(false);
  const reduce = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-5 sm:pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto mx-auto flex max-w-3xl flex-col rounded-2xl border border-line bg-bg-elev/80 shadow-elev-up backdrop-blur-xl">
        {/* Header — always visible. */}
        <div className="flex items-center gap-3 p-3">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? ct.expand : ct.collapse}
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-bg/40 text-mute transition-colors hover:text-ink active:scale-95"
          >
            <ChevronUp
              className={cn(
                "size-4 transition-transform",
                collapsed && "rotate-180",
              )}
            />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[11px] uppercase tracking-[0.16em] text-ink">
              {selectedAnchor ? selectedAnchor.name : ct.anchorAll}
            </p>
            <p className="font-mono text-[11px] text-mute">
              {filtered.length} {ct.pieces}
            </p>
          </div>

          <CatalogTray
            equippedItems={equippedItems}
            trayCount={trayCount}
            limitReached={limitReached}
            canBook={canBook}
            onBook={onBook}
            onUnequip={onUnequip}
          />
        </div>

        {/* Collapsible body — anchor filter + slot filmstrip. */}
        <AnimatePresence initial={false}>
          {!collapsed ? (
            <m.div
              key="body"
              initial={reduce ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-2.5 border-t border-line p-3">
                {/* Anchors get their own full-width row so the chips aren't
                    squeezed against the tray. */}
                <AnchorChipRail
                  grouped={grouped}
                  selectedAnchorId={selectedAnchorId}
                  onSelectAnchor={onSelectAnchor}
                />

                {filtered.length === 0 ? (
                  <p className="py-6 text-center text-sm text-mute">
                    {selectedAnchorId ? ct.listEmpty : catalogStrings.empty}
                  </p>
                ) : (
                  <div className="scroll-fade-x -mx-1 flex snap-x items-stretch gap-3 overflow-x-auto px-1 pb-1">
                    {filtered.map((j) =>
                      renderSlot(j, {
                        selectedAnchorId,
                        onEquip: props.onEquip,
                        onUnequip,
                        onInspect: props.onInspect,
                        equippedAtActive,
                        limitReached,
                        sizeClass: "w-36 shrink-0 snap-start",
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
            </m.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
