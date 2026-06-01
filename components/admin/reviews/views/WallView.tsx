import Link from "next/link";
import { Reveal } from "@/components/admin/form/atelier";
import {
  REVIEW_TONE,
  reviewEditHref,
  reviewStatusLabel,
  type ReviewItem,
} from "@/lib/admin/reviews-view";
import {
  FeaturedChip,
  JewelryChip,
  QuoteGlyph,
  StarRating,
  VerifiedChip,
} from "../chips";

/**
 * Wall view — a masonry of testimonial quote-cards (CSS columns, so card height
 * follows the quote with no JS). The review *text* is the hero in display type
 * behind an oversized accent quote glyph; the rating sits up top, a status
 * corner tag names the state, and an author footer carries the provenance chips.
 * Featured reviews get an accent ring + faint glow so the public-facing picks
 * stand out. Every card links to the editor (moderation actions live there).
 */
export function WallView({ items }: { items: ReviewItem[] }) {
  return (
    <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
      {items.map((r, i) => (
        <Reveal
          key={r.id}
          delay={Math.min(i * 0.03, 0.24)}
          className="mb-4 break-inside-avoid"
        >
          <WallCard r={r} />
        </Reveal>
      ))}
    </div>
  );
}

function WallCard({ r }: { r: ReviewItem }) {
  const tone = REVIEW_TONE[r.status];
  return (
    <Link
      href={reviewEditHref(r.id)}
      className={`group relative block overflow-hidden rounded-2xl border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-16px_rgba(8,8,8,0.7)] ${
        r.featured
          ? "border-accent/40 ring-1 ring-accent/25 hover:border-accent/60"
          : "border-line hover:border-ink/25"
      }`}
    >
      {/* Rating + status corner tag */}
      <div className="flex items-start justify-between gap-3">
        <StarRating value={r.rating} />
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone.soft} ${tone.text}`}
        >
          <span className={`size-1.5 rounded-full ${tone.dot}`} />
          {reviewStatusLabel(r.status)}
        </span>
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
        <span className="ml-auto text-xs text-mute tabular-nums">
          {r.createdAt}
        </span>
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
