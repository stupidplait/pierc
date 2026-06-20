// Route-level loader for /about. Overrides the generic app/loading.tsx with a
// skeleton shaped like the "Instrument Dossier" layout (AboutHero + DossierLayout:
// a sticky TOC rail + a content column of pull-quote / values grid / spec sheet /
// contacts), so the stream → render swap reads as one continuous load with no
// layout shift.

import { Section } from "@/components/ui/Section";
import { Skeleton } from "@/components/ui/Skeleton";
import { ru } from "@/lib/i18n/ru";

export default function AboutLoading() {
  return (
    <Section>
      {/* Hero — oversized statement + lead + two CTAs. */}
      <div className="mb-16 flex min-h-[50svh] max-w-3xl flex-col justify-center gap-6 sm:mb-24">
        <Skeleton className="h-14 w-3/4 sm:h-20" />
        <Skeleton className="h-6 w-full max-w-xl" />
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-12 w-full sm:w-44" />
          <Skeleton className="h-12 w-full sm:w-44" />
        </div>
      </div>

      {/* Dossier: sticky TOC rail (lg+) + content column. */}
      <div className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-16">
        <div className="hidden flex-col gap-3 lg:flex">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-28 rounded" />
          ))}
        </div>

        <div className="space-y-16 sm:space-y-24">
          {/* Studio-story pull-quote. */}
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-5/6" />
          </div>
          {/* Values — three principle cards. */}
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
          {/* Spec sheet + contacts cards. */}
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {ru.common.loading}
      </p>
    </Section>
  );
}
