"use client";

import { useId, useState } from "react";
import {
  AnimatePresence,
  m,
  MotionConfig,
  useReducedMotion,
} from "framer-motion";
import {
  RevealStagger,
  RevealItem,
  revealItemVariants,
} from "@/components/landing/Reveal";
import { BlurReveal } from "@/components/motion/BlurReveal";
import { StickyTocRail, type TocItem } from "@/components/about/client/StickyTocRail";
import { Card } from "@/components/shadcn/ui/card";
import { type FaqGroup, type FaqItem } from "./faqData";

/**
 * "Instrument Index" FAQ — built to read of a piece with the /about (Dossier)
 * page: the same narrow sticky table-of-contents rail on the left (the shared
 * StickyTocRail, with its own scroll-spy + smooth in-page scroll) and a wide
 * content column on the right.
 *
 * Each question is a frosted-glass card (matching the profile's surface) so it
 * reads clearly above the dotted grid backdrop instead of dissolving into it.
 * Accordions are button-driven with an animated chevron + height/opacity body,
 * like the profile's appointment cards. Section headers reveal (fade-up) and
 * the cards stagger in — the site-standard entry choreography.
 *
 * Everything is wrapped in MotionConfig reducedMotion="user" so all motion
 * (rail, reveals, accordions) honors prefers-reduced-motion.
 */

// Elevated card surface via the shared shadcn `Card` (same `bg-card` hairline
// panel as the profile/AccountView). `Card` supplies the rounded border + base
// shadow; we override only with the lighter shadow tuned for a stack of list
// cards, plus the accordion's clip + hover.
const CARD =
  "overflow-hidden shadow-elev transition-colors duration-200 hover:border-ink/25";

export function FaqInstrumentIndex({ groups }: { groups: FaqGroup[] }) {
  const toc: TocItem[] = groups.map((g) => ({
    id: `faq-${g.category.key}`,
    label: g.category.label,
  }));

  return (
    <MotionConfig reducedMotion="user">
      <div className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-16">
        {/* Sticky dossier index (lg+ only) — the same rail component as /about,
            which handles scroll-spy, smooth scroll, and its own entry animation. */}
        <div className="hidden lg:block">
          <div className="sticky top-24">
            <StickyTocRail items={toc} />
          </div>
        </div>

        {/* Content column */}
        <div className="space-y-16 sm:space-y-24">
          {groups.map((g) => (
            <section
              key={g.category.key}
              id={`faq-${g.category.key}`}
              className="scroll-mt-24"
            >
              {/* Section heading — the same per-element blur-focus cascade as
                  the /about dossier bands (AboutSectionHeading `animated`): the
                  eyebrow rule + blurb, then the title, each landing a beat after
                  the last. */}
              <header className="mb-6">
                <BlurReveal
                  as="div"
                  index={0}
                  amount={0.6}
                  className="mb-3 flex items-center gap-3"
                >
                  <span aria-hidden className="h-px w-8 bg-ink-line-strong" />
                  <p className="text-xs uppercase tracking-[0.3em] text-mute">
                    {g.category.blurb}
                  </p>
                </BlurReveal>
                <BlurReveal as="div" index={1} amount={0.6}>
                  <h2 className="font-display text-3xl font-medium text-ink sm:text-4xl">
                    {g.category.label}
                  </h2>
                </BlurReveal>
              </header>

              <RevealStagger amount={0.6} className="flex flex-col gap-3">
                {g.items.map((item) => (
                  <RevealItem key={item.id} variants={revealItemVariants}>
                    <FaqCard item={item} />
                  </RevealItem>
                ))}
              </RevealStagger>
            </section>
          ))}
        </div>
      </div>
    </MotionConfig>
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
