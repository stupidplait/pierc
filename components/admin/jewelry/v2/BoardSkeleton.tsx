// Catalog board list skeleton (v2) — mirrors Board.tsx's responsive row: a
// 2-row card on mobile (identity + status, then price + stepper) collapsing to a
// single row from sm. Shared by the preview's loading.tsx (first paint) and the
// in-place "searching…" transition state. Blocks inside a card use bg-ink/10.

export function BoardSkeletonV2({ count = 6 }: { count?: number }) {
  return (
    <ul aria-hidden="true" className="divide-y divide-line/70">
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
            <div className="size-12 shrink-0 animate-pulse rounded-xl bg-ink/10 sm:size-14" />
            <div className="min-w-0 flex-1">
              <div className="h-4 w-40 max-w-full animate-pulse rounded bg-ink/10" />
              <div className="mt-2 h-3 w-56 max-w-full animate-pulse rounded bg-ink/10" />
            </div>
            {/* mobile price */}
            <div className="h-4 w-12 shrink-0 animate-pulse rounded bg-ink/10 sm:hidden" />
            {/* sm+ price over status */}
            <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
              <div className="h-4 w-16 animate-pulse rounded bg-ink/10" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-ink/10" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 sm:w-auto sm:justify-end">
            {/* mobile status badge */}
            <div className="h-5 w-20 animate-pulse rounded-full bg-ink/10 sm:hidden" />
            {/* stock stepper: −  count  +  */}
            <div className="flex shrink-0 items-center gap-1">
              <div className="size-7 animate-pulse rounded-lg bg-ink/10" />
              <div className="h-5 w-8 animate-pulse rounded bg-ink/10" />
              <div className="size-7 animate-pulse rounded-lg bg-ink/10" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
