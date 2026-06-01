// Catalog (jewelry) loading skeleton. The protected group's loading.tsx is
// dashboard-shaped (a Status Board), so without this per-segment override the
// catalog would flash the dashboard placeholder on navigation. This mirrors
// app/admin/(protected)/jewelry/page.tsx: hero header + "add" pill, the search
// toolbar, then the board card with status tabs docked to its top edge.
// Convention (matches the dashboard skeleton): bare blocks on the page use
// bg-card; blocks sitting inside a card surface use bg-ink/10.

import { CARD } from "@/components/admin/form/styles";
import { JewelryListSkeleton } from "@/components/admin/jewelry/JewelryBoardSkeleton";

// Varied chip widths so the status tabs read like real labels + counts instead
// of a row of identical bars.
const CHIP_WIDTHS = ["w-16", "w-28", "w-32", "w-36", "w-28", "w-28"];

export default function Loading() {
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-6xl">
      {/* Hero header — title + lead on the left, "add" pill on the right. */}
      <header className="mb-10 flex flex-col gap-4 pt-2 sm:mb-12 sm:flex-row sm:items-end sm:justify-between sm:pt-4">
        <div>
          <div className="h-10 w-48 animate-pulse rounded-2xl bg-card sm:h-12" />
          <div className="mt-3 h-5 w-80 max-w-full animate-pulse rounded-lg bg-card" />
        </div>
        <div className="h-11 w-40 shrink-0 animate-pulse rounded-xl bg-card" />
      </header>

      <div className="flex flex-col gap-8">
        {/* Toolbar — search (flex-1) · categories · two icon-only quick-filter
            chips · reset, split off to the right by a hairline. Mirrors
            JewelryFilters: the chips and reset are size-11 squares, not bars. */}
        <div className={`${CARD} flex flex-wrap items-center gap-2.5 p-2.5`}>
          <div className="h-11 min-w-48 flex-1 animate-pulse rounded-xl bg-ink/10" />
          <div className="h-11 w-40 animate-pulse rounded-xl bg-ink/10" />
          <div className="size-11 animate-pulse rounded-xl bg-ink/10" />
          <div className="size-11 animate-pulse rounded-xl bg-ink/10" />
          <div className="ml-auto flex items-center gap-2">
            <span className="h-6 w-px bg-line" aria-hidden="true" />
            <div className="size-11 animate-pulse rounded-xl bg-ink/10" />
          </div>
        </div>

        {/* Board — status tabs docked to the top, then the divided list. Shares
            its list skeleton with the in-place "searching…" state in
            JewelryCatalog. */}
        <div className={`${CARD} overflow-hidden`}>
          <div className="flex flex-wrap items-center gap-0.5 border-b border-line/70 px-2 py-1.5 sm:px-3">
            {CHIP_WIDTHS.map((w, i) => (
              <div
                key={i}
                className={`h-9 ${w} animate-pulse rounded-lg bg-ink/10`}
              />
            ))}
          </div>
          <JewelryListSkeleton count={6} />
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        Загрузка…
      </p>
    </div>
  );
}
