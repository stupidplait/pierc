// Slots loading skeleton. The protected group's loading.tsx is dashboard-shaped
// (a Status Board), so without this per-segment override the slots screen would
// flash the dashboard placeholder on navigation. This mirrors the reworked
// app/admin/(protected)/slots/page.tsx: a header (title + lead, single
// "planner" action), a slim bar ("today" + legend), then the week calendar with
// inline day/week nav in its date-header row.
// Convention (matches the dashboard/catalog skeletons): bare blocks on the page
// use bg-card; blocks sitting inside a card surface use bg-ink/10.

import { CARD } from "@/components/admin/form/styles";

// A few placeholder blocks scattered down a day column.
const SAMPLE_BLOCKS = [
  { top: 16, h: 44 },
  { top: 92, h: 60 },
  { top: 184, h: 44 },
  { top: 260, h: 76 },
];

// Shared gutter width — matches CalendarGrid's GUTTER (w-20).
const GUTTER = "w-20";

export default function Loading() {
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-6xl">
      {/* Header — title + lead left, single "planner" action right (default
          Button: h-11 px-4 rounded-xl, icon + "Планировщик"). */}
      <header className="mb-6 flex flex-col gap-4 pt-2 sm:flex-row sm:items-end sm:justify-between sm:pt-4">
        <div>
          <div className="h-10 w-28 animate-pulse rounded-2xl bg-card sm:h-12" />
          <div className="mt-3 h-5 w-96 max-w-full animate-pulse rounded-lg bg-card" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="h-11 w-36 animate-pulse rounded-xl bg-card" />
        </div>
      </header>

      {/* Slim bar — today + legend. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="h-8 w-20 animate-pulse rounded-lg bg-card" />
        <div className="h-4 w-56 animate-pulse rounded bg-card" />
      </div>

      {/* Calendar card with inline nav gutters. */}
      <div className={`${CARD} overflow-hidden p-3`}>
        {/* Header row: nav gutter + day labels + nav gutter. */}
        <div className="flex items-center border-b border-line/70 pb-2">
          <div className={`${GUTTER} flex shrink-0 items-center gap-1`}>
            <div className="size-8 animate-pulse rounded-lg bg-ink/10" />
            <div className="size-8 animate-pulse rounded-lg bg-ink/10" />
          </div>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-1 justify-center px-1">
              <div className="h-5 w-10 animate-pulse rounded bg-ink/10" />
            </div>
          ))}
          <div className={`${GUTTER} flex shrink-0 items-center justify-end gap-1`}>
            <div className="size-8 animate-pulse rounded-lg bg-ink/10" />
            <div className="size-8 animate-pulse rounded-lg bg-ink/10" />
          </div>
        </div>

        {/* Body: ruler + columns + matching right gutter. */}
        <div className="flex pt-2">
          <div className={`${GUTTER} shrink-0`} />
          {Array.from({ length: 7 }).map((_, col) => (
            <div
              key={col}
              className="relative h-88 flex-1 border-l border-line/50"
            >
              {(col % 2 === 0 ? SAMPLE_BLOCKS : SAMPLE_BLOCKS.slice(1)).map(
                (b, i) => (
                  <div
                    key={i}
                    className="absolute inset-x-1 animate-pulse rounded-lg bg-ink/10"
                    style={{ top: b.top, height: b.h }}
                  />
                ),
              )}
            </div>
          ))}
          <div className={`${GUTTER} shrink-0`} />
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        Загрузка…
      </p>
    </div>
  );
}
