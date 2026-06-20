// Route-level loader for /faq. Overrides the generic app/loading.tsx with a
// skeleton shaped like the FAQ dossier (hero + DossierLayout: a sticky TOC rail +
// category sections, each a heading over a stack of full-width accordion cards),
// so the stream → render swap doesn't shift.

import { Section } from "@/components/ui/Section";
import { Skeleton } from "@/components/ui/Skeleton";
import { ru } from "@/lib/i18n/ru";

export default function FaqLoading() {
  return (
    <Section>
      {/* Hero — title + lead (no CTAs). */}
      <div className="mb-12 mt-8 max-w-2xl space-y-5 sm:mb-16 sm:mt-12">
        <Skeleton className="h-12 w-2/3 sm:h-16" />
        <Skeleton className="h-6 w-full" />
      </div>

      {/* Dossier: sticky TOC rail (lg+) + content column of category sections. */}
      <div className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-16">
        <div className="hidden flex-col gap-3 lg:flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-24 rounded" />
          ))}
        </div>

        <div className="space-y-16 sm:space-y-24">
          {Array.from({ length: 2 }).map((_, s) => (
            <div key={s}>
              {/* Section heading — eyebrow + title. */}
              <div className="mb-6 space-y-3">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-9 w-1/2" />
              </div>
              {/* Accordion cards. */}
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-2xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {ru.common.loading}
      </p>
    </Section>
  );
}
