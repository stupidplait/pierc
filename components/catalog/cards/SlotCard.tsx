"use client";

import Image from "next/image";
import { Check, Plus, X } from "lucide-react";
import type { JewelryWire } from "@/lib/catalog/types";
import { catalogStrings } from "@/lib/i18n/ru";
import { formatPrice } from "@/lib/jewelry/format";
import { cn } from "@/lib/utils";
import { ct, MultiAnchorBadge } from "../views/parts";

export interface SlotCardProps {
  piece: JewelryWire;
  isEquippedHere: boolean;
  canEquip: boolean;
  blockedByCap: boolean;
  onEquip: () => void;
  onUnequip: () => void;
  /** Open the inspect overlay; when absent (detail=page) the tile is a no-op
   *  surface and only the equip button acts. */
  onInspect?: () => void;
  /** Outer sizing — containers set width/aspect here. */
  className?: string;
}

/**
 * SlotCard — the gaming "inventory slot" used by the rail / hotbar / sheet
 * card layouts. A square photo tile with a state-driven border (equipped =
 * magenta glow, out-of-stock = dimmed), a mono price + name strip, and a
 * single corner action button (+ to equip · ✓/✕ when equipped here). Clicking
 * the tile body opens the inspect overlay; the action button stops propagation.
 */
export function SlotCard({
  piece: j,
  isEquippedHere,
  canEquip,
  blockedByCap,
  onEquip,
  onUnequip,
  onInspect,
  className,
}: SlotCardProps) {
  const out = j.inStock <= 0;

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-bg-elev/70 transition-colors",
        isEquippedHere
          ? "border-accent/70 shadow-[0_0_0_1px_rgba(254,1,126,0.35),0_0_22px_-6px_rgba(254,1,126,0.6)]"
          : "border-line hover:border-ink/30",
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden">
        {/* Tile body = inspect trigger (sits beneath the action button). */}
        <button
          type="button"
          onClick={onInspect}
          disabled={!onInspect}
          title={onInspect ? ct.inspect : undefined}
          className="absolute inset-0 z-0 disabled:cursor-default"
          aria-label={`${j.name} — ${onInspect ? ct.inspect : j.name}`}
        >
          {j.photo ? (
            <Image
              src={j.photo}
              alt={j.name}
              fill
              sizes="200px"
              className={cn(
                "object-cover transition-transform duration-500 group-hover:scale-105",
                out && "opacity-45 grayscale",
              )}
            />
          ) : (
            <span className="grid h-full w-full place-items-center text-2xl text-mute">
              ◇
            </span>
          )}
        </button>

        {/* Corner index/decor — hairline bracket for the slot feel. */}
        <span className="pointer-events-none absolute left-1.5 top-1.5 z-10">
          <MultiAnchorBadge count={j.piercingCount} />
        </span>
        {out ? (
          <span className="pointer-events-none absolute right-1.5 top-1.5 z-10 rounded bg-bg/85 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-mute backdrop-blur">
            {catalogStrings.outOfStock}
          </span>
        ) : null}

        {/* Action button — equip / remove. */}
        {isEquippedHere ? (
          <button
            type="button"
            onClick={onUnequip}
            title={ct.unequip}
            className="absolute bottom-1.5 right-1.5 z-20 grid size-7 place-items-center rounded-full bg-accent text-on-primary transition-colors hover:bg-primary-soft"
          >
            <X className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onEquip}
            disabled={!canEquip || blockedByCap}
            title={canEquip ? ct.equip : ct.listAnchorPrompt}
            className="absolute bottom-1.5 right-1.5 z-20 grid size-7 place-items-center rounded-full border border-ink/25 bg-bg/75 text-ink backdrop-blur transition-colors hover:border-accent hover:bg-accent hover:text-on-primary disabled:opacity-35 disabled:hover:border-ink/25 disabled:hover:bg-bg/75 disabled:hover:text-ink"
          >
            <Plus className="size-4" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
        <p className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-[0.1em] text-ink">
          {j.name}
        </p>
        {isEquippedHere ? (
          <Check className="size-3 shrink-0 text-accent" />
        ) : null}
      </div>
      <p className="px-2 pb-2 font-mono text-xs text-accent">
        {formatPrice(j.price)}
      </p>
    </article>
  );
}
