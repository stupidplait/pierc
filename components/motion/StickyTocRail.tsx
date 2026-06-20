"use client";

import { useEffect, useRef, useState } from "react";
import { m, useReducedMotion, type Variants } from "framer-motion";
import { scrollToSection } from "@/lib/scroll";
import { blurRevealVariants } from "@/components/motion/BlurReveal";
import { ru } from "@/lib/i18n/ru";

export interface TocItem {
  /** id of the <section> this entry tracks. */
  id: string;
  label: string;
}

// Entry choreography — the rail's numbered entries play the house blur-focus
// entrance (blurRevealVariants), staggered on mount, so they match the hero mark
// and the section grids elsewhere on the page.
const railList: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

/**
 * StickyTocRail — a dossier-style left index shared by /about and /faq. A mono,
 * numbered table of contents that lights the entry whose section is currently in
 * the reading band, driven by an IntersectionObserver (no scroll handler, no
 * per-frame work). A generic primitive — lives in components/motion/.
 *
 * State is only ever set from the observer callback (an event, not the effect
 * body) so the project's strict `react-hooks/set-state-in-effect` rule stays
 * satisfied. `activeRef` mirrors the active id so the callback can dedupe
 * without depending on the latest render's closure.
 */
export function StickyTocRail({
  items,
  eyebrow,
  navLabel,
}: {
  items: TocItem[];
  eyebrow?: string;
  /** Accessible name for the nav landmark. Defaults to the shared i18n string. */
  navLabel?: string;
}) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null);
  const activeRef = useRef<string | null>(items[0]?.id ?? null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const els = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => el != null);
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Of the sections intersecting the reading band, pick the topmost.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          );
        const next = visible[0]?.target.id;
        if (next && next !== activeRef.current) {
          activeRef.current = next;
          setActive(next);
        }
      },
      // Reading band: a strip ~30%–40% down the viewport.
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label={navLabel ?? ru.common.pageSections}>
      {eyebrow ? (
        <div className="mb-5 flex items-center gap-3">
          <span aria-hidden className="h-px w-8 bg-ink-line-strong" />
          <p className="text-xs uppercase tracking-[0.3em] text-mute">
            {eyebrow}
          </p>
        </div>
      ) : null}
      <m.ol
        className="space-y-3"
        variants={railList}
        initial={reduce ? false : "hidden"}
        animate="show"
      >
        {items.map((it, i) => {
          const isActive = active === it.id;
          return (
            <m.li key={it.id} variants={blurRevealVariants}>
              <a
                href={`#${it.id}`}
                aria-current={isActive ? "location" : undefined}
                onClick={(e) => {
                  // Smooth in-page scroll via the app's shared scroller (same
                  // path the landing uses), with an immediate active-state
                  // commit for snappy feedback. scrollToSection also moves
                  // focus to the section for keyboard/SR users.
                  e.preventDefault();
                  activeRef.current = it.id;
                  setActive(it.id);
                  scrollToSection(it.id);
                }}
                className={`group flex items-baseline gap-3 text-sm transition-colors ${
                  isActive ? "text-ink" : "text-mute hover:text-ink"
                }`}
              >
                <span
                  className={`font-mono text-xs transition-colors ${
                    isActive ? "text-primary" : "text-mute/70"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={`-ml-1 h-px self-center transition-all ${
                    isActive ? "w-5 bg-primary" : "w-0 bg-transparent"
                  }`}
                  aria-hidden
                />
                {it.label}
              </a>
            </m.li>
          );
        })}
      </m.ol>
    </nav>
  );
}
