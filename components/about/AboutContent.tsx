import { ArrowUpRight, CalendarPlus } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/landing/Reveal";
import { BrandMark } from "@/components/ui/BrandMark";
import { BlurReveal } from "@/components/motion/BlurReveal";
import { ru } from "@/lib/i18n/ru";
import { AboutSectionHeading } from "./AboutSectionHeading";
import { ValuesRail } from "./ValuesRail";
import { SpecSheet } from "./SpecSheet";
import { ContactsBlock } from "./ContactsBlock";
import { AboutReviews } from "./AboutReviews";
import { StickyTocRail, type TocItem } from "./client/StickyTocRail";
import { WordReveal } from "./client/WordReveal";
import type { AboutData } from "./types";

// The section blocks (story columns, spec sheet, contacts) share one viewport
// trigger (~60% in view) so the page reveals as a consistent set; WordReveal
// headings/prose default to the same 0.6. The grids (values, reviews) fire
// earlier, on their own low ENTRANCE_VIEWPORT, so their stagger plays as the
// grid's top edge appears.
const IN_VIEW = 0.6;

// Stable, index-free key for the static story paragraphs (split from one text
// blob, never reordered) — a small djb2 hash keeps React keys content-derived
// instead of leaning on the array index.
function paragraphKey(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

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
        {/* Watermark brand mark — positioned on the static wrapper so the
            entrance's transform (scale) never fights the -translate-y-1/2. */}
        <div className="pointer-events-none absolute right-0 top-1/2 hidden h-[clamp(280px,32vw,500px)] w-auto -translate-y-1/2 md:block">
          <BlurReveal as="div" trigger="mount" delay={0.2} className="h-full">
            <BrandMark className="h-full w-auto" />
          </BlurReveal>
        </div>
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
          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <BlurReveal as="div" trigger="mount" delay={0.45} index={0} className="max-sm:w-full">
              <Button href="/book" size="lg" radius="rounded-xl" className="gap-2 max-sm:w-full">
                <CalendarPlus className="size-5" aria-hidden />
                {t.ctaLabel}
              </Button>
            </BlurReveal>
            <BlurReveal as="div" trigger="mount" delay={0.45} index={1} className="max-sm:w-full">
              <Button
                href="/services"
                variant="secondary"
                size="lg"
                radius="rounded-xl"
                className="group gap-2 max-sm:w-full"
              >
                {ru.nav.services}
                <ArrowUpRight
                  className="size-5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Button>
            </BlurReveal>
          </div>
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
              <div className="relative">
                {/* The accent rule beside the pull-quote — its own element so it
                    can play the house blur entrance as the quote streams in. */}
                <BlurReveal
                  as="span"
                  trigger="in-view"
                  className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary"
                />
                <WordReveal
                  as="blockquote"
                  text={paragraphs[0]}
                  stagger={0.03}
                  className="pl-6 font-display text-2xl font-medium leading-snug text-ink text-balance sm:text-3xl"
                />
              </div>
              {paragraphs.length > 1 ? (
                <Reveal
                  amount={IN_VIEW}
                  delay={0.1}
                  className="mt-8 grid gap-5 text-mute sm:grid-cols-2 sm:gap-8"
                >
                  {paragraphs.slice(1).map((p) => (
                    <p key={paragraphKey(p)}>{p}</p>
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
              <AboutReviews testimonials={testimonials} />
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
