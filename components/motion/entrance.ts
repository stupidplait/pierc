import type { Target } from "framer-motion";

// The house "blur-focus" entrance vocabulary: an element resolves from blurred +
// slightly small to crisp, on the site's expo-out curve ([0.16,1,0.3,1]). Shared
// app-wide — the public BlurReveal / blurRevealVariants / WordReveal, the /about
// + /services grids, and the admin consoles all resolve identically from these
// tokens, so every blur entrance across the app reads the same.

export const REVEAL_EASE = [0.16, 1, 0.3, 1] as const;
export const ENTRANCE_DURATION = 0.5;
// Per-item stagger, kept at/under the 50ms ceiling so the cascade stays snappy
// rather than feeling sluggish as the list grows.
export const ENTRANCE_STAGGER = 0.05;

// Viewport trigger shared by the grid reveals. Grids stack multiple rows, so a
// high `amount` only fired after the user had already scrolled well into the
// grid — on first load the cards sat hidden below the fold. A low amount fires
// the stagger as soon as the grid's top edge enters the viewport.
export const ENTRANCE_VIEWPORT = { once: true, amount: 0.15 } as const;

export const ENTRANCE_HIDDEN: Target = {
  opacity: 0,
  scale: 0.98,
  filter: "blur(8px)",
};

export const ENTRANCE_SHOW: Target = {
  opacity: 1,
  scale: 1,
  filter: "blur(0px)",
};
