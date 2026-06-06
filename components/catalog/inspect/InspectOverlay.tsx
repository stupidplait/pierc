"use client";

import { useEffect } from "react";
import Image from "next/image";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import type { AnchorWire, JewelryWire } from "@/lib/catalog/types";
import type { DetailVariant, LoaderVariant } from "@/lib/catalog/lab-state";
import type { BookingUser } from "@/lib/booking/wizard-types";
import { catalogGlbSrc } from "@/lib/jewelry/glb-proxy";
import { toDetailPiece } from "@/lib/catalog/detail-piece";
import { catalogStrings } from "@/lib/i18n/ru";
import { CatalogGlbViewer } from "../detail/CatalogGlbViewer";
import { DetailActions } from "../detail/DetailActions";
import {
  TitleBlock,
  Description,
  SpecLedger,
  AnchorChips,
  PhotoEmpty,
} from "../detail/parts";

const ct = catalogStrings.showroom;

interface InspectOverlayProps {
  piece: JewelryWire | null;
  anchors: AnchorWire[];
  user: BookingUser | null;
  /** `both` adds a link out to the standalone /catalog/[id] page. */
  detail: DetailVariant;
  loader: LoaderVariant;
  onClose: () => void;
  /** Equip this piece at its primary anchor + focus there, then close. */
  onEquip: (jewelryId: string) => void;
}

/**
 * InspectOverlay — the in-catalog "examine item" panel. Opened via ?inspect=id
 * (or a card click), it floats over the live showroom (which keeps its equipped
 * state) and shows the piece's own 3D model, specs and description with inline
 * Equip / Book actions. Reuses the standalone detail page's atoms so the two
 * stay visually identical.
 */
export function InspectOverlay({
  piece,
  anchors,
  user,
  detail,
  loader,
  onClose,
  onEquip,
}: InspectOverlayProps) {
  const reduce = useReducedMotion();

  // Close on Escape while open.
  useEffect(() => {
    if (!piece) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [piece, onClose]);

  const dp = piece ? toDetailPiece(piece, anchors) : null;
  const heroPhoto = dp?.photos[0] ?? null;

  return (
    <AnimatePresence>
      {piece && dp ? (
        <m.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Scrim */}
          <button
            type="button"
            aria-label={ct.inventoryClose}
            onClick={onClose}
            className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
          />

          {/* Panel */}
          <m.div
            className="relative z-10 flex max-h-[92svh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-line bg-bg-elev shadow-2xl sm:rounded-3xl"
            initial={reduce ? false : { y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={reduce ? undefined : { y: 24, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 z-20 grid size-9 place-items-center rounded-full border border-line bg-bg/60 text-mute backdrop-blur transition-colors hover:text-ink"
              aria-label={ct.inventoryClose}
            >
              <X className="size-4" />
            </button>

            <div className="grid min-h-0 gap-0 overflow-y-auto md:grid-cols-[1.1fr_1fr]">
              {/* Hero — GLB or photo */}
              <div className="relative aspect-square bg-bg md:aspect-auto md:min-h-[26rem]">
                {piece.glbUrl ? (
                  <CatalogGlbViewer
                    url={catalogGlbSrc(piece.id, piece.glbUrl)}
                    className="h-full w-full"
                    loaderVariant={loader}
                  />
                ) : heroPhoto ? (
                  <Image
                    src={heroPhoto.url}
                    alt={heroPhoto.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 45vw"
                    className="object-cover"
                  />
                ) : (
                  <PhotoEmpty className="h-full w-full rounded-none border-0" />
                )}
                {piece.glbUrl ? (
                  <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-bg/70 px-3 py-1 font-mono text-[11px] text-mute backdrop-blur">
                    {ct.rotateHint}
                  </span>
                ) : null}
              </div>

              {/* Details */}
              <div className="flex flex-col gap-5 p-6 sm:p-8">
                <TitleBlock piece={dp} />
                <Description piece={dp} />

                <DetailActions
                  jewelry={piece}
                  dp={dp}
                  user={user}
                  detail={detail}
                  onEquip={() => onEquip(piece.id)}
                />

                <div className="rounded-2xl border border-line bg-card p-5">
                  <SpecLedger piece={dp} />
                  {dp.anchorChips.length > 0 ? (
                    <AnchorChips
                      piece={dp}
                      className="mt-4 border-t border-line pt-4"
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </m.div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
