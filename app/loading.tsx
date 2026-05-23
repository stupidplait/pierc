// Default loading skeleton shown while a route segment streams.
// Per-segment loading.tsx files (e.g., app/(public)/catalog/loading.tsx)
// can override this for tighter content matches.

import { Section } from "@/components/ui/Section";

export default function Loading() {
  return (
    <Section>
      <div className="flex flex-col gap-6">
        <div
          aria-hidden="true"
          className="h-8 w-32 animate-pulse rounded-full bg-card"
        />
        <div
          aria-hidden="true"
          className="h-12 w-2/3 max-w-xl animate-pulse rounded-2xl bg-card"
        />
        <div
          aria-hidden="true"
          className="h-6 w-3/4 max-w-2xl animate-pulse rounded-xl bg-card"
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              aria-hidden="true"
              className="aspect-[4/5] animate-pulse rounded-2xl bg-card"
            />
          ))}
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        Загрузка…
      </p>
    </Section>
  );
}
