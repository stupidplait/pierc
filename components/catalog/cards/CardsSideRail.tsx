"use client";

import { useState } from "react";
import { AnimatePresence, m, useDragControls, useReducedMotion } from "framer-motion";
import { GripHorizontal, Search } from "lucide-react";
import { catalogStrings } from "@/lib/i18n/ru";
import { useLenisScroll } from "@/lib/catalog/use-lenis-scroll";
import {
  ct,
  useCatalogModel,
  type CatalogViewProps,
} from "../views/parts";
import { RailDetail } from "./RailDetail";
import { CatalogTray, renderSlot } from "./shared";

// Collapsed / expanded panel widths (px). Expanding to the detail "card page"
// widens the panel a touch rather than opening a separate modal.
const WIDTH_GRID = 352;
const WIDTH_DETAIL = 432;

/**
 * Inventory side-rail — a floating, draggable RPG-bag panel. Grab the top
 * handle to reposition it (clamped to the viewport). Pieces-only grid with a
 * search; clicking a piece EXPANDS the panel in place into the "card page"
 * ({@link RailDetail}) with a smooth width + crossfade, instead of a separate
 * modal. Place selection lives outside the rail (zone bar / map) except the
 * `dropdown` variant, which renders a compact zone control in this header.
 */
export function CardsSideRail({
  constraintsRef,
  ...props
}: CatalogViewProps & {
  constraintsRef: React.RefObject<HTMLDivElement | null>;
}) {
  const {
    selectedAnchorId,
    onUnequip,
    canBook,
    onBook,
    jewelry,
    anchors,
    user = null,
    detail = "overlay",
    cardview = "gallery",
    loader = "spinner",
    inspectId = null,
    onInspectClose,
    onInspectEquip,
  } = props;
  const {
    filtered,
    equippedItems,
    trayCount,
    limitReached,
    equippedAtActive,
  } = useCatalogModel(props);
  const dragControls = useDragControls();
  const gridWheelRef = useLenisScroll();
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");

  // Search filters the zone's pieces by name (case-insensitive).
  const q = query.trim().toLowerCase();
  const visible = q
    ? filtered.filter((j) => j.name.toLowerCase().includes(q))
    : filtered;

  const inspectPiece = inspectId
    ? (jewelry.find((j) => j.id === inspectId) ?? null)
    : null;
  const detailOpen = inspectPiece !== null;

  // Grid ↔ card-page transition: a simple blur-in / blur-out crossfade.
  // mode="wait" swaps one panel at a time, so the grid blurs away as the card
  // page blurs in (and vice-versa). Skipped under reduced motion.
  const tx = reduce
    ? {}
    : {
        initial: { opacity: 0, filter: "blur(12px)" },
        animate: { opacity: 1, filter: "blur(0px)" },
        exit: { opacity: 0, filter: "blur(12px)" },
        transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const },
      };

  return (
    <m.aside
      drag
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={constraintsRef}
      dragElastic={0.05}
      dragTransition={{ power: 0.18, timeConstant: 200 }}
      initial={false}
      animate={{ width: detailOpen ? WIDTH_DETAIL : WIDTH_GRID }}
      transition={{ duration: reduce ? 0 : 0.32, ease: [0.16, 1, 0.3, 1] }}
      className="pointer-events-auto absolute right-4 top-24 z-20 flex max-h-[calc(100svh-9rem)] flex-col overflow-hidden rounded-2xl border border-line bg-bg-elev/80 shadow-2xl backdrop-blur-xl"
    >
      {/* Drag handle — grab anywhere on this bar to move the panel. */}
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="flex shrink-0 cursor-grab touch-none select-none items-center justify-between gap-2 border-b border-line px-4 py-2.5 active:cursor-grabbing"
      >
        <GripHorizontal className="size-4 text-mute" />
        {!detailOpen ? (
          <span className="font-mono text-xs text-mute">
            {visible.length} {ct.pieces}
          </span>
        ) : null}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <AnimatePresence mode="wait" initial={false}>
          {detailOpen ? (
            <m.div key="detail" className="flex min-h-0 flex-1 flex-col" {...tx}>
              <RailDetail
                piece={inspectPiece}
                anchors={anchors}
                user={user}
                detail={detail}
                view={cardview}
                loader={loader}
                onClose={() => onInspectClose?.()}
                onEquip={(id) => onInspectEquip?.(id)}
              />
            </m.div>
          ) : (
            <m.div key="grid" className="flex min-h-0 flex-1 flex-col" {...tx}>
              {/* Search */}
              <div className="shrink-0 border-b border-line px-4 py-3">
                <div className="flex items-center gap-2 rounded-lg border border-line bg-bg/40 px-2.5 focus-within:border-ink/35">
                  <Search className="size-4 shrink-0 text-mute" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={ct.search}
                    className="w-full bg-transparent py-2 text-sm text-ink placeholder:text-mute focus:outline-none"
                  />
                </div>
              </div>

              <div
                ref={gridWheelRef}
                className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-4"
                data-lenis-prevent
              >
                {visible.length === 0 ? (
                  <p className="py-10 text-center text-sm text-mute">
                    {q
                      ? ct.searchEmpty
                      : selectedAnchorId
                        ? ct.listEmpty
                        : catalogStrings.empty}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {visible.map((j) =>
                      renderSlot(j, {
                        selectedAnchorId,
                        onEquip: props.onEquip,
                        onUnequip,
                        onInspect: props.onInspect,
                        equippedAtActive,
                        limitReached,
                      }),
                    )}
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-line p-4">
                <CatalogTray
                  equippedItems={equippedItems}
                  trayCount={trayCount}
                  limitReached={limitReached}
                  canBook={canBook}
                  onBook={onBook}
                  onUnequip={onUnequip}
                />
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </m.aside>
  );
}
