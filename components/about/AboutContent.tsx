import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/motion/Reveal";
import { SectionHeading } from "@/components/motion/SectionHeading";
import { DossierLayout } from "@/components/motion/DossierLayout";
import { type TocItem } from "@/components/motion/StickyTocRail";
import { AboutHero } from "./AboutHero";
import { AboutStory } from "./AboutStory";
import { ValuesRail } from "./ValuesRail";
import { SpecSheet } from "./SpecSheet";
import { ContactsBlock } from "./ContactsBlock";
import { AboutReviews } from "./AboutReviews";
import type { AboutData } from "./types";

// The section blocks (spec sheet, contacts) share one viewport trigger (~60% in
// view) so the page reveals as a consistent set; the grids (values, reviews)
// fire earlier on their own low viewport so the stagger plays as the grid's top
// edge appears.
const IN_VIEW = 0.6;

/**
 * The About page — an "Instrument Dossier": magazine asymmetry instead of a
 * centered stack, via the shared {@link DossierLayout} (sticky TOC rail +
 * content column).
 *
 * This is the orchestrator: it owns the page scaffold (hero, the dossier shell,
 * the section order) and delegates each band to a focused component reading the
 * typed {@link AboutData} contract — {@link AboutHero}, {@link AboutStory},
 * ValuesRail, SpecSheet, AboutReviews, ContactsBlock.
 */
export function AboutContent({ data }: { data: AboutData }) {
  const { t, paragraphs, testimonials } = data;

  const toc: TocItem[] = [
    { id: "approach", label: t.valuesHeading },
    { id: "standards", label: t.materialsHeading },
    ...(testimonials.length > 0
      ? [{ id: "reviews", label: t.reviewsHeading }]
      : []),
    { id: "contact", label: t.contactsHeading },
  ];

  return (
    <Section className="relative z-10">
      <AboutHero t={t} servicesLabel={data.servicesLabel} />

      <DossierLayout toc={toc}>
        <AboutStory paragraphs={paragraphs} stub={t.stub} inView={IN_VIEW} />

        <section id="approach" className="scroll-mt-24">
          <SectionHeading
            eyebrow={t.valuesEyebrow}
            title={t.valuesHeading}
            lead={t.valuesLead}
          />
          <ValuesRail items={t.values} />
        </section>

        <section id="standards" className="scroll-mt-24">
          <SectionHeading
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
            <SectionHeading
              eyebrow={t.reviewsEyebrow}
              title={t.reviewsHeading}
              lead={t.reviewsLead}
            />
            <AboutReviews testimonials={testimonials} />
          </section>
        ) : null}

        <section id="contact" className="scroll-mt-24">
          <SectionHeading
            eyebrow={t.contactsEyebrow}
            title={t.contactsHeading}
            lead={t.contactsLead}
          />
          <Reveal amount={IN_VIEW} delay={0.15}>
            <ContactsBlock
              email={data.email}
              phone={data.phone}
              address={data.address}
              hours={data.hours}
              t={t}
            />
          </Reveal>
        </section>
      </DossierLayout>
    </Section>
  );
}
