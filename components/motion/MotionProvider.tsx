"use client";

import { domMax, LazyMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * App-wide LazyMotion provider. Lets client components use the lightweight `m`
 * component instead of the full `motion` (which eagerly bundles every feature):
 * the `m` core is a fraction of the size and the feature set is supplied once,
 * here. `domMax` is the full feature surface used across the app — animations,
 * variants, AnimatePresence, `whileInView`, press/hover/focus gestures, drag and
 * layout — so nothing loses behaviour.
 *
 * Mounted at the root so every tree (public, landing, admin) has an ancestor;
 * that's what lets shared components (Reveal, WordReveal, AnimateNumber, …) use
 * `m` no matter where they render. Non-strict on purpose: components still on
 * full `motion` (the landing WebGL scenes, some admin boards) keep working while
 * the migration is gradual. Admin's existing nested LazyMotion islands are
 * harmless under this — same features.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <LazyMotion features={domMax}>{children}</LazyMotion>;
}
