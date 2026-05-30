import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ru, seoStrings } from "@/lib/i18n/ru";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { jsonLdScript } from "@/lib/seo/local-business";
import { Section } from "@/components/ui/Section";
import { AuthBackdrop } from "@/components/landing/auth/AuthBackdrop";
import { WordReveal } from "@/components/about/client/WordReveal";
import { categorizeFaq } from "@/components/faq/faqData";
import { FaqInstrumentIndex } from "@/components/faq/FaqInstrumentIndex";

export const metadata: Metadata = buildPageMetadata({
  title: seoStrings.faq.title,
  description: seoStrings.faq.description,
  path: "/faq",
});

// Skip build-time prerender — reads live, admin-editable FAQ rows.
export const dynamic = "force-dynamic";

// schema.org FAQPage payload — lets search engines surface the Q&A as rich
// results. Built from the same published rows we render.
function buildFaqJsonLd(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: { "@type": "Answer", text: q.answer },
    })),
  };
}

export default async function FaqPage() {
  const rows = await prisma.fAQItem.findMany({
    where: { published: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, question: true, answer: true, category: true },
  });

  const groups = categorizeFaq(
    rows.map((r) => ({
      id: r.id,
      question: r.question,
      answer: r.answer,
      categoryKey: r.category,
    })),
  );

  return (
    <>
      {/* Same drifting-grid + dotted backdrop as the other content pages. */}
      <AuthBackdrop />

      <Section className="relative z-10">
        {rows.length > 0 ? (
          <script
            type="application/ld+json"
            // Server-rendered, trusted JSON we built ourselves.
            dangerouslySetInnerHTML={{
              __html: jsonLdScript(buildFaqJsonLd(rows)),
            }}
          />
        ) : null}

        {/* Hero — title + subtitle stream in word-by-word (WordReveal), the
            same entry choreography as the /about hero. The heading lands a beat
            after the subtitle (larger delay). */}
        <header className="mb-12 sm:mb-16">
          <WordReveal
            as="h1"
            text={ru.pages.faq.title}
            delay={0.25}
            className="font-display text-4xl font-medium tracking-tight text-ink text-balance sm:text-6xl"
          />
          <WordReveal
            as="p"
            text={ru.pages.faq.lead}
            delay={0.05}
            className="mt-5 max-w-2xl text-lg text-mute text-balance sm:mt-6"
          />
        </header>

        {groups.length === 0 ? (
          <p className="text-mute">{ru.pages.faq.stub}</p>
        ) : (
          <FaqInstrumentIndex groups={groups} />
        )}
      </Section>
    </>
  );
}
