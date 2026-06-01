// Catalog board list skeleton — the divided list of placeholder rows, without
// the surrounding CARD (callers wrap it so the same skeleton sits inside the
// board card on first load *and* while a filter/search transition is pending).
//
// Shared by app/admin/(protected)/jewelry/loading.tsx (first paint) and
// JewelryCatalog (the in-place "searching…" state the admin asked for). Row
// layout mirrors JewelryList: thumb · name+meta · price+status · stock adjuster.
// Convention: blocks inside a card surface use bg-ink/10.

export function JewelryListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul aria-hidden="true" className="divide-y divide-line/70">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 px-4 py-3 sm:px-5">
          <div className="size-14 shrink-0 animate-pulse rounded-xl bg-ink/10" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-40 max-w-full animate-pulse rounded bg-ink/10" />
            <div className="mt-2 h-3 w-56 max-w-full animate-pulse rounded bg-ink/10" />
          </div>
          <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
            <div className="h-4 w-16 animate-pulse rounded bg-ink/10" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-ink/10" />
          </div>
          {/* stock adjuster: −  count  +  (rounded squares, matches StockAdjuster) */}
          <div className="flex shrink-0 items-center gap-1">
            <div className="size-7 animate-pulse rounded-lg bg-ink/10" />
            <div className="h-5 w-8 animate-pulse rounded bg-ink/10" />
            <div className="size-7 animate-pulse rounded-lg bg-ink/10" />
          </div>
        </li>
      ))}
    </ul>
  );
}
