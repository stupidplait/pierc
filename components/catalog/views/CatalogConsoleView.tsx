"use client";

import Link from "next/link";
import { Grid3x3 } from "lucide-react";
import { ShowroomScene } from "./LazyScene";
import { MobileShowroom } from "./MobileShowroom";
import { PieceCard } from "./PieceCard";
import {
  ct,
  useCatalogModel,
  pieceState,
  Thumb,
  BookButton,
  TrayCountBadge,
  type CatalogViewProps,
} from "./parts";
import { bodyPlaceLabels, bodyPlaceOrder, catalogStrings } from "@/lib/i18n/ru";
import { Button } from "@/components/shadcn/ui/button";
import { useIsDesktop } from "@/lib/catalog/use-is-desktop";
import { cn } from "@/lib/utils";

/**
 * Variant A — "Instrument Console". Full-bleed 3D stage with a cinematic
 * bottom dock: an anchor rail across the top of the dock, a horizontal
 * snap-scroll filmstrip of pieces, and a compact tray + book on the right.
 */
export function CatalogConsoleView(props: CatalogViewProps) {
  const {
    anchors,
    jewelry,
    selectedAnchorId,
    equipped,
    canBook,
    onBook,
    onSelectAnchor,
    onEquip,
    onUnequip,
    hideGridLink,
    cardVariant = "classic",
  } = props;

  const {
    grouped,
    filtered,
    equippedItems,
    selectedAnchor,
    trayCount,
    limitReached,
    equippedAtActive,
  } = useCatalogModel(props);

  // Exactly one WebGL canvas at a time. Below `lg` the mobile scene owns it;
  // at `lg`+ the desktop full-bleed scene does. The opposite layout still
  // renders its chrome (CSS-hidden) but skips the canvas.
  const isDesktop = useIsDesktop();

  return (
    <>
      <MobileShowroom {...props} mountScene={!isDesktop} />

      {/* Desktop: full-bleed scene + bottom console dock */}
      <div className="relative hidden h-full lg:block">
        {isDesktop ? (
          <ShowroomScene
            anchors={anchors}
            jewelry={jewelry}
            selectedId={selectedAnchorId}
            equipped={equipped}
            onSelectAnchor={onSelectAnchor}
            showHint={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-mute">
            {catalogStrings.showroom.sceneLoading}
          </div>
        )}

        {!hideGridLink ? (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="absolute right-5 top-22 gap-2 rounded-full border border-line bg-bg-elev/70 backdrop-blur"
          >
            <Link href="/catalog?view=grid">
              <Grid3x3 className="size-4" />
              {ct.gridLink}
            </Link>
          </Button>
        ) : null}

        {/* Bottom dock */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-4">
          <div className="pointer-events-auto mx-auto flex max-w-6xl flex-col gap-3 rounded-2xl border border-line bg-bg-elev/80 p-4 shadow-[0_-1px_2px_rgba(8,8,8,0.5),0_-12px_40px_-12px_rgba(8,8,8,0.7)] backdrop-blur-xl">
            {/* Anchor rail + tray summary */}
            <div className="flex items-center justify-between gap-4">
              <div className="-mx-1 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-1 pb-1">
                <RailChip
                  active={!selectedAnchorId}
                  onClick={() => onSelectAnchor(null)}
                >
                  {ct.anchorAll}
                </RailChip>
                {bodyPlaceOrder.map((place) =>
                  grouped[place].length > 0 ? (
                    <div key={place} className="flex items-center gap-2">
                      <span className="ml-1 shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
                        {bodyPlaceLabels[place]}
                      </span>
                      {grouped[place].map((a) => (
                        <RailChip
                          key={a.id}
                          active={selectedAnchorId === a.id}
                          onClick={() => onSelectAnchor(a.id)}
                        >
                          {a.name}
                        </RailChip>
                      ))}
                    </div>
                  ) : null,
                )}
              </div>

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
                  <BookButton
                    canBook={canBook}
                    onBook={onBook}
                    className="w-auto px-5"
                  />
                ) : null}
              </div>
            </div>

            <div className="h-px bg-line" />

            {/* Filmstrip */}
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <p className="font-display text-sm text-ink">
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
                  {filtered.map((j) => {
                    const { isEquippedHere, canEquip, blockedByCap } =
                      pieceState(
                        j,
                        selectedAnchorId,
                        equippedAtActive,
                        limitReached,
                      );
                    return (
                      <PieceCard
                        key={j.id}
                        piece={j}
                        variant={cardVariant}
                        isEquippedHere={isEquippedHere}
                        canEquip={canEquip}
                        blockedByCap={blockedByCap}
                        onEquip={() =>
                          selectedAnchorId && onEquip(selectedAnchorId, j.id)
                        }
                        onUnequip={() =>
                          selectedAnchorId && onUnequip(selectedAnchorId)
                        }
                      />
                    );
                  })}
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
      </div>
    </>
  );
}

function RailChip({
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
        "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-accent/40 bg-accent/15 text-accent"
          : "border-line bg-bg/40 text-mute hover:border-ink/35 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
