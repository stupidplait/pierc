"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { scrollToSection } from "@/lib/scroll";

export interface TocItem {
  /** id of the <section> this entry tracks. */
  id: string;
  label: string;
}

// Entry choreography — the rail's numbered entries stream in (fade + rise),
// staggered, on mount. Matches the landing/about reveal easing.
const EASE = [0.16, 1, 0.3, 1] as const;

const railList: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const railItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/**
 * StickyTocRail — the dossier's left index. A mono, numbered table of contents
 * that lights the entry whose section is currently in the reading band, driven
 * by an IntersectionObserver (no scroll handler, no per-frame work).
 *
 * State is only ever set from the observer callback (an event, not the effect
 * body) so the project's strict `react-hooks/set-state-in-effect` rule stays
 * satisfied. `activeRef` mirrors the active id so the callback can dedupe
 * without depending on the latest render's closure.
 */
export function StickyTocRail({
  items,
  eyebrow,
}: {
  items: TocItem[];
  eyebrow?: string;
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
    <nav aria-label="Разделы страницы">
      {eyebrow ? (
        <div className="mb-5 flex items-center gap-3">
          <span aria-hidden className="h-px w-8 bg-ink-line-strong" />
          <p className="text-xs uppercase tracking-[0.3em] text-mute">
            {eyebrow}
          </p>
        </div>
      ) : null}
      <motion.ol
        className="space-y-3"
        variants={railList}
        initial={reduce ? false : "hidden"}
        animate="show"
      >
        {items.map((it, i) => {
          const isActive = active === it.id;
          return (
            <motion.li key={it.id} variants={railItem}>
              <a
                href={`#${it.id}`}
                aria-current={isActive ? "true" : undefined}
                onClick={(e) => {
                  // Smooth in-page scroll via the app's shared scroller (same
                  // path the landing uses), with an immediate active-state
                  // commit for snappy feedback.
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
            </motion.li>
          );
        })}
      </motion.ol>
    </nav>
  );
}
