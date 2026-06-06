import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { reviewsStrings, ru, seoStrings } from "@/lib/i18n/ru";
import { buildPageMetadata } from "@/lib/seo/metadata";
import {
  buildLocalBusinessJsonLd,
  jsonLdScript,
} from "@/lib/seo/local-business";
import { AuthBackdrop } from "@/components/landing/auth/AuthBackdrop";
import type { TestimonialCardData } from "@/components/public/TestimonialCard";
import type { AboutData } from "@/components/about/types";
import { AboutContent } from "@/components/about/AboutContent";

export const metadata: Metadata = buildPageMetadata({
  title: seoStrings.about.title,
  description: seoStrings.about.description,
  path: "/about",
});

// Skip build-time prerender — reads SiteContent + Reviews on every request.
export const dynamic = "force-dynamic";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

interface AboutBody {
  body?: string;
}

export default async function AboutPage() {
  const [row, settings, testimonialsRaw] = await Promise.all([
    prisma.siteContent.findUnique({ where: { key: "about" } }),
    prisma.settings.findUnique({ where: { id: "default" } }),
    prisma.review.findMany({
      where: { status: "PUBLISHED", featured: true },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 6,
      select: {
        id: true,
        rating: true,
        text: true,
        authorName: true,
        photoUrl: true,
        appointmentId: true,
        publishedAt: true,
      },
    }),
  ]);

  const body = (row?.content as AboutBody | null)?.body ?? "";
  const paragraphs: string[] = [];
  for (const raw of body.split(/\n{2,}/)) {
    const trimmed = raw.trim();
    if (trimmed) paragraphs.push(trimmed);
  }

  const testimonials: TestimonialCardData[] = testimonialsRaw.map((r) => ({
    id: r.id,
    rating: r.rating,
    text: r.text,
    authorName: r.authorName,
    photoUrl: r.photoUrl,
    verified: r.appointmentId != null,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
  }));

  const data: AboutData = {
    paragraphs,
    email: settings?.contactEmail ?? null,
    phone: settings?.contactPhone ?? null,
    address: settings?.contactAddress ?? null,
    hours: settings?.workingHoursHint ?? null,
    testimonials,
    t: ru.pages.about,
    reviewsHeading: reviewsStrings.about.heading,
    reviewsLead: reviewsStrings.about.lead,
  };

  // LocalBusiness JSON-LD from the same Settings row; null suppresses the tag.
  const localBusiness = buildLocalBusinessJsonLd({ baseUrl: APP_URL, settings });

  return (
    <>
      {/* Ambient backdrop shared with the auth + account pages: a masked grid
          and a field of floating dots (CSS only, no WebGL). */}
      <AuthBackdrop />

      {localBusiness ? (
        <script
          type="application/ld+json"
          // Trusted, server-built JSON-LD; jsonLdScript escapes `<`/`>`/`&` so
          // admin-entered settings can't break out of the <script>.
          // react-doctor-disable-next-line react-doctor/no-danger
          dangerouslySetInnerHTML={{ __html: jsonLdScript(localBusiness) }}
        />
      ) : null}

      <AboutContent data={data} />
    </>
  );
}
