import type { Variants } from "framer-motion";
import {
  ENTRANCE_DURATION,
  ENTRANCE_HIDDEN,
  ENTRANCE_SHOW,
  ENTRANCE_STAGGER,
  REVEAL_EASE,
} from "@/components/services/entrance/config";

// Shared "Steel Atelier" vocabulary for the admin reviews area, mirroring the
// redesigned /admin/settings cards so the two read as one set. Kept as plain
// constants (importable from both server and client modules) rather than
// duplicated inline the way the settings page declares its own SURFACE.

// Elevated panel + layered shadow — the same surface /account, /services and the
// settings cards use.
export const SURFACE =
  "rounded-2xl border border-line bg-card shadow-[0_1px_2px_rgba(8,8,8,0.5),0_10px_28px_-10px_rgba(8,8,8,0.6)]";

// Field surface borrowed from the /account EditProfileDrawer + settings form:
// hairline ink border over a near-invisible wash, magenta accent focus ring.
export const FIELD =
  "h-11 w-full rounded-xl border border-ink/15 bg-ink/3 px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-mute/60 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30";

// Multi-line variant of FIELD — same skin, auto height.
export const TEXTAREA =
  "w-full rounded-xl border border-ink/15 bg-ink/3 px-3.5 py-3 text-sm leading-relaxed text-ink outline-none transition-colors placeholder:text-mute/60 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30";

// Primary action — ink-inverted, matching the settings Save button.
export const SAVE_PILL =
  "inline-flex h-11 items-center justify-center rounded-xl bg-ink px-6 text-sm font-medium text-bg transition-colors duration-150 hover:bg-ink/90 active:scale-[0.98] disabled:opacity-50";

// Secondary action — hairline outline that warms to ink on hover.
export const OUTLINE_PILL =
  "inline-flex h-11 items-center justify-center rounded-xl border border-ink/15 px-5 text-sm font-medium text-mute transition-colors duration-150 hover:border-ink/30 hover:text-ink active:scale-[0.98]";

// Affirmative action (approve / publish) — filled success pill, dark ink label.
export const SUCCESS_PILL =
  "inline-flex h-11 items-center justify-center rounded-xl bg-success px-5 text-sm font-medium text-bg transition-colors duration-150 hover:bg-success/90 active:scale-[0.98]";

// Destructive outline — the OUTLINE_PILL that warms to the error tone instead.
export const DANGER_PILL =
  "inline-flex h-11 items-center justify-center rounded-xl border border-ink/15 px-5 text-sm font-medium text-mute transition-colors duration-150 hover:border-error/50 hover:text-error active:scale-[0.98]";

// Blur-focus stagger — same choreography as the /services grid and the settings
// cards, so every reviews surface resolves with the house entrance.
export const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: ENTRANCE_STAGGER, delayChildren: 0.04 } },
};

export const item: Variants = {
  hidden: ENTRANCE_HIDDEN,
  show: {
    ...ENTRANCE_SHOW,
    transition: { duration: ENTRANCE_DURATION, ease: REVEAL_EASE },
  },
};
