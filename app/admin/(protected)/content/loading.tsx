// Loading skeleton for /admin/content. Mirrors the page: title + lead, the
// section tab strip, then a list-of-rows placeholder (the manager's default
// About tab swaps in once data resolves). Convention (matches the dashboard/
// jewelry skeletons): blocks sitting inside a card surface use bg-ink/10; bare
// blocks on the page use bg-card.

import { CARD } from "@/components/admin/form/styles";

export default function Loading() {
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-6xl">
      {/* Page header — title + lead. */}
      <div className="mb-8 flex flex-col gap-3 pt-2 sm:mb-10 sm:pt-4">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-card sm:h-12" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-card" />
      </div>

      {/* Section tab strip. */}
      <div className="h-11 w-80 max-w-full animate-pulse rounded-xl bg-card" />

      {/* About editor card — title + lead, tall textarea, save pill. */}
      <div className={`${CARD} mt-6 flex flex-col gap-6 p-7 sm:p-9`}>
        <div className="flex flex-col gap-2">
          <div className="h-6 w-44 animate-pulse rounded-lg bg-ink/10" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded bg-ink/10" />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="h-3 w-24 animate-pulse rounded bg-ink/10" />
          <div className="h-64 w-full animate-pulse rounded-xl bg-ink/10" />
        </div>
        <div className="h-11 w-32 animate-pulse rounded-xl bg-ink/10" />
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        Загрузка…
      </p>
    </div>
  );
}
