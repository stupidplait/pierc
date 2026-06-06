"use client";

import {
  Children,
  cloneElement,
  createElement,
  isValidElement,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from "react";
import { m } from "framer-motion";
import {
  ENTRANCE_DURATION,
  ENTRANCE_HIDDEN,
  ENTRANCE_SHOW,
  ENTRANCE_STAGGER,
  REVEAL_EASE,
} from "@/components/services/entrance/config";

/**
 * The house "blur-rise" reveal — the same entrance the settings cards use (fade
 * + slight scale-up + de-blur). Factored out because tabs, lists, and grids all
 * want it.
 *
 * Each item drives its OWN `initial`/`animate` with an index-based delay rather
 * than leaning on a parent container's `staggerChildren`: variant orchestration
 * doesn't propagate reliably through `Reorder.Group` / an `AnimatePresence`
 * panel, so the explicit per-item form is what actually plays. Spread
 * {@link blurReveal} onto any `m.*` / `Reorder.Item` / tab button, or use the
 * {@link Stagger} + {@link StaggerItem} pair for plain lists.
 *
 * Requires a `LazyMotion` ancestor (the admin pages provide one).
 */

/** Per-item reveal props. `index` offsets the start so a group cascades. */
export function blurReveal(index = 0) {
  return {
    initial: ENTRANCE_HIDDEN,
    animate: {
      ...ENTRANCE_SHOW,
      transition: {
        duration: ENTRANCE_DURATION,
        ease: REVEAL_EASE,
        // Cap the cascade so long lists don't trail off into a multi-second wait.
        delay: 0.04 + Math.min(index, 10) * ENTRANCE_STAGGER,
      },
    },
  };
}

type ItemTag = "div" | "li" | "section" | "article";

/**
 * Plain container that hands each child its stagger index. Not a motion element
 * itself (so it never becomes a variant parent) — the {@link StaggerItem}
 * children own the animation.
 */
export function Stagger({
  as = "div",
  className,
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  // createElement (not <Tag/>) — a polymorphic `as` trips JSX's children typing.
  return createElement(
    as,
    { className },
    Children.map(children, (child, index) =>
      isValidElement(child)
        ? cloneElement(child as ReactElement<{ index?: number }>, { index })
        : child,
    ),
  );
}

/** One blur-rise child. `index` is injected by {@link Stagger}. */
export function StaggerItem({
  as = "div",
  className,
  children,
  index = 0,
}: {
  as?: ItemTag;
  className?: string;
  children: ReactNode;
  index?: number;
}) {
  const Comp = m[as] as typeof m.div;
  return (
    <Comp {...blurReveal(index)} className={className}>
      {children}
    </Comp>
  );
}
