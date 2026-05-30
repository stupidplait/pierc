import { ru } from "@/lib/i18n/ru";

// Small presentational atoms shared by the reviews list cards and the edit
// page header. Pure JSX (no hooks / server-only APIs), so they render happily
// inside both the client board and the server edit page.

const t = ru.admin.reviews;

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={filled ? "text-accent" : "text-ink/20"}
    >
      <path
        d="M8 1.6l1.78 3.93 4.3.47-3.2 2.9.87 4.23L8 11.5l-3.75 2.03.87-4.23-3.2-2.9 4.3-.47L8 1.6Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Read-only 5-star rating, accent-filled up to `value`. */
export function StarRating({ value }: { value: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`${value} / 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} filled={n <= value} />
      ))}
    </span>
  );
}

/** "Verified client" — review tied to a real appointment. */
export function VerifiedChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M3.5 8.5l3 3 6-7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {t.cols.verified}
    </span>
  );
}

/** "Featured" — surfaced on the public /about page. */
export function FeaturedChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M8 1.6l1.78 3.93 4.3.47-3.2 2.9.87 4.23L8 11.5l-3.75 2.03.87-4.23-3.2-2.9 4.3-.47L8 1.6Z"
          fill="currentColor"
        />
      </svg>
      {t.cols.featured}
    </span>
  );
}

/** Linked-jewelry tag rendered under a review card. */
export function JewelryChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center truncate rounded-md border border-line bg-ink/3 px-2 py-0.5 text-[11px] text-mute">
      {children}
    </span>
  );
}
