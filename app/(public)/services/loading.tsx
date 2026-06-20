// Route-level loader for /services. Overrides the generic app/loading.tsx with a
// skeleton shaped like the services page (hero + a wide flagship card over a
// responsive card grid), so the stream → render swap reads as one load.

import { Section } from "@/components/ui/Section";
import { Skeleton } from "@/components/ui/Skeleton";
import { ru } from "@/lib/i18n/ru";

export default function ServicesLoading() {
  return (
    <Section>
      {/* Hero — title + lead. */}
      <div className="mb-12 mt-4 max-w-2xl space-y-5 sm:mb-16 sm:mt-8">
        <Skeleton className="h-12 w-1/2 sm:h-16" />
        <Skeleton className="h-6 w-full" />
      </div>

      {/* Flagship service card. */}
      <Skeleton className="h-64 rounded-2xl sm:h-56" />

      {/* Service grid. */}
      <div className="mt-12 grid gap-5 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {ru.common.loading}
      </p>
    </Section>
  );
}
