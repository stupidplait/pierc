"use client";

import { useId, useState } from "react";
import {
  AnimatePresence,
  motion,
  MotionConfig,
  useReducedMotion,
} from "framer-motion";
import {
  Reveal,
  RevealStagger,
  RevealItem,
  revealItemVariants,
} from "@/components/landing/Reveal";
import { StickyTocRail, type TocItem } from "@/components/about/client/StickyTocRail";
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

// Solid elevated card surface — same recipe as the profile (AccountView),
// tuned to a lighter shadow for a stack of list cards.
const CARD =
  "overflow-hidden rounded-2xl border border-line bg-card shadow-[0_18px_48px_-28px_rgba(8,8,8,0.9)] transition-colors duration-200 hover:border-ink/25";

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
              <Reveal amount={0.6}>
                <header className="mb-6">
                  <div className="mb-3 flex items-center gap-3">
                    <span aria-hidden className="h-px w-8 bg-ink-line-strong" />
                    <p className="text-xs uppercase tracking-[0.3em] text-mute">
                      {g.category.blurb}
                    </p>
                  </div>
                  <h2 className="font-display text-2xl font-medium text-ink sm:text-3xl">
                    {g.category.label}
                  </h2>
                </header>
              </Reveal>

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
    <div className={CARD}>
      {/* Question is a real heading for a11y/SEO; Tailwind preflight makes it
          inherit size/weight so the button controls the styling. */}
      <h3>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open ? "true" : "false"}
          aria-controls={contentId}
          className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left text-base font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset sm:px-6 sm:py-5"
        >
          <span>{item.question}</span>
          <Chevron open={open} />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
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
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
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
      className={`shrink-0 text-mute transition-transform duration-200 ${
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
