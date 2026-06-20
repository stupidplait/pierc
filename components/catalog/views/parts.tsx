"use client";

import Image from "next/image";
import { useMemo } from "react";
import {
  type AnchorWire,
  type BodyPlace,
  type EquippedMap,
  type JewelryWire,
  SOFT_CAP,
} from "@/lib/catalog/types";
import {
  bodyPlaceOrder,
  catalogStrings,
  piercingCountLabel,
} from "@/lib/i18n/ru";
import { Badge } from "@/components/shadcn/ui/badge";
import { Button } from "@/components/shadcn/ui/button";
import type {
  EnvVariant,
  HudVariant,
  PlaceVariant,
  InfoVariant,
  BgVariant,
  DotsVariant,
  DetailVariant,
  CardviewVariant,
  CardtxVariant,
  LoaderVariant,
} from "@/lib/catalog/lab-state";
import type { BookingUser } from "@/lib/booking/wizard-types";
import { cn } from "@/lib/utils";

/** Showroom i18n bundle, re-exported so views import one symbol. */
export const ct = catalogStrings.showroom;

/** Filmstrip card design direction (locked to "frame" today). */
export type CardVariant = "classic" | "overlay" | "frame" | "minimal";

/**
 * Props every catalog view receives. The Showroom orchestrator owns the state
 * and passes these down so the views stay purely presentational.
 */
export interface CatalogViewProps {
  anchors: AnchorWire[];
  jewelry: JewelryWire[];
  selectedAnchorId: string | null;
  equipped: EquippedMap;
  canBook?: boolean;
  onBook?: () => void;
  onSelectAnchor: (id: string | null) => void;
  onEquip: (anchorId: string, jewelryId: string) => void;
  onUnequip: (anchorId: string) => void;
  hideGridLink?: boolean;
  /** Which filmstrip card design to render (Console). Defaults to "classic". */
  cardVariant?: CardVariant;
  /** Design-lab scene environment (drives <ShowroomStage>). */
  env?: EnvVariant;
  /** Design-lab HUD / postprocessing level (drives <ShowroomStage>). */
  hud?: HudVariant;
  /** Where piercing-place selection lives (rail layout). */
  place?: PlaceVariant;
  /** Where the data readouts live — de-duplicates the HUD vs the rail. */
  info?: InfoVariant;
  /** Backdrop behind the dais figure. */
  bg?: BgVariant;
  /** Anchor-dot marker style. */
  dots?: DotsVariant;
  /** In-rail card-page layout. */
  cardview?: CardviewVariant;
  /** Grid ↔ card-page transition. */
  cardtx?: CardtxVariant;
  /** Loader/spinner style (scene cover + GLB viewers). */
  loader?: LoaderVariant;
  /** What clicking a piece does (overlay / both / page). */
  detail?: DetailVariant;
  /** Signed-in user, for the inline booking button in the detail view. */
  user?: BookingUser | null;
  /** Open a piece in the inspect overlay (set by card click when detail≠page). */
  onInspect?: (jewelryId: string) => void;
  /** Id of the piece open in the in-rail detail view (rail layout), or null. */
  inspectId?: string | null;
  /** Collapse the in-rail detail back to the grid. */
  onInspectClose?: () => void;
  /** Equip the inspected piece at its primary anchor + focus there. */
  onInspectEquip?: (jewelryId: string) => void;
}

/**
 * Shared derived model — the same grouping/filtering/tray math the old
 * `LiteInventory` computed inline, lifted so all four views reuse it.
 */
export function useCatalogModel({
  anchors,
  jewelry,
  selectedAnchorId,
  equipped,
}: Pick<
  CatalogViewProps,
  "anchors" | "jewelry" | "selectedAnchorId" | "equipped"
>) {
  const grouped = useMemo(() => {
    const out = {} as Record<BodyPlace, AnchorWire[]>;
    for (const place of bodyPlaceOrder) out[place] = [];
    for (const a of anchors) out[a.place].push(a);
    return out;
  }, [anchors]);

  const filtered = useMemo(() => {
    if (!selectedAnchorId) return jewelry;
    return jewelry.filter((j) => j.anchorIds.includes(selectedAnchorId));
  }, [jewelry, selectedAnchorId]);

  const equippedItems = useMemo(() => {
    const anchorById = new Map(anchors.map((a) => [a.id, a]));
    const jewelryById = new Map(jewelry.map((j) => [j.id, j]));
    const out: Array<{ anchor: AnchorWire; item: JewelryWire }> = [];
    for (const [anchorId, jewelryId] of Object.entries(equipped)) {
      const anchor = anchorById.get(anchorId);
      const item = jewelryById.get(jewelryId);
      if (anchor && item) out.push({ anchor, item });
    }
    return out;
  }, [equipped, anchors, jewelry]);

  const selectedAnchor = useMemo(
    () => anchors.find((a) => a.id === selectedAnchorId) ?? null,
    [anchors, selectedAnchorId],
  );

  const trayCount = equippedItems.length;
  const limitReached = trayCount >= SOFT_CAP;
  const equippedAtActive = selectedAnchorId
    ? equipped[selectedAnchorId]
    : undefined;

  return {
    grouped,
    filtered,
    equippedItems,
    selectedAnchor,
    trayCount,
    limitReached,
    equippedAtActive,
  };
}

/** Per-piece equip eligibility, shared by every view's piece list/cards. */
export function pieceState(
  j: JewelryWire,
  selectedAnchorId: string | null,
  equippedAtActive: string | undefined,
  limitReached: boolean,
) {
  const isEquippedHere = equippedAtActive === j.id;
  const canEquip = selectedAnchorId !== null;
  const blockedByCap = !isEquippedHere && limitReached && !equippedAtActive;
  return { isEquippedHere, canEquip, blockedByCap };
}

// ── Shared atoms ──────────────────────────────────────────────────

/** Square photo chip with the Steel Atelier card surface. */
export function Thumb({
  url,
  alt,
  className,
  sizes = "64px",
}: {
  url: string | null;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-lg bg-bg",
        className,
      )}
    >
      {url ? (
        <Image src={url} alt={alt} fill sizes={sizes} className="object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-[10px] text-mute">
          ◇
        </div>
      )}
    </div>
  );
}

/** Magenta "needs N piercings" badge — shown on multi-anchor pieces. */
export function MultiAnchorBadge({ count }: { count: number }) {
  if (count <= 1) return null;
  return (
    <Badge variant="accent" className="text-[10px]" title={ct.multiAnchorHint}>
      {piercingCountLabel(count)}
    </Badge>
  );
}

/**
 * The single accent "Забронировать" CTA. Renders nothing unless there's a
 * tray to book. `tone` lets the Drawer/Console use the full-bleed magenta and
 * the Focus view use a slimmer pill.
 */
export function BookButton({
  canBook,
  onBook,
  className,
}: {
  canBook?: boolean;
  onBook?: () => void;
  className?: string;
}) {
  if (!onBook || !canBook) return null;
  return (
    <Button
      onClick={onBook}
      className={cn(
        "w-full bg-accent text-on-primary hover:bg-primary-soft",
        className,
      )}
    >
      {catalogStrings.bookCta}
    </Button>
  );
}

/** Tray fill indicator, e.g. "2 / 6". */
export function TrayCountBadge({
  count,
  limitReached,
}: {
  count: number;
  limitReached: boolean;
}) {
  return (
    <Badge
      variant={limitReached ? "accent" : "secondary"}
      className="font-mono text-[10px]"
    >
      {count}/{SOFT_CAP}
    </Badge>
  );
}
