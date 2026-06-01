// Bookings loading skeleton. The protected group's loading.tsx is
// dashboard-shaped (a Status Board), so without this per-segment override the
// bookings screen would flash the dashboard placeholder on navigation. This
// mirrors app/admin/(protected)/bookings/page.tsx: hero header, the 3-up summary
// strip, the status chip strip over the search row, then the two-pane console
// (left rail of grouped rows + right dossier pane).
// Convention (matches the dashboard/jewelry skeletons): bare blocks on the page
// use bg-card; blocks sitting inside a card surface use bg-ink/10.

import { CARD } from "@/components/admin/form/styles";

// Any + the four statuses → five chips. Varied widths so the strip reads like
// real labels + counts rather than a row of identical bars.
const CHIP_WIDTHS = ["w-16", "w-32", "w-28", "w-24", "w-24"];

// Rail groups with a per-group row count — mirrors the real console.
const RAIL_GROUPS = [4, 3];

function SummaryCard() {
  return (
    <div className={`${CARD} p-4 sm:p-5`}>
      <div className="h-3 w-14 animate-pulse rounded bg-ink/10" />
      <div className="mt-2 h-7 w-10 animate-pulse rounded bg-ink/10" />
    </div>
  );
}

// One left-rail row — tone dot · piece + client · price. Mirrors the booking
// console rail item (two text lines), so it's taller than the appointments one.
function RailRow() {
  return (
    <div className="flex items-center gap-2.5 py-2 pl-3 pr-2.5">
      <div className="size-1.5 shrink-0 rounded-full bg-ink/15" />
      <div className="min-w-0 flex-1">
        <div className="h-4 w-28 max-w-full animate-pulse rounded bg-ink/10" />
        <div className="mt-1 h-3 w-20 max-w-full animate-pulse rounded bg-ink/10" />
      </div>
      <div className="h-3 w-12 shrink-0 animate-pulse rounded bg-ink/10" />
    </div>
  );
}

// One labelled dossier block — small-caps heading over a couple of lines.
function DossierBlock({ lines = 2 }: { lines?: number }) {
  return (
    <div>
      <div className="mb-2 h-3 w-24 animate-pulse rounded bg-ink/10" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="mt-1.5 h-4 w-40 max-w-full animate-pulse rounded bg-ink/10"
        />
      ))}
    </div>
  );
}

export default function Loading() {
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-6xl">
      {/* Hero header — title + lead. */}
      <header className="mb-8 pt-2 sm:mb-10 sm:pt-4">
        <div className="h-10 w-52 animate-pulse rounded-2xl bg-card sm:h-12" />
        <div className="mt-3 h-5 w-96 max-w-full animate-pulse rounded-lg bg-card" />
      </header>

      {/* Summary strip — total · reserved · today. */}
      <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        <SummaryCard />
        <SummaryCard />
        <SummaryCard />
      </div>

      {/* Filters — status chip strip, then the search row. */}
      <div className="mb-7 flex flex-col gap-3">
        <div className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-line bg-card p-1">
          {CHIP_WIDTHS.map((w, i) => (
            <div
              key={i}
              className={`h-8 ${w} animate-pulse rounded-lg bg-ink/10`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 flex-1 animate-pulse rounded-xl bg-card sm:max-w-xs" />
          <div className="h-9 w-24 animate-pulse rounded-xl bg-card" />
        </div>
      </div>

      {/* Console — left rail of grouped rows + right dossier pane. */}
      <div className="grid gap-5 lg:grid-cols-[19rem_1fr]">
        <div className="rounded-2xl border border-line bg-card p-2">
          {RAIL_GROUPS.map((rows, g) => (
            <div key={g} className="mb-1.5">
              <div className="mx-2.5 mb-1 mt-2 h-2.5 w-20 animate-pulse rounded bg-ink/10" />
              {Array.from({ length: rows }).map((_, i) => (
                <RailRow key={i} />
              ))}
            </div>
          ))}
        </div>

        <div className={`${CARD} h-fit p-6 sm:p-8`}>
          <div className="mb-5 flex items-center gap-3">
            <div className="h-5 w-24 animate-pulse rounded-full bg-ink/10" />
            <div className="h-3 w-28 animate-pulse rounded bg-ink/10" />
          </div>
          <div className="h-7 w-48 animate-pulse rounded bg-ink/10" />
          <div className="mt-2 h-4 w-40 max-w-full animate-pulse rounded bg-ink/10" />
          <div className="my-6 h-px w-full bg-line/70" />
          <div className="grid gap-6 sm:grid-cols-2">
            <DossierBlock />
            <DossierBlock lines={1} />
          </div>
          <div className="my-6 h-px w-full bg-line/70" />
          <div className="h-5 w-full max-w-xs animate-pulse rounded bg-ink/10" />
          <div className="my-6 h-px w-full bg-line/70" />
          <div className="flex gap-2.5">
            <div className="h-10 w-32 animate-pulse rounded-xl bg-ink/10" />
            <div className="h-10 w-28 animate-pulse rounded-xl bg-ink/10" />
          </div>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        Загрузка…
      </p>
    </div>
  );
}
