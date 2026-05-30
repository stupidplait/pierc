import Image from "next/image";
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

/**
 * Single review card. Used on /about (featured testimonials grid) and
 * /catalog/[id] (per-piece review list). Renders rating stars, author
 * name, optional verified badge, optional customer photo (capped at
 * 80×80 to avoid leaking EXIF / full-resolution faces), and the review
 * text.
 */
export function TestimonialCard({ review }: { review: TestimonialCardData }) {
  return (
    <article className="flex h-full flex-col gap-3 rounded-xl border border-line bg-card p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <span
          className="text-base text-primary"
          aria-label={`${reviewsStrings.ratingLabel}: ${review.rating}/5`}
        >
          {"★".repeat(review.rating)}
          <span className="text-mute">{"☆".repeat(5 - review.rating)}</span>
        </span>
        {review.verified ? (
          <span
            className="rounded-full border border-success/40 bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success"
            title={reviewsStrings.verifiedBadge}
          >
            ✓ {reviewsStrings.verifiedBadge}
          </span>
        ) : null}
      </header>

      <p className="flex-1 text-sm leading-relaxed text-ink">{review.text}</p>

      <footer className="flex items-center gap-3 border-t border-line pt-3">
        {review.photoUrl ? (
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-page">
            <Image
              src={review.photoUrl}
              alt={reviewsStrings.photoAlt}
              fill
              sizes="48px"
              className="object-cover"
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {review.authorName}
          </p>
          {review.publishedAt ? (
            <p className="text-xs text-mute">
              {RU_DATE.format(new Date(review.publishedAt))}
            </p>
          ) : null}
        </div>
      </footer>
    </article>
  );
}
