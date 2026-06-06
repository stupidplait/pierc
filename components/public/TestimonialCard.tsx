import { Star } from "lucide-react";
import { reviewsStrings } from "@/lib/i18n/ru";

export interface TestimonialCardData {
  id: string;
  rating: number;
  text: string;
  authorName: string;
  photoUrl: string | null;
  /** When set, render the "Проверенный клиент" badge. */
  verified: boolean;
  /** ISO date string for the optional date stamp; null hides the line. */
  publishedAt: string | null;
}

const RU_DATE = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "Verified client" pill — review tied to a real appointment. Public twin of
 *  the admin VerifiedChip, sized to sit inline beside the author's name. */
function VerifiedChip() {
  return (
    <span
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-success/30 bg-success-soft text-[11px] font-medium text-success sm:size-auto sm:gap-1 sm:px-2 sm:py-0.5"
      title={reviewsStrings.verifiedBadge}
      aria-label={reviewsStrings.verifiedBadge}
    >
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M3.5 8.5l3 3 6-7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="hidden sm:inline">{reviewsStrings.verifiedBadge}</span>
    </span>
  );
}

/**
 * Single review card — the public counterpart to the admin reviews wall card.
 * A metadata header pairs the accent star rating (left) with the review date
 * (right); the quote is the display-type hero behind an oversized accent
 * quotation glyph; the footer is the attribution line — author name with the
 * verified badge beside it. Used on /about (featured testimonials grid).
 */
export function TestimonialCard({ review }: { review: TestimonialCardData }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-line bg-card p-5">
      {/* Metadata header — rating left, date right. */}
      <div className="flex items-center justify-between gap-3">
        <span
          className="inline-flex items-center gap-0.5"
          role="img"
          aria-label={`${reviewsStrings.ratingLabel}: ${review.rating}/5`}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={
                n <= review.rating
                  ? "size-3.75 fill-accent text-accent"
                  : "size-3.75 text-ink/25"
              }
              aria-hidden
            />
          ))}
        </span>
        {review.publishedAt ? (
          <span className="text-xs text-mute tabular-nums">
            {RU_DATE.format(new Date(review.publishedAt))}
          </span>
        ) : null}
      </div>

      {/* Quote — the hero, behind an oversized accent quotation mark. */}
      <div className="relative mt-3 flex-1">
        <span
          aria-hidden
          className="pointer-events-none absolute -left-1 -top-3 select-none font-display text-5xl leading-none text-accent/15"
        >
          &ldquo;
        </span>
        <p className="relative whitespace-pre-line font-display text-[15px] leading-relaxed text-ink">
          {review.text}
        </p>
      </div>

      {/* Attribution — author name with the verified badge beside it. */}
      <footer className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-line/70 pt-3">
        <span className="text-xs font-medium uppercase tracking-[0.12em] text-ink">
          {review.authorName}
        </span>
        {review.verified ? <VerifiedChip /> : null}
      </footer>
    </article>
  );
}
