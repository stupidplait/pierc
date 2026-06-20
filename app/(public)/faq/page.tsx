import type { Metadata } from "next";
import { getPublishedFaqItems } from "@/lib/public/queries";
import { ru, seoStrings } from "@/lib/i18n/ru";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { buildFaqJsonLd } from "@/lib/seo/local-business";
import { JsonLd } from "@/components/seo/JsonLd";
import { Section } from "@/components/ui/Section";
import { ContentBackdrop } from "@/components/backdrop/ContentBackdrop";
import { WordReveal } from "@/components/motion/WordReveal";
import { categorizeFaq } from "@/components/faq/faqData";
import { FaqContent } from "@/components/faq/FaqContent";

export const metadata: Metadata = buildPageMetadata({
  title: seoStrings.faq.title,
  description: seoStrings.faq.description,
  path: "/faq",
});

export default async function FaqPage() {
  const rows = await getPublishedFaqItems();

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
      <ContentBackdrop />

      <Section className="relative z-10">
        <JsonLd data={rows.length > 0 ? buildFaqJsonLd(rows) : null} />

        {/* Hero — title + subtitle stream in word-by-word (WordReveal), the
            same entry choreography as the /about hero. The heading lands a beat
            after the subtitle (larger delay). */}
        <header className="mt-8 mb-12 sm:mt-12 sm:mb-16">
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
          <FaqContent groups={groups} />
        )}
      </Section>
    </>
  );
}
