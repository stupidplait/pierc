import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ru, catalogStrings } from "@/lib/i18n/ru";
import { Badge } from "@/components/shadcn/ui/badge";
import { Button } from "@/components/shadcn/ui/button";
import { JewelryDetailBookButton } from "@/components/booking/JewelryDetailBookButton";
import type { BookingUser } from "@/lib/booking/wizard-types";
import { cn } from "@/lib/utils";

/** A photo on the detail page. */
export interface DetailPhoto {
  url: string;
  alt: string;
}

/** One spec row (label + already-formatted value). */
export interface DetailSpec {
  label: string;
  value: string;
}

/**
 * The flattened, view-ready piece passed to every detail variant. The page
 * (server component) builds this once from Prisma + i18n so the four layouts
 * stay purely presentational and share the same data contract.
 */
export interface DetailPiece {
  id: string;
  name: string;
  /** Already formatted, e.g. "12 800 ₽". */
  priceLabel: string;
  categoryName: string;
  description: string | null;
  photos: DetailPhoto[];
  /** Interactive 3D model, when the piece has one. */
  glbUrl: string | null;
  /** Material/gauge/size/… ready to render as a ledger. */
  specs: DetailSpec[];
  anchorChips: Array<{ id: string; name: string }>;
  primaryAnchorId: string | null;
  /** Deep link into the showroom with this piece pre-equipped. */
  tryOnHref: string | null;
  outOfStock: boolean;
}

/** Props every detail variant receives. */
export interface DetailViewProps {
  piece: DetailPiece;
  user: BookingUser | null;
}

export const ct = catalogStrings;

// ── Shared atoms ──────────────────────────────────────────────────

/** "← Каталог" back link. */
export function BackLink({ className }: { className?: string }) {
  return (
    <Button asChild variant="ghost" size="sm" className={cn("gap-2", className)}>
      <Link href="/catalog">
        <ArrowLeft className="size-4" />
        {ru.pages.catalog.title}
      </Link>
    </Button>
  );
}

/** Category eyebrow + name + price block, sizes tunable per variant. */
export function TitleBlock({
  piece,
  size = "lg",
  className,
}: {
  piece: DetailPiece;
  /** `sm` is for the compact in-rail detail; `lg`/`xl` for the full page. */
  size?: "sm" | "lg" | "xl";
  className?: string;
}) {
  return (
    <div className={className}>
      <Badge variant="accent" className="mb-3">
        {piece.categoryName}
      </Badge>
      <h1
        className={cn(
          "font-display font-medium text-ink",
          size === "xl"
            ? "text-5xl sm:text-6xl"
            : size === "sm"
              ? "text-2xl"
              : "text-4xl sm:text-5xl",
        )}
      >
        {piece.name}
      </h1>
      <p
        className={cn(
          "font-mono font-medium text-accent",
          size === "sm" ? "mt-2 text-lg" : "mt-4 text-2xl",
        )}
      >
        {piece.priceLabel}
      </p>
    </div>
  );
}

/** Try-on (deep link) + book/out-of-stock CTAs. */
export function CtaRow({
  piece,
  user,
  className,
}: DetailViewProps & { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {piece.tryOnHref ? (
        <Button
          asChild
          className="bg-accent text-on-primary hover:bg-primary-soft"
        >
          <Link href={piece.tryOnHref}>{ct.showroom.tryItOn}</Link>
        </Button>
      ) : null}
      {piece.outOfStock ? (
        <Button disabled variant="outline" title={ct.outOfStock}>
          {ct.outOfStock}
        </Button>
      ) : (
        <JewelryDetailBookButton
          item={{
            id: piece.id,
            name: piece.name,
            price: piece.priceLabel,
            photo: piece.photos[0]?.url ?? null,
            inStock: piece.outOfStock ? 0 : 1,
          }}
          user={user}
          label={ct.bookCta}
        />
      )}
    </div>
  );
}

/** Description paragraph (whitespace-preserving), or nothing. */
export function Description({
  piece,
  className,
}: {
  piece: DetailPiece;
  className?: string;
}) {
  if (!piece.description) return null;
  return (
    <p
      className={cn(
        "max-w-prose whitespace-pre-line text-mute",
        className,
      )}
    >
      {piece.description}
    </p>
  );
}

/** Label/value ledger of the piece's specs. */
export function SpecLedger({
  piece,
  className,
}: {
  piece: DetailPiece;
  className?: string;
}) {
  if (piece.specs.length === 0) return null;
  return (
    <dl className={cn("divide-y divide-line", className)}>
      {piece.specs.map((s) => (
        <div
          key={s.label}
          className="flex items-baseline justify-between gap-4 py-2.5"
        >
          <dt className="text-sm text-mute">{s.label}</dt>
          <dd className="text-right text-sm text-ink">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "Где носить" anchor chips, primary highlighted. */
export function AnchorChips({
  piece,
  className,
}: {
  piece: DetailPiece;
  className?: string;
}) {
  if (piece.anchorChips.length === 0) return null;
  return (
    <div className={className}>
      <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-mute">
        {ct.attributes.anchors}
      </p>
      <ul className="flex flex-wrap gap-2">
        {piece.anchorChips.map((a) => (
          <li key={a.id}>
            <Badge
              variant={a.id === piece.primaryAnchorId ? "accent" : "secondary"}
            >
              {a.name}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Placeholder tile when a piece has no photo. */
export function PhotoEmpty({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid place-items-center rounded-2xl border border-line bg-card text-3xl text-mute",
        className,
      )}
    >
      ◇
    </div>
  );
}
