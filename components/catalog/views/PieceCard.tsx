"use client";

import Image from "next/image";
import { Check, Plus, X } from "lucide-react";
import type { JewelryWire } from "@/lib/catalog/types";
import { catalogStrings } from "@/lib/i18n/ru";
import { formatPrice } from "@/lib/jewelry/format";
import { Button } from "@/components/shadcn/ui/button";
import { Badge } from "@/components/shadcn/ui/badge";
import { cn } from "@/lib/utils";
import { ct, MultiAnchorBadge, type CardVariant } from "./parts";

interface PieceCardProps {
  piece: JewelryWire;
  variant: CardVariant;
  isEquippedHere: boolean;
  canEquip: boolean;
  blockedByCap: boolean;
  onEquip: () => void;
  onUnequip: () => void;
}

export function PieceCard(props: PieceCardProps) {
  switch (props.variant) {
    case "overlay":
      return <OverlayCard {...props} />;
    case "frame":
      return <FrameCard {...props} />;
    case "minimal":
      return <MinimalCard {...props} />;
    default:
      return <ClassicCard {...props} />;
  }
}

// Shared image fill + out-of-stock chip used across the photo-led variants.
function PhotoFill({ piece }: { piece: JewelryWire }) {
  return piece.photo ? (
    <Image
      src={piece.photo}
      alt={piece.name}
      fill
      sizes="200px"
      className="object-cover transition-transform duration-500 group-hover:scale-105"
    />
  ) : (
    <div className="grid h-full w-full place-items-center text-2xl text-mute">
      ◇
    </div>
  );
}

function OutOfStockChip({ piece }: { piece: JewelryWire }) {
  if (piece.inStock > 0) return null;
  return (
    <Badge
      variant="outline"
      className="absolute right-2 top-2 bg-bg/80 backdrop-blur"
    >
      {catalogStrings.outOfStock}
    </Badge>
  );
}

// ── A · Classic — square photo, name/price/button stacked below ────
function ClassicCard({
  piece: j,
  isEquippedHere,
  canEquip,
  blockedByCap,
  onEquip,
  onUnequip,
}: PieceCardProps) {
  return (
    <article className="group w-40 shrink-0 snap-start">
      <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-bg">
        <PhotoFill piece={j} />
        <div className="absolute left-2 top-2">
          <MultiAnchorBadge count={j.piercingCount} />
        </div>
        <OutOfStockChip piece={j} />
      </div>
      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{j.name}</p>
          <p className="truncate font-mono text-xs text-accent">
            {formatPrice(j.price)}
          </p>
        </div>
        {isEquippedHere ? (
          <Button
            size="icon"
            onClick={onUnequip}
            className="size-8 shrink-0 bg-accent text-on-primary hover:bg-primary-soft"
            title={ct.unequip}
          >
            <X className="size-4" />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={!canEquip || blockedByCap}
            onClick={onEquip}
            className="shrink-0"
          >
            {ct.equip}
          </Button>
        )}
      </div>
    </article>
  );
}

