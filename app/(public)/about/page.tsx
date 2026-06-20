import type { Metadata } from "next";
import { ru, seoStrings } from "@/lib/i18n/ru";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { buildLocalBusinessJsonLd } from "@/lib/seo/local-business";
import { APP_URL } from "@/lib/app-url";
import {
  getAboutBody,
  getPublicSettings,
  getFeaturedTestimonials,
} from "@/lib/public/queries";
import { ContentBackdrop } from "@/components/backdrop/ContentBackdrop";
import { JsonLd } from "@/components/seo/JsonLd";
import type { AboutData } from "@/components/about/types";
import { AboutContent } from "@/components/about/AboutContent";

export const metadata: Metadata = buildPageMetadata({
  title: seoStrings.about.title,
  description: seoStrings.about.description,
  path: "/about",
});

export default async function AboutPage() {
  // All three reads are admin-edited, visitor-identical content, so each is
  // wrapped in unstable_cache (tags about/settings/reviews) and shared across
  // requests instead of hitting Neon per view. Fetched in parallel — no
  // waterfall.
  const [body, settings, testimonials] = await Promise.all([
    getAboutBody(),
    getPublicSettings(),
    getFeaturedTestimonials(),
  ]);

  const paragraphs: string[] = [];
  for (const raw of body.split(/\n{2,}/)) {
    const trimmed = raw.trim();
    if (trimmed) paragraphs.push(trimmed);
  }

  const data: AboutData = {
    paragraphs,
    email: settings?.contactEmail ?? null,
    phone: settings?.contactPhone ?? null,
    address: settings?.contactAddress ?? null,
    hours: settings?.workingHoursHint ?? null,
    testimonials,
    t: ru.pages.about,
    servicesLabel: ru.nav.services,
  };

  // LocalBusiness JSON-LD from the same Settings row; null suppresses the tag.
  const localBusiness = buildLocalBusinessJsonLd({ baseUrl: APP_URL, settings });

  return (
    <>
      {/* Ambient backdrop shared with the auth + account pages: a masked grid
          and a field of floating dots (CSS only, no WebGL). */}
      <ContentBackdrop />

      <JsonLd data={localBusiness} />

      <AboutContent data={data} />
    </>
  );
}
