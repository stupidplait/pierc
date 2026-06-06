"use client";

import { createElement, Fragment } from "react";
import { m, useReducedMotion, type Variants } from "framer-motion";

// Matches the landing's reveal easing so the About page feels of a piece.
const EASE = [0.16, 1, 0.3, 1] as const;

const unit: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.55, ease: EASE },
  },
};

const MOTION_TAGS = {
  h1: m.h1,
  h2: m.h2,
  h3: m.h3,
  p: m.p,
  span: m.span,
  blockquote: m.blockquote,
} as const;

type Tag = keyof typeof MOTION_TAGS;

/**
 * WordReveal — reveals its text one unit at a time as it scrolls into view,
 * each unit fading + rising + sharpening from a slight blur. Used for the
 * editorial prose and headings on the Dossier About page, and for the gallery's
 * display names.
 *
 *   - `amount` controls the in-view threshold (0.5 ⇒ fires when the element is
 *     ~halfway up the viewport). `once` so it plays a single time.
 *   - `delay` offsets the whole run — pass a larger value to a heading than to
 *     its body copy so the heading lands a beat later.
 *   - `splitBy` chooses the reveal granularity: `"word"` (default) streams whole
 *     words; `"char"` reveals one glyph at a time — better for a single-word
 *     display name that would otherwise pop in as one block.
 *   - Honours `prefers-reduced-motion`: renders the text statically.
 *
 * Units are inline-blocks (so transforms apply); in word mode they're separated
 * by real spaces (so the line still wraps naturally), and in char mode spaces
 * pass through as literal gaps that never animate.
 */
export function WordReveal({
  text,
  as = "p",
  className = "",
  delay = 0,
  stagger = 0.045,
  amount = 0.6,
  splitBy = "word",
}: {
  text: string;
  as?: Tag;
  className?: string;
  delay?: number;
  stagger?: number;
  amount?: number;
  splitBy?: "word" | "char";
}) {
  const reduced = useReducedMotion();
  if (reduced) {
    return createElement(as, { className }, text);
  }

  // Indexing the map yields a union of distinct motion components that TS
  // won't accept as one JSX tag; cast to a single concrete motion type — they
  // all share HTMLMotionProps, so props (incl. children) line up.
  const MotionTag = MOTION_TAGS[as] as typeof m.p;
  const byChar = splitBy === "char";
  const units = byChar ? Array.from(text) : text.trim().split(/\s+/);
  // Orchestration lives in a container variant so staggerChildren/delayChildren
  // reliably propagate to the children.
  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren: delay } },
  };

  return (
    <MotionTag
      className={className}
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
    >
      {/* The visible reveal is a stream of per-unit spans — in char mode that
          fragments the word into single glyphs, which some screen readers spell
          out letter by letter. Expose the whole string once to assistive tech
          and hide the animated pieces from it, so it reads as one word/line. */}
      <span className="sr-only">{text}</span>
      {units.map((u, i) => {
        // A space in char mode is a literal gap — render it as-is so it never
        // joins the stagger (and the line keeps its kerning).
        if (byChar && u === " ") {
          return <Fragment key={`sp-${i}`}> </Fragment>;
        }
        return (
          <Fragment key={`${i}-${u}`}>
            <m.span aria-hidden variants={unit} className="inline-block">
              {u}
            </m.span>
            {!byChar && i < units.length - 1 ? " " : ""}
          </Fragment>
        );
      })}
    </MotionTag>
  );
}