// ── B · Overlay — tall portrait, name/price over a gradient, round CTA ──
function OverlayCard({
  piece: j,
  isEquippedHere,
  canEquip,
  blockedByCap,
  onEquip,
  onUnequip,
}: PieceCardProps) {
  return (
    <article
      className={cn(
        "group relative aspect-3/4 w-44 shrink-0 snap-start overflow-hidden rounded-2xl border bg-bg transition-colors",
        isEquippedHere ? "border-accent" : "border-line",
      )}
    >
      <PhotoFill piece={j} />
      <div className="absolute left-2 top-2">
        <MultiAnchorBadge count={j.piercingCount} />
      </div>
      <OutOfStockChip piece={j} />

      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-bg/95 via-bg/55 to-transparent p-3 pt-10">
        <p className="truncate font-display text-sm text-ink">{j.name}</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="font-mono text-xs text-accent">{formatPrice(j.price)}</p>
          {isEquippedHere ? (
            <button
              type="button"
              onClick={onUnequip}
              title={ct.unequip}
              className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-on-primary transition-colors hover:bg-primary-soft"
            >
              <X className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!canEquip || blockedByCap}
              onClick={onEquip}
              title={ct.equip}
              className="grid size-7 shrink-0 place-items-center rounded-full border border-ink/25 bg-bg/70 text-ink transition-colors hover:border-ink hover:bg-ink hover:text-bg disabled:opacity-40 disabled:hover:border-ink/25 disabled:hover:bg-bg/70 disabled:hover:text-ink"
            >
              <Plus className="size-4" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// ── C · Frame — "specimen" card: inner-framed photo, mono spec, ghost CTA ──
function FrameCard({
  piece: j,
  isEquippedHere,
  canEquip,
  blockedByCap,
  onEquip,
  onUnequip,
}: PieceCardProps) {
  return (
    <article
      className={cn(
        "group flex w-44 shrink-0 snap-start flex-col rounded-xl border bg-bg-elev p-2 transition-colors",
        isEquippedHere ? "border-accent/60" : "border-line",
      )}
    >
      <div className="relative aspect-square overflow-hidden rounded-lg border border-line bg-bg">
        <PhotoFill piece={j} />
        <div className="absolute left-1.5 top-1.5">
          <MultiAnchorBadge count={j.piercingCount} />
        </div>
        <OutOfStockChip piece={j} />
      </div>
      <div className="flex items-center justify-between gap-2 px-0.5 pt-2">
        <p className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-ink">
          {j.name}
        </p>
      </div>
      <p className="px-0.5 pb-2 font-mono text-xs text-accent">
        {formatPrice(j.price)}
      </p>
      {isEquippedHere ? (
        <Button
          size="sm"
          onClick={onUnequip}
          className="w-full bg-accent text-on-primary hover:bg-primary-soft"
        >
          {ct.unequip}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={!canEquip || blockedByCap}
          onClick={onEquip}
          className="w-full"
        >
          {ct.equip}
        </Button>
      )}
    </article>
  );
}

// ── D · Minimal — photo + price chip; the whole tile toggles equip ────
function MinimalCard({
  piece: j,
  isEquippedHere,
  canEquip,
  blockedByCap,
  onEquip,
  onUnequip,
}: PieceCardProps) {
  const interactive = isEquippedHere || (canEquip && !blockedByCap);
  return (
    <button
      type="button"
      aria-pressed={isEquippedHere ? "true" : "false"}
      disabled={!interactive}
      onClick={isEquippedHere ? onUnequip : onEquip}
      title={isEquippedHere ? ct.unequip : ct.equip}
      className="group w-36 shrink-0 snap-start text-left disabled:cursor-default disabled:opacity-50"
    >
      <div
        className={cn(
          "relative aspect-square overflow-hidden rounded-xl border-2 bg-bg transition-all",
          isEquippedHere
            ? "border-accent shadow-[0_0_0_3px_rgba(240,107,160,0.2)]"
            : "border-transparent group-hover:border-ink/25 group-enabled:group-hover:-translate-y-0.5",
        )}
      >
        <PhotoFill piece={j} />
        <span className="absolute left-2 top-2 rounded-full bg-bg/80 px-2 py-0.5 font-mono text-[10px] text-ink backdrop-blur">
          {formatPrice(j.price)}
        </span>
        <div className="absolute right-2 top-2">
          <MultiAnchorBadge count={j.piercingCount} />
        </div>
        {isEquippedHere ? (
          <span className="absolute bottom-2 right-2 grid size-6 place-items-center rounded-full bg-accent text-on-primary">
            <Check className="size-3.5" />
          </span>
        ) : null}
        {j.inStock <= 0 ? (
          <span className="absolute inset-x-0 bottom-0 bg-bg/80 py-1 text-center text-[10px] text-mute backdrop-blur">
            {catalogStrings.outOfStock}
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 truncate px-0.5 text-xs text-mute group-hover:text-ink">
        {j.name}
      </p>
    </button>
  );
}
