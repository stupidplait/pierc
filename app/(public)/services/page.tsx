import type { Metadata } from "next";
import { ru, seoStrings } from "@/lib/i18n/ru";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { Section } from "@/components/ui/Section";
import { WordReveal } from "@/components/about/client/WordReveal";
import { FeaturedServiceCard } from "@/components/services/FeaturedServiceCard";
import { BlockReveal } from "@/components/services/entrance/BlockReveal";
import { StaggerGrid } from "@/components/services/entrance/StaggerGrid";
import { AuthBackdrop } from "@/components/landing/auth/AuthBackdrop";
import { getBookingPrefillUser, getPublishedServices } from "@/lib/public/queries";

export const metadata: Metadata = buildPageMetadata({
  title: seoStrings.services.title,
  description: seoStrings.services.description,
  path: "/services",
});

// Skip build-time prerender — reads admin-editable Service rows.
export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  // `getPublishedServices` is tag-cached (shared across visitors); the prefill
  // is per-user. Run them together so the dynamic prefill doesn't waterfall
  // behind the (usually cache-hit) service read.
  const [services, user] = await Promise.all([
    getPublishedServices(),
    getBookingPrefillUser(),
  ]);

  // The first service (by admin order) is the flagship — promoted into a large
  // detail card above the grid; everything else uses the shared ServiceCard.
  const [featured, ...rest] = services;
  const t = ru.pages.services;

  return (
    <>
      {/* Same drifting-grid backdrop as the auth + account pages — fixed
          behind the content, carrying the single magenta accent dot. The
          content rides above it at z-10. */}
      <AuthBackdrop />

      <Section className="relative z-10">
        {/* Title + lead reveal per unit (the title glyph-by-glyph, the lead a
            beat later word-by-word) — the blurred reveal echoes the cards'
            blur-focus entrance below. Replaces the static PageHeader here. */}
        <header className="mt-4 mb-12 sm:mt-8 sm:mb-16">
          <WordReveal
            text={t.title}
            as="h1"
            splitBy="char"
            amount={0.6}
            className="font-display text-4xl font-medium tracking-tight text-ink text-balance sm:text-6xl"
          />
          <WordReveal
            text={t.lead}
            as="p"
            delay={0.18}
            amount={0.6}
            className="mt-5 max-w-2xl text-lg text-mute text-balance sm:mt-6"
          />
        </header>

        {!featured ? (
          <p className="text-mute">{t.stub}</p>
        ) : (
          <>
            <BlockReveal delay={0.1}>
              <FeaturedServiceCard
                service={featured}
                user={user}
                bookLabel={t.book}
              />
            </BlockReveal>

            {rest.length > 0 ? (
              <StaggerGrid
                services={rest}
                user={user}
                bookLabel={t.book}
                className="mt-12 grid gap-5 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3"
              />
            ) : null}
          </>
        )}
      </Section>
    </>
  );
}
