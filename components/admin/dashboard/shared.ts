import type { Target, Variants } from "framer-motion";
import {
  ENTRANCE_DURATION,
  ENTRANCE_HIDDEN,
  ENTRANCE_SHOW,
  ENTRANCE_STAGGER,
  REVEAL_EASE,
} from "@/components/services/entrance/config";
import type { MetricTone } from "./types";

// Elevated panel surface — the exact layered shadow /account + the featured
// service card use, so the admin dashboard reads as one of the same family.
export const SURFACE =
  "rounded-2xl border border-line bg-card shadow-[0_1px_2px_rgba(8,8,8,0.5),0_10px_28px_-10px_rgba(8,8,8,0.6)]";

// Blur-focus entrance, reused from the services/account vocabulary so the
// dashboard resolves with the same timing as the rest of the site.
export const container: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: ENTRANCE_STAGGER, delayChildren: 0.05 },
  },
};

export const item: Variants = {
  hidden: ENTRANCE_HIDDEN as Target,
  show: {
    ...(ENTRANCE_SHOW as Target),
    transition: { duration: ENTRANCE_DURATION, ease: REVEAL_EASE },
  },
};

// Count colour by tone. Magenta accent only when the metric is actionable;
// otherwise the calm ink so the single accent stays a real attention moment.
export function toneText(tone: MetricTone): string {
  if (tone === "primary") return "text-accent";
  if (tone === "warn") return "text-warn";
  return "text-ink";
}

// Two-digit zero-pad — the studio reads counts as instrument readouts (03, 12).
export function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
