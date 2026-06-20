// Default loading skeleton shown while a route segment streams. Per-segment
// loading.tsx files (e.g. app/(public)/{about,faq,services,catalog}/loading.tsx)
// override this with a shape that matches their own layout; this generic one
// covers the rest (header + lead + a card grid).

import { Section } from "@/components/ui/Section";
import { Skeleton } from "@/components/ui/Skeleton";
import { ru } from "@/lib/i18n/ru";

export default function Loading() {
  return (
    <Section>
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-32 rounded-full" />
        <Skeleton className="h-12 w-2/3 max-w-xl rounded-2xl" />
        <Skeleton className="h-6 w-3/4 max-w-2xl" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
          ))}
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {ru.common.loading}
      </p>
    </Section>
  );
}
