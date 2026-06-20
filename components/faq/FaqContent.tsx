"use client";

import { useId, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import {
  RevealStagger,
  RevealItem,
  revealItemVariants,
} from "@/components/motion/Reveal";
import { DossierLayout } from "@/components/motion/DossierLayout";
import { SectionHeading } from "@/components/motion/SectionHeading";
import { type TocItem } from "@/components/motion/StickyTocRail";
import { Card } from "@/components/shadcn/ui/card";
import { type FaqGroup, type FaqItem } from "./faqData";

/**
 * FaqContent — the published FAQ, built to read of a piece with the /about
 * (Dossier) page: it renders through the SAME shared {@link DossierLayout}
 * (sticky TOC rail + content column) and {@link SectionHeading} band, so the two
 * dossier pages can't drift apart. Only the per-question accordion is bespoke.
 *
 * Each question is a frosted-glass card; the accordion is button-driven with an
 * animated chevron + height/opacity body. Reduced motion is honoured app-wide by
 * MotionProvider; the accordion body additionally guards its height/opacity tween
 * with useReducedMotion (MotionConfig suppresses transforms, not value tweens).
 */

// Elevated card surface via the shared shadcn `Card` (same `bg-card` hairline
// panel as the profile/AccountView). `Card` supplies the rounded border + base
// shadow; we override only with the lighter shadow tuned for a stack of list
// cards, plus the accordion's clip + hover.
const CARD =
  "overflow-hidden shadow-elev transition-colors duration-200 hover:border-ink/25";

export function FaqContent({ groups }: { groups: FaqGroup[] }) {
  const toc: TocItem[] = groups.map((g) => ({
    id: `faq-${g.category.key}`,
    label: g.category.label,
  }));

  return (
    <DossierLayout toc={toc}>
      {groups.map((g) => (
        <section
          key={g.category.key}
          id={`faq-${g.category.key}`}
          aria-labelledby={`faqh-${g.category.key}`}
          className="scroll-mt-24"
        >
          <SectionHeading
            eyebrow={g.category.blurb}
            title={g.category.label}
            titleId={`faqh-${g.category.key}`}
            className="mb-6"
          />
          <RevealStagger
            amount={0.6}
            stagger={0.04}
            className="flex flex-col gap-3"
          >
            {g.items.map((item) => (
              <RevealItem key={item.id} variants={revealItemVariants}>
                <FaqCard item={item} />
              </RevealItem>
            ))}
          </RevealStagger>
        </section>
      ))}
    </DossierLayout>
  );
}

// One question — a glass card with a profile-style button accordion.
function FaqCard({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const contentId = useId();

  return (
    <Card className={CARD}>
      {/* Question is a real heading for a11y/SEO; Tailwind preflight makes it
          inherit size/weight so the button controls the styling. */}
      <h3>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={contentId}
          className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left text-base font-medium text-ink outline-none transition-transform active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset motion-reduce:transition-none sm:px-6 sm:py-5"
        >
          <span>{item.question}</span>
          <Chevron open={open} />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open ? (
          <m.div
            id={contentId}
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.24, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="whitespace-pre-line px-5 pb-5 text-mute sm:px-6 sm:pb-6">
              {item.answer}
            </p>
          </m.div>
        ) : null}
      </AnimatePresence>
    </Card>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      className={`shrink-0 text-mute transition-transform duration-200 motion-reduce:transition-none ${
        open ? "rotate-180" : ""
      }`}
    >
      <path
        d="M5 7.5 10 12.5 15 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
