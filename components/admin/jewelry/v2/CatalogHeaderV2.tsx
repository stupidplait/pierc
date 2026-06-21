"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
import { ru } from "@/lib/i18n/ru";
import { WordReveal } from "@/components/motion/WordReveal";
import { SUBMIT } from "@/components/admin/form/styles";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Catalog hero (v2) — same WordReveal cadence as the rest of the admin, but the
 * title scales 3xl → 4xl → 5xl so it never overflows at 320px, and the "add"
 * pill goes full-width on mobile (a comfortable tap target) before shrinking to
 * an inline pill from sm up. Lazy create: a plain link to the editor.
 */
export function CatalogHeaderV2() {
  const t = ru.admin.jewelry;
  const reduced = useReducedMotion();

  const buttonAnim = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 8, filter: "blur(6px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        transition: { duration: 0.5, ease: EASE },
      };

  return (
    <header className="mb-8 flex flex-col gap-4 pt-1 sm:mb-10 sm:flex-row sm:items-end sm:justify-between sm:pt-3">
      <div className="min-w-0">
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
          text={t.lead}
          delay={0.3}
          stagger={0.03}
          amount={0.1}
          className="mt-2 max-w-prose text-sm text-mute sm:mt-3 sm:text-base"
        />
      </div>
      <motion.div {...buttonAnim} className="sm:shrink-0">
        <Link
          href="/admin/jewelry/new"
          className={`${SUBMIT} w-full justify-center gap-2 px-5 sm:w-auto`}
        >
          <Plus className="size-4" />
          {t.addShort}
        </Link>
      </motion.div>
    </header>
  );
}
