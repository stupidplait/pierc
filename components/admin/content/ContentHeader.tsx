"use client";

import { ru } from "@/lib/i18n/ru";
import { WordReveal } from "@/components/about/client/WordReveal";

const t = ru.admin.content;

export function ContentHeader() {
  return (
    <header className="mb-8 pt-2 sm:mb-10 sm:pt-4">
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
        text={t.lead}
        delay={0.3}
        stagger={0.03}
        amount={0.1}
        className="mt-3 max-w-prose text-base text-mute"
      />
    </header>
  );
}
