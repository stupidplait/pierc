"use client";

import { ru } from "@/lib/i18n/ru";
import { WordReveal } from "@/components/motion/WordReveal";

const t = ru.admin.dashboard;

/**
 * v2 dashboard hero — same blur-rise WordReveal cadence as the rest of the site,
 * but the title scales 3xl → 4xl → 5xl so it never overflows at 320px (the
 * production DashHeader jumps straight to 4xl). Vertical rhythm is left to the
 * parent's flex gap, so no margins here.
 */
export function DashHeaderV2({ adminName }: { adminName: string }) {
  const lead = adminName ? `${t.welcome}, ${adminName}. ${t.lead}` : t.lead;

  return (
    <header className="pt-1 sm:pt-3">
      <WordReveal
        as="h1"
        text={t.title}
        splitBy="char"
        stagger={0.04}
        amount={0.1}
        className="font-display text-3xl font-medium tracking-tight text-ink sm:text-4xl lg:text-5xl"
      />
      <WordReveal
        as="p"
        text={lead}
        delay={0.3}
        stagger={0.03}
        amount={0.1}
        className="mt-2 max-w-prose text-sm text-mute sm:mt-3 sm:text-base"
      />
    </header>
  );
}
