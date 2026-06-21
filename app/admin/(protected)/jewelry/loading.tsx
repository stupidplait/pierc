// Catalog (jewelry) loading skeleton — mirrors the catalog page: hero + "add"
// pill, the responsive toolbar, then the board card with status tabs docked to
// its top edge. Convention: bare blocks use bg-card; blocks inside a card
// surface use bg-ink/10.

import { CARD } from "@/components/admin/form/styles";
import { BoardSkeletonV2 } from "@/components/admin/jewelry/v2/BoardSkeleton";

const CHIP_WIDTHS = ["w-16", "w-28", "w-32", "w-36", "w-28", "w-28"];

export default function Loading() {
  return (
    <div aria-hidden="true">
      {/* Hero — title + lead, "add" pill (full-width on mobile). */}
      <header className="mb-8 flex flex-col gap-4 pt-1 sm:mb-10 sm:flex-row sm:items-end sm:justify-between sm:pt-3">
        <div className="min-w-0">
          <div className="h-9 w-44 animate-pulse rounded-2xl bg-card sm:h-11 lg:h-14" />
          <div className="mt-3 h-5 w-72 max-w-full animate-pulse rounded-lg bg-card" />
        </div>
        <div className="h-11 w-full animate-pulse rounded-xl bg-card sm:w-40" />
      </header>

      <div className="flex flex-col gap-6 sm:gap-8">
        {/* Toolbar — search row, then the controls cluster. */}
        <div className={`${CARD} flex flex-col gap-2.5 p-2.5 sm:flex-row sm:flex-wrap sm:items-center`}>
          <div className="h-11 w-full animate-pulse rounded-xl bg-ink/10 sm:min-w-48 sm:flex-1" />
          <div className="flex items-center gap-2.5">
            <div className="h-11 min-w-0 flex-1 animate-pulse rounded-xl bg-ink/10 sm:w-40 sm:flex-none" />
            <div className="size-11 shrink-0 animate-pulse rounded-xl bg-ink/10" />
            <div className="size-11 shrink-0 animate-pulse rounded-xl bg-ink/10" />
            <span className="h-6 w-px shrink-0 bg-line" aria-hidden="true" />
            <div className="size-11 shrink-0 animate-pulse rounded-xl bg-ink/10" />
          </div>
        </div>

        {/* Board — status tabs docked to the top, then the divided list. */}
        <div className={`${CARD} overflow-hidden`}>
          <div className="flex items-center gap-1 overflow-hidden border-b border-line/70 px-2 py-1.5 sm:flex-wrap sm:gap-0.5 sm:px-3">
            {CHIP_WIDTHS.map((w, i) => (
              <div
                key={i}
                className={`h-9 shrink-0 ${w} animate-pulse rounded-lg bg-ink/10`}
              />
            ))}
          </div>
          <BoardSkeletonV2 count={6} />
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        Загрузка…
      </p>
    </div>
  );
}
