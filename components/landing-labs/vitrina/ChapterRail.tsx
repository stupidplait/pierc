"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./vitrina.module.css";
import { CHAPTERS } from "./content";

/**
 * ChapterRail — a fixed right-edge progress indicator + section nav. Active
 * section is tracked by an IntersectionObserver (no scroll handler, no per-frame
 * work); state is set only from the observer callback, with a ref mirror to
 * dedupe — the same pattern as components/motion/StickyTocRail.tsx, satisfying
 * the strict set-state-in-effect lint.
 */
export function ChapterRail() {
  const [active, setActive] = useState<string>(CHAPTERS[0].id);
  const activeRef = useRef<string>(CHAPTERS[0].id);

  useEffect(() => {
    const els = CHAPTERS.map((c) => document.getElementById(c.id)).filter(
      (el): el is HTMLElement => el != null,
    );
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const next = visible[0]?.target.id;
        if (next && next !== activeRef.current) {
          activeRef.current = next;
          setActive(next);
        }
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 },
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <nav className={styles.chapterRail} aria-label="Разделы страницы">
      {CHAPTERS.map((c) => {
        const isActive = active === c.id;
        return (
          <button
            key={c.id}
            type="button"
            className={`${styles.chapterDot} ${isActive ? styles.chapterDotActive : ""}`}
            aria-current={isActive ? "true" : undefined}
            onClick={() => {
              activeRef.current = c.id;
              setActive(c.id);
              document
                .getElementById(c.id)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <span className={styles.chapterLabel}>{c.label}</span>
            <span className={styles.chapterTick} aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
}
