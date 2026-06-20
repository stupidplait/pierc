"use client";

import type { AnchorWire, BodyPlace, JewelryWire } from "@/lib/catalog/types";
import { bodyPlaceLabels, bodyPlaceOrder } from "@/lib/i18n/ru";
import {
  ct,
  Thumb,
  BookButton,
  TrayCountBadge,
  pieceState,
  type CatalogViewProps,
} from "../views/parts";
import { SlotCard } from "./SlotCard";
import { cn } from "@/lib/utils";

/**
 * Shared building blocks for the gaming card layouts (hotbar / rail / radial /
 * sheet). Each layout composes these so the anchor filter, equipped tray and
 * "render a piece" logic stay identical across variants.
 */

/** Group anchors by body place, preserving the canonical place order and
 *  dropping empty places. Shared by the place-selection variants. */
export function groupAnchorsByPlace(
  anchors: AnchorWire[],
): Array<{ place: BodyPlace; label: string; anchors: AnchorWire[] }> {
  const byPlace = {} as Record<BodyPlace, AnchorWire[]>;
  for (const place of bodyPlaceOrder) byPlace[place] = [];
  for (const a of anchors) byPlace[a.place]?.push(a);
  return bodyPlaceOrder
    .filter((place) => byPlace[place].length > 0)
    .map((place) => ({
      place,
      label: bodyPlaceLabels[place],
      anchors: byPlace[place],
    }));
}

/** Horizontal anchor filter — "show all" + per-place groups of chips. */
export function AnchorChipRail({
  grouped,
  selectedAnchorId,
  onSelectAnchor,
}: {
  grouped: Record<string, AnchorWire[]>;
  selectedAnchorId: string | null;
  onSelectAnchor: (id: string | null) => void;
}) {
  return (
    <div className="-mx-1 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-1 pb-1">
      <Chip active={!selectedAnchorId} onClick={() => onSelectAnchor(null)}>
        {ct.anchorAll}
      </Chip>
      {bodyPlaceOrder.map((place) =>
        grouped[place]?.length ? (
          <div key={place} className="flex items-center gap-2">
            <span className="ml-1 shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
              {bodyPlaceLabels[place]}
            </span>
            {grouped[place].map((a) => (
              <Chip
                key={a.id}
                active={selectedAnchorId === a.id}
                onClick={() => onSelectAnchor(a.id)}
              >
                {a.name}
              </Chip>
            ))}
          </div>
        ) : null,
      )}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-[13px] transition-colors",
        active
          ? "border-accent/40 bg-accent/15 text-accent"
          : "border-line bg-bg/40 text-mute hover:border-ink/35 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/** Equipped-pieces tray: count badge + overlapping thumbs + book CTA. */
export function CatalogTray({
  equippedItems,
  trayCount,
  limitReached,
  canBook,
  onBook,
  onUnequip,
}: {
  equippedItems: Array<{ anchor: AnchorWire; item: JewelryWire }>;
  trayCount: number;
  limitReached: boolean;
  canBook?: boolean;
  onBook?: () => void;
  onUnequip: (anchorId: string) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <div className="flex items-center gap-2">
        <TrayCountBadge count={trayCount} limitReached={limitReached} />
        <div className="flex -space-x-2">
          {equippedItems.slice(0, 4).map(({ anchor, item }) => (
            <button
              type="button"
              key={anchor.id}
              onClick={() => onUnequip(anchor.id)}
              title={`${item.name} — ${ct.unequip}`}
              className="ring-2 ring-bg-elev transition-transform hover:z-10 hover:scale-110"
            >
              <Thumb
                url={item.photo}
                alt={item.name}
                className="size-9 rounded-full"
                sizes="36px"
              />
            </button>
          ))}
        </div>
      </div>
      {onBook && canBook ? (
        <BookButton canBook={canBook} onBook={onBook} className="w-auto px-5" />
      ) : null}
    </div>
  );
}

/**
 * Render one filtered piece as a SlotCard, wiring equip eligibility from the
 * shared `pieceState`. `sizeClass` lets each layout control the slot footprint.
 */
export function renderSlot(
  j: JewelryWire,
  props: Pick<
    CatalogViewProps,
    "selectedAnchorId" | "onEquip" | "onUnequip" | "onInspect"
  > & {
    equippedAtActive: string | undefined;
    limitReached: boolean;
    sizeClass?: string;
  },
) {
  const { isEquippedHere, canEquip, blockedByCap } = pieceState(
    j,
    props.selectedAnchorId,
    props.equippedAtActive,
    props.limitReached,
  );
  return (
    <SlotCard
      key={j.id}
      piece={j}
      isEquippedHere={isEquippedHere}
      canEquip={canEquip}
      blockedByCap={blockedByCap}
      onEquip={() =>
        props.selectedAnchorId && props.onEquip(props.selectedAnchorId, j.id)
      }
      onUnequip={() =>
        props.selectedAnchorId && props.onUnequip(props.selectedAnchorId)
      }
      onInspect={props.onInspect ? () => props.onInspect!(j.id) : undefined}
      className={props.sizeClass}
    />
  );
}
