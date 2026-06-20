import Link from "next/link";
import { ru } from "@/lib/i18n/ru";
import { Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/ui/PageHeader";

// Segment-scoped 404 for the (public) group. notFound() thrown inside a public
// route (e.g. catalog/[id]) renders this INSIDE the (public) layout, so the
// Header/Footer chrome stays — unlike the root app/not-found.tsx, which renders
// bare inside the root layout.
export default function PublicNotFound() {
  return (
    <Section>
      <PageHeader
        eyebrow="404"
        title="Страница не найдена"
        lead="Возможно, ссылка устарела или украшение сняли с продажи. Загляните в каталог — он точно живой."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/catalog"
            className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-soft focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page outline-none"
          >
            {ru.common.backToCatalog}
          </Link>
          <Link
            href="/"
            className="text-sm text-mute transition-colors hover:text-primary"
          >
            На главную →
          </Link>
        </div>
      </PageHeader>
    </Section>
  );
}
