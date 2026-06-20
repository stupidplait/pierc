"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { ENTRANCE_DURATION, REVEAL_EASE } from "@/components/motion/entrance";

/**
 * AuthShell — the persistent sign-in / sign-up panel frame.
 *
 * Lives in the auth *layout*, so the bordered card is ONE element that survives
 * the route change between /auth/sign-in and /auth/sign-up. That's what makes
 * the shared-element morph work: framer's `layout` animates the card's height as
 * the inner content changes (sign-in has 2 fields, sign-up has 4), so the card
 * visibly grows / shrinks instead of vanishing and reappearing.
 *
 * The inner content (heading + form) is swapped with `mode="popLayout"`: the
 * outgoing route is popped out of flow (so the card measures the *new* content
 * immediately and `layout` animates toward it) while it blur-fades out and the
 * new content blur-fades in. The blur doubles as cover for any sub-pixel
 * interpolation during the resize.
 *
 * The card's own opacity/rise entrance runs once on first mount (the element
 * persists across the in-section navigation, so it never replays) — the morph is
 * all that plays on sign-in ⇄ sign-up. Reduced motion drops straight to a
 * static frame.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  const mainCls =
    "app-auth relative z-10 flex min-h-[100svh] items-center justify-center px-4 py-24 sm:px-8";
  const cardCls =
    "relative w-full max-w-md overflow-hidden rounded-2xl border border-line bg-card p-7 shadow-elev-overlay sm:p-9";

  if (reduce) {
    return (
      <main className={mainCls}>
        <div className={cardCls}>{children}</div>
      </main>
    );
  }

  return (
    <main className={mainCls}>
      <m.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: ENTRANCE_DURATION,
          ease: REVEAL_EASE,
          layout: { duration: 0.4, ease: REVEAL_EASE },
        }}
        className={cardCls}
      >
        <AnimatePresence mode="popLayout">
          <m.div
            key={pathname}
            initial={{ opacity: 0, filter: "blur(6px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(6px)" }}
            transition={{ duration: 0.25, ease: REVEAL_EASE }}
          >
            {children}
          </m.div>
        </AnimatePresence>
      </m.div>
    </main>
  );
}
