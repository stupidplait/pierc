// Admin loading skeleton — mirrors the dashboard Status Board (a hero header
// over a two-column board: quick-actions rail + activity feed) so the streamed
// placeholder matches the real layout instead of falling back to the public
// catalog-grid skeleton. Renders inside the protected layout's <main>.

import { SURFACE } from "@/components/admin/dashboard/shared";

function HeadingRow() {
  return (
    <div className="flex items-center justify-between border-b border-ink/10 pb-3">
      <div className="h-3 w-24 animate-pulse rounded bg-ink/10" />
      <div className="h-3 w-4 animate-pulse rounded bg-ink/10" />
    </div>
  );
}

export default function Loading() {
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-6xl">
      {/* Hero header — title + lead placeholders. */}
      <div className="mb-10 pt-2 sm:mb-12 sm:pt-4">
        <div className="h-11 w-44 animate-pulse rounded-2xl bg-card sm:h-14" />
        <div className="mt-4 h-5 w-96 max-w-full animate-pulse rounded-lg bg-card" />
      </div>

      <div className="grid items-stretch gap-6 lg:grid-cols-[20rem_1fr]">
        {/* Quick-actions rail. */}
        <div className={`${SURFACE} flex flex-col p-7 sm:p-8`}>
          <HeadingRow />
          <div className="mt-7 flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-11 animate-pulse rounded-xl border border-line bg-ink/5"
              />
            ))}
          </div>
        </div>

        {/* Activity feed timeline. */}
        <div className={`${SURFACE} p-7 sm:p-8`}>
          <HeadingRow />
          <div className="mt-7 ml-1 flex flex-col gap-2 border-l border-ink/10 pl-7">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-3 py-3">
                <div className="size-9 shrink-0 animate-pulse rounded-lg bg-ink/10" />
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-32 animate-pulse rounded bg-ink/10" />
                  <div className="mt-2 h-3 w-48 max-w-full animate-pulse rounded bg-ink/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        Загрузка…
      </p>
    </div>
  );
}
