"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { blurReveal } from "@/components/motion/Stagger";
import {
  REVIEW_TONE,
  reviewEditHref,
  reviewStatusLabel,
  type ReviewItem,
  type ReviewStatus,
} from "@/lib/admin/reviews-view";
import {
  FeaturedChip,
  JewelryChip,
  QuoteGlyph,
  StarRating,
  VerifiedChip,
} from "./chips";
import { cn } from "@/lib/utils";

/** Per-item blur-rise on first paint; static (no replay) after a filter change. */
function entrance(animateIn: boolean, index: number) {
  return animateIn ? blurReveal(index) : { initial: false as const };
}

/**
 * The reviews wall — a CSS-columns masonry of testimonial quote-cards. The
 * review text is the hero in display type behind an oversized accent quote
 * glyph; card height follows the quote with no JS.
 *
 * Featured reviews get an accent ring + faint glow so the public-facing picks
 * stand out. Every card links to the editor (moderation lives there).
 */
export function ReviewsWall({
  items,
  animateIn,
}: {
  items: ReviewItem[];
  animateIn: boolean;
}) {
  return (
    <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
      {items.map((r, i) => (
        <m.div
          key={r.id}
          {...entrance(animateIn, i)}
          className="mb-4 break-inside-avoid"
        >
          <WallCard r={r} />
        </m.div>
      ))}
    </div>
  );
}

/** Status corner tag — colour signals operator intent (see REVIEW_TONE). */
function StatusTag({ status }: { status: ReviewStatus }) {
  const tone = REVIEW_TONE[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone.soft,
        tone.text,
      )}
    >
      <span className={cn("size-1.5 rounded-full", tone.dot)} />
      {reviewStatusLabel(status)}
    </span>
  );
}

/** Shared card chrome: hairline surface that lifts on hover; featured = accent. */
function cardSkin(featured: boolean) {
  return cn(
    "group relative block overflow-hidden rounded-2xl border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elev-hover",
    featured
      ? "border-accent/40 ring-1 ring-accent/25 hover:border-accent/60"
      : "border-line hover:border-ink/25",
  );
}

function WallCard({ r }: { r: ReviewItem }) {
  return (
    <Link href={reviewEditHref(r.id)} className={cn(cardSkin(r.featured), "p-5")}>
      {/* Featured glow — a faint accent wash bleeding from the top edge. */}
      {r.featured ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-px h-16 bg-gradient-to-b from-accent/10 to-transparent"
        />
      ) : null}

      {/* Rating + status corner tag */}
      <div className="relative flex items-start justify-between gap-3">
        <StarRating value={r.rating} />
        <StatusTag status={r.status} />
      </div>

      {/* Quote — the hero */}
      <div className="relative mt-3">
        <QuoteGlyph className="absolute -left-1 -top-3 text-5xl text-accent/15" />
        <p className="relative whitespace-pre-line font-display text-[15px] leading-relaxed text-ink">
          {r.text}
        </p>
      </div>

      {/* Author footer + provenance */}
      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-line/70 pt-3">
        <span className="text-xs font-medium uppercase tracking-[0.12em] text-ink">
          {r.authorName}
        </span>
        {r.verified ? <VerifiedChip /> : null}
        {r.featured ? <FeaturedChip /> : null}
        <span className="ml-auto text-xs text-mute tabular-nums">{r.createdAt}</span>
      </div>

      {r.jewelry.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {r.jewelry.map((name, i) => (
            <JewelryChip key={`${name}-${i}`}>{name}</JewelryChip>
          ))}
        </div>
      ) : null}
    </Link>
  );
}
