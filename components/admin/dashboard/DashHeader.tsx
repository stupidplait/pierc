"use client";

import { ru } from "@/lib/i18n/ru";
import { WordReveal } from "@/components/about/client/WordReveal";

const t = ru.admin.dashboard;

// Dashboard hero — display title + personalised lead, in the same vocabulary as
// the public PageHeader (display font, muted lead). The title resolves glyph by
// glyph and the lead word by word, reusing the site's shared WordReveal so the
// dashboard greets with the same blur-rise cadence as the editorial pages. The
// reveals fire on first paint (the header sits at the top, already in view) and
// honour prefers-reduced-motion by rendering statically.
export function DashHeader({ adminName }: { adminName: string }) {
  const lead = adminName ? `${t.welcome}, ${adminName}. ${t.lead}` : t.lead;

  return (
    <header className="mb-10 pt-2 sm:mb-12 sm:pt-4">
      <WordReveal
        as="h1"
        text={t.title}
        splitBy="char"
        stagger={0.04}
        amount={0.1}
        className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl"
      />
      <WordReveal
        as="p"
        text={lead}
        delay={0.3}
        stagger={0.03}
        amount={0.1}
        className="mt-3 text-base text-mute"
      />
    </header>
  );
}
