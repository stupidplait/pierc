// Admin dashboard loading skeleton — mirrors the dashboard (hero → 4-card metric
// strip → wide appointments list + quick-actions side rail) so the streamed
// placeholder matches the real responsive layout at every width. Renders inside
// the protected layout's content region.

import { SURFACE } from "@/components/admin/dashboard/shared";

function PanelSkeleton({
  rows = 4,
  className = "",
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={`${SURFACE} flex flex-col p-5 sm:p-6 lg:p-7 ${className}`}>
      <div className="flex items-center justify-between border-b border-ink/10 pb-3">
        <div className="h-3 w-24 animate-pulse rounded bg-ink/10" />
        <div className="h-3 w-4 animate-pulse rounded bg-ink/10" />
      </div>
      <div className="mt-5 flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="size-8 shrink-0 animate-pulse rounded-lg bg-ink/10" />
            <div className="min-w-0 flex-1">
              <div className="h-4 w-32 max-w-full animate-pulse rounded bg-ink/10" />
              <div className="mt-2 h-3 w-48 max-w-full animate-pulse rounded bg-ink/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      {/* Hero */}
      <div className="pt-1 sm:pt-3">
        <div className="h-9 w-44 animate-pulse rounded-2xl bg-card sm:h-11 lg:h-14" />
        <div className="mt-3 h-5 w-96 max-w-full animate-pulse rounded-lg bg-card" />
      </div>

      {/* Metric strip */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`${SURFACE} flex flex-col gap-3 p-4 sm:p-5`}>
            <div className="h-9 w-12 animate-pulse rounded bg-ink/10" />
            <div className="h-3 w-20 max-w-full animate-pulse rounded bg-ink/10" />
          </div>
        ))}
      </div>

      {/* Board — wide appointments list (stretches) + quick-actions side rail. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-stretch">
        <PanelSkeleton rows={8} className="lg:h-full" />
        <PanelSkeleton rows={6} />
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        Загрузка…
      </p>
    </div>
  );
}
