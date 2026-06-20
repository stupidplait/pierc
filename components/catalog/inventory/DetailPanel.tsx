"use client";

import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import type { AnchorWire, JewelryWire } from "@/lib/catalog/types";
import type {
  DetailVariant,
  LoaderVariant,
} from "@/lib/catalog/lab-state";
import type { BookingUser } from "@/lib/booking/wizard-types";
import { catalogGlbSrc } from "@/lib/jewelry/glb-proxy";
import { toDetailPiece, type DetailLike } from "@/lib/catalog/detail-piece";
import { catalogStrings } from "@/lib/i18n/ru";
import { useLenisScroll } from "@/lib/catalog/use-lenis-scroll";
import { Badge } from "@/components/shadcn/ui/badge";
import { cn } from "@/lib/utils";
import { CatalogGlbViewer } from "../detail/CatalogGlbViewer";
import { DetailActions } from "../detail/DetailActions";
import {
  Description,
  SpecLedger,
  AnchorChips,
  PhotoEmpty,
} from "../detail/parts";

const ct = catalogStrings.showroom;

interface DetailPanelProps {
  piece: JewelryWire;
  anchors: AnchorWire[];
  user: BookingUser | null;
  detail: DetailVariant;
  loader: LoaderVariant;
  onClose: () => void;
  onEquip: (jewelryId: string) => void;
}

/**
 * DetailPanel — the "card page" rendered INSIDE the expanded inventory rail.
 * Shares the site's content language (font-display title, mono eyebrow,
 * hairline spec sheet, accent chips) so it reads like /about · /services. The
 * parent (InventoryRail) owns the expand + transition animation.
 */
export function DetailPanel({
  piece,
  anchors,
  user,
  detail,
  loader,
  onClose,
  onEquip,
}: DetailPanelProps) {
  const wheelRef = useLenisScroll();
  const dp = toDetailPiece(piece, anchors);

  return (
    <div
      ref={wheelRef}
      className="no-scrollbar flex h-full flex-col overflow-y-auto"
      data-lenis-prevent
    >
      <button
        type="button"
        onClick={onClose}
        className="sticky top-0 z-10 flex shrink-0 items-center gap-1.5 self-start px-4 py-3 text-sm text-mute transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        {ct.inventory}
      </button>

      {/* Locked design: cardview = "gallery". The editorial/sheet layouts from
          the design lab were removed. */}
      <Gallery piece={piece} dp={dp} user={user} detail={detail} loader={loader} onEquip={onEquip} />
    </div>
  );
}

// ── shared blocks ────────────────────────────────────────────────────
interface BlockProps {
  piece: JewelryWire;
  dp: DetailLike;
  user: BookingUser | null;
  detail: DetailVariant;
  loader: LoaderVariant;
  onEquip: (jewelryId: string) => void;
}

function Hero({
  piece,
  dp,
  loader,
  className,
}: {
  piece: JewelryWire;
  dp: DetailLike;
  loader: LoaderVariant;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-line bg-bg",
        className,
      )}
    >
      {piece.glbUrl ? (
        <CatalogGlbViewer
          url={catalogGlbSrc(piece.id, piece.glbUrl)}
          className="h-full w-full"
          loaderVariant={loader}
        />
      ) : dp.photos[0] ? (
        <Image
          src={dp.photos[0].url}
          alt={dp.photos[0].alt}
          fill
          sizes="26rem"
          className="object-cover"
        />
      ) : (
        <PhotoEmpty className="h-full w-full rounded-none border-0" />
      )}
      {piece.glbUrl ? (
        <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-bg/70 px-3 py-1 font-mono text-[11px] text-mute backdrop-blur">
          {ct.rotateHint}
        </span>
      ) : null}
    </div>
  );
}

function Price({ dp, className }: { dp: DetailLike; className?: string }) {
  return (
    <p className={cn("font-mono font-medium text-accent", className)}>
      {dp.priceLabel}
    </p>
  );
}

function SpecPanel({ dp }: { dp: DetailLike }) {
  if (dp.specs.length === 0 && dp.anchorChips.length === 0) return null;
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <SpecLedger piece={dp} />
      {dp.anchorChips.length > 0 ? (
        <AnchorChips piece={dp} className="mt-4 border-t border-line pt-4" />
      ) : null}
    </div>
  );
}

function Actions({ piece, dp, user, detail, onEquip }: BlockProps) {
  return (
    <DetailActions
      jewelry={piece}
      dp={dp}
      user={user}
      detail={detail}
      onEquip={() => onEquip(piece.id)}
    />
  );
}

// ── A · gallery — model-led: big hero, info beneath ───────────────────
function Gallery(props: BlockProps) {
  const { dp } = props;
  return (
    <div className="flex flex-col gap-5 px-5 pb-6">
      <Hero piece={props.piece} dp={dp} loader={props.loader} className="aspect-square" />
      <div className="flex flex-col gap-4">
        <div>
          <Badge variant="accent" className="mb-3">
            {dp.categoryName}
          </Badge>
          <h2 className="font-display text-2xl font-medium tracking-tight text-ink">
            {dp.name}
          </h2>
          <Price dp={dp} className="mt-2 text-lg" />
        </div>
        <Description piece={dp} className="text-sm" />
        <Actions {...props} />
        <SpecPanel dp={dp} />
      </div>
    </div>
  );
}

