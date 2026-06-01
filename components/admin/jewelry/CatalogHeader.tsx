"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
import { ru } from "@/lib/i18n/ru";
import { WordReveal } from "@/components/about/client/WordReveal";
import { SUBMIT } from "@/components/admin/form/styles";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Catalog hero — the title resolves glyph by glyph and the lead word by word
 * (the site's shared WordReveal, same cadence as the dashboard / editorial
 * pages), and the "add" pill rises in with the same blur-rise as the toolbar.
 * Reveals fire on first paint
 * (the header is already in view) and honour prefers-reduced-motion by
 * rendering statically. The "add" pill is a plain link to /admin/jewelry/new —
 * creation is lazy (no row is persisted until the first save there), so this is
 * a navigation, not a mutation.
 */
export function CatalogHeader() {
  const t = ru.admin.jewelry;
  const reduced = useReducedMotion();

  // Same blur-rise as the toolbar / board entrance (not the title's word reveal)
  // so the pill enters with the rest of the page, not on the heading's beat.
  const buttonAnim = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 8, filter: "blur(6px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        transition: { duration: 0.5, ease: EASE },
      };

  return (
    <header className="mb-10 flex flex-col gap-4 pt-2 sm:mb-12 sm:flex-row sm:items-end sm:justify-between sm:pt-4">
      <div>
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
          className="mt-3 text-base text-mute"
        />
      </div>
      <motion.div {...buttonAnim} className="shrink-0">
        <Link href="/admin/jewelry/new" className={`${SUBMIT} gap-2 px-5`}>
          <Plus className="size-4" />
          {t.addShort}
        </Link>
      </motion.div>
    </header>
  );
}
