import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/landing/Reveal";
import { BrandMark } from "@/components/ui/BrandMark";
import { TestimonialCard } from "@/components/public/TestimonialCard";
import { ru } from "@/lib/i18n/ru";
import { AboutSectionHeading } from "./AboutSectionHeading";
import { ValuesRail } from "./ValuesRail";
import { SpecSheet } from "./SpecSheet";
import { ContactsBlock } from "./ContactsBlock";
import { StickyTocRail, type TocItem } from "./client/StickyTocRail";
import { WordReveal } from "./client/WordReveal";
import type { AboutData } from "./types";

// All section reveals share one viewport trigger (~60% in view) so the page
// reveals as a consistent set. WordReveal headings/prose default to the same
// 0.6.
const IN_VIEW = 0.6;
const IN_VIEW_TALL = 0.6;

/**
 * The About page — an "Instrument Dossier": magazine asymmetry instead of a
 * centered stack. A narrow sticky table-of-contents rail on the left
 * (scroll-spy + smooth in-page scroll) and a wide content column on the right.
 * The studio story opens as a display pull-quote; the standards are the
 * centerpiece, rendered as a precision spec sheet.
 *
 * Entry choreography: as each section reaches ~60% in view its prose streams in
 * word-by-word and its heading lands a beat after the body copy.
 */
export function AboutContent({ data }: { data: AboutData }) {
  const { t, paragraphs, testimonials } = data;

  const toc: TocItem[] = [
    { id: "approach", label: t.valuesHeading },
    { id: "standards", label: t.materialsHeading },
    ...(testimonials.length > 0
      ? [{ id: "reviews", label: data.reviewsHeading }]
      : []),
    { id: "contact", label: t.contactsHeading },
  ];

  return (
    <Section className="relative z-10">
      {/* Hero — oversized statement, brand mark (X-in-ring) set into the
          upper-right where it reads as a quiet watermark on the void. */}
      <div className="relative mb-16 sm:mb-24">
        <BrandMark className="pointer-events-none absolute right-0 top-1/2 hidden h-[clamp(240px,28vw,420px)] w-auto -translate-y-1/2 md:block" />
        <div className="relative z-10 flex min-h-[50svh] max-w-3xl flex-col justify-center lg:min-h-[56svh]">
          <WordReveal
            as="h1"
            text={t.title}
            delay={0.25}
            className="font-display text-5xl font-medium tracking-tight text-ink text-balance sm:text-7xl"
          />
          <WordReveal
            as="p"
            text={t.lead}
            delay={0.05}
            className="mt-6 max-w-xl text-lg text-mute text-balance"
          />
          <Reveal
            amount={IN_VIEW}
            delay={0.45}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Button href="/book" size="lg" radius="rounded-xl">
              {t.ctaLabel}
            </Button>
            <Button
              href="/services"
              variant="secondary"
              size="lg"
              radius="rounded-xl"
            >
              {ru.nav.services}
            </Button>
          </Reveal>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-16">
        {/* Sticky dossier index (lg+ only). */}
        <div className="hidden lg:block">
          <div className="sticky top-24">
            <StickyTocRail items={toc} />
          </div>
        </div>

        {/* Content column. */}
        <div className="space-y-16 sm:space-y-24">
          {/* Studio story — display pull-quote + supporting columns. */}
          {paragraphs.length === 0 ? (
            <p className="text-mute">{t.stub}</p>
          ) : (
            <div>
              <WordReveal
                as="blockquote"
                text={paragraphs[0]}
                stagger={0.03}
                className="border-l-2 border-primary pl-6 font-display text-2xl font-medium leading-snug text-ink text-balance sm:text-3xl"
              />
              {paragraphs.length > 1 ? (
                <Reveal
                  amount={IN_VIEW}
                  delay={0.1}
                  className="mt-8 grid gap-5 text-mute sm:grid-cols-2 sm:gap-8"
                >
                  {paragraphs.slice(1).map((p, i) => (
                    <p key={`${i}-${p.slice(0, 24)}`}>{p}</p>
                  ))}
                </Reveal>
              ) : null}
            </div>
          )}

          <section id="approach" className="scroll-mt-24">
            <AboutSectionHeading
              animated
              eyebrow={t.valuesEyebrow}
              title={t.valuesHeading}
              lead={t.valuesLead}
            />
            <ValuesRail items={t.values} />
          </section>

          <section id="standards" className="scroll-mt-24">
            <AboutSectionHeading
              animated
              eyebrow={t.materialsEyebrow}
              title={t.materialsHeading}
              lead={t.materialsLead}
            />
            <Reveal amount={IN_VIEW} delay={0.15}>
              <SpecSheet items={t.materials} />
            </Reveal>
          </section>

          {testimonials.length > 0 ? (
            <section id="reviews" className="scroll-mt-24">
              <AboutSectionHeading
                animated
                eyebrow={t.reviewsEyebrow}
                title={data.reviewsHeading}
                lead={data.reviewsLead}
              />
              <Reveal amount={IN_VIEW_TALL} delay={0.15}>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {testimonials.map((r) => (
                    <li key={r.id}>
                      <TestimonialCard review={r} />
                    </li>
                  ))}
                </ul>
              </Reveal>
            </section>
          ) : null}

          <section id="contact" className="scroll-mt-24">
            <AboutSectionHeading
              animated
              eyebrow={t.contactsEyebrow}
              title={t.contactsHeading}
              lead={t.contactsLead}
            />
            <Reveal amount={IN_VIEW} delay={0.15}>
              <ContactsBlock data={data} />
            </Reveal>
          </section>
        </div>
      </div>
    </Section>
  );
}
