"use client";

import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import type { AnchorWire, JewelryWire } from "@/lib/catalog/types";
import type {
  CardviewVariant,
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

interface RailDetailProps {
  piece: JewelryWire;
  anchors: AnchorWire[];
  user: BookingUser | null;
  detail: DetailVariant;
  view: CardviewVariant;
  loader: LoaderVariant;
  onClose: () => void;
  onEquip: (jewelryId: string) => void;
}

/**
 * RailDetail — the "card page" rendered INSIDE the expanded inventory rail.
 * Shares the site's content language (font-display title, mono eyebrow,
 * hairline spec sheet, accent chips) so it reads like /about · /services. The
 * composition switches with the `cardview` lab axis; the parent (CardsSideRail)
 * owns the expand + transition animation.
 */
export function RailDetail({
  piece,
  anchors,
  user,
  detail,
  view,
  loader,
  onClose,
  onEquip,
}: RailDetailProps) {
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

      {view === "editorial" ? (
        <Editorial piece={piece} dp={dp} user={user} detail={detail} loader={loader} onEquip={onEquip} />
      ) : view === "sheet" ? (
        <Sheet piece={piece} dp={dp} user={user} detail={detail} loader={loader} onEquip={onEquip} />
      ) : (
        <Gallery piece={piece} dp={dp} user={user} detail={detail} loader={loader} onEquip={onEquip} />
      )}
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

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">
      {children}
    </p>
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

// ── B · editorial — typography-led: title block first, then model ─────
function Editorial(props: BlockProps) {
  const { dp } = props;
  return (
    <div className="flex flex-col gap-6 px-6 pb-7">
      <header className="flex flex-col gap-3">
        <Eyebrow>{dp.categoryName}</Eyebrow>
        <h2 className="font-display text-4xl font-medium leading-[1.05] tracking-tight text-ink text-balance">
          {dp.name}
        </h2>
        <Price dp={dp} className="text-xl" />
      </header>

      <Hero piece={props.piece} dp={dp} loader={props.loader} className="aspect-4/5" />

      <Description piece={dp} className="border-t border-line pt-5" />
      <Actions {...props} />
      <SpecPanel dp={dp} />
    </div>
  );
}

// ── C · sheet — data-sheet-led: compact header, specs centre stage ────
function Sheet(props: BlockProps) {
  const { dp } = props;
  return (
    <div className="flex flex-col gap-5 px-5 pb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>{dp.categoryName}</Eyebrow>
          <h2 className="mt-1.5 truncate font-display text-xl font-medium text-ink">
            {dp.name}
          </h2>
        </div>
        <Price dp={dp} className="shrink-0 text-lg" />
      </div>

      <Hero piece={props.piece} dp={dp} loader={props.loader} className="aspect-video" />

      <SpecPanel dp={dp} />
      <Description piece={dp} className="text-sm" />
      <Actions {...props} />
    </div>
  );
}
