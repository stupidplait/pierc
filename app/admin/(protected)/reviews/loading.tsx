// Reviews loading skeleton. The protected group's loading.tsx is
// dashboard-shaped (a Status Board), so without this per-segment override the
// reviews screen would flash the dashboard placeholder on navigation. This
// mirrors app/admin/(protected)/reviews/page.tsx: a hero header + "add" pill,
// the status chip strip + "featured only" toggle, then the
// "wall" view — a masonry of testimonial quote-cards.
// Convention (matches the dashboard/catalog skeletons): bare blocks on the page
// use bg-card; blocks sitting inside a card surface use bg-ink/10.

// "Все" + the three statuses → four chips. Varied widths so the strip reads like
// real labels + counts instead of a row of identical bars.
const CHIP_WIDTHS = ["w-16", "w-32", "w-36", "w-32"];

// Per-card shape — quote line count + which provenance chips show — so the wall
// reads like real testimonials of varying height rather than identical bars.
const CARDS = [
  { lines: 3, verified: true, featured: true },
  { lines: 5, verified: false, featured: false },
  { lines: 2, verified: true, featured: false },
  { lines: 4, verified: false, featured: false },
  { lines: 3, verified: true, featured: true },
  { lines: 6, verified: false, featured: false },
  { lines: 2, verified: false, featured: false },
  { lines: 4, verified: true, featured: false },
  { lines: 3, verified: false, featured: false },
];

// One placeholder quote-card — mirrors WallCard: rating + status corner, the
// quote body (variable line count), then the author footer.
function Card({
  lines,
  verified,
  featured,
}: {
  lines: number;
  verified: boolean;
  featured: boolean;
}) {
  return (
    <div className="mb-4 break-inside-avoid rounded-2xl border border-line bg-card p-5">
      {/* Rating + status corner */}
      <div className="flex items-start justify-between gap-3">
        <div className="h-4 w-24 animate-pulse rounded bg-ink/10" />
        <div className="h-5 w-20 animate-pulse rounded-full bg-ink/10" />
      </div>

      {/* Quote body */}
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`h-3.5 animate-pulse rounded bg-ink/10 ${
              i === lines - 1 ? "w-2/3" : "w-full"
            }`}
          />
        ))}
      </div>

      {/* Author footer */}
      <div className="mt-4 flex items-center gap-2 border-t border-line/70 pt-3">
        <div className="h-3.5 w-24 animate-pulse rounded bg-ink/10" />
        {verified ? (
          <div className="h-5 w-20 animate-pulse rounded-full bg-ink/10" />
        ) : null}
        {featured ? (
          <div className="h-5 w-24 animate-pulse rounded-full bg-ink/10" />
        ) : null}
        <div className="ml-auto h-3 w-12 animate-pulse rounded bg-ink/10" />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-6xl">
      {/* Hero header — title + lead only (the default "cluster" layout keeps the
          add action down on the toolbar, not up here). */}
      <header className="mb-8 pt-2 sm:mb-10 sm:pt-4">
        <div className="h-10 w-44 animate-pulse rounded-2xl bg-card sm:h-12" />
        <div className="mt-3 h-5 w-80 max-w-full animate-pulse rounded-lg bg-card" />
      </header>

      {/* Trial switchers row. */}
      <div className="mb-5 flex flex-wrap gap-5">
        <div className="h-7 w-40 animate-pulse rounded-lg bg-card" />
        <div className="h-7 w-32 animate-pulse rounded-lg bg-card" />
      </div>

      {/* Status filter strip (left) + favorites toggle & add pill (right). */}
      <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-line bg-card p-1">
          {CHIP_WIDTHS.map((w, i) => (
            <div key={i} className={`h-8 ${w} animate-pulse rounded-lg bg-ink/10`} />
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="h-10 w-40 animate-pulse rounded-xl bg-card" />
          <div className="h-10 w-28 animate-pulse rounded-xl bg-card" />
        </div>
      </div>

      {/* Wall — masonry of quote-card placeholders. */}
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        {CARDS.map((c, i) => (
          <Card key={i} {...c} />
        ))}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        Загрузка…
      </p>
    </div>
  );
}
