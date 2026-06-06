import type { Target } from "framer-motion";

// Blur-focus entrance, shared by the featured card (BlockReveal) and the grid
// cards (StaggerGrid) so they resolve identically: from blurred + slightly
// small to crisp. Easing matches the site's house Reveal ([0.16,1,0.3,1]
// expo-out) so the services page feels of a piece with the rest of the site.

export const REVEAL_EASE = [0.16, 1, 0.3, 1] as const;
export const ENTRANCE_DURATION = 0.5;
// Per-item stagger, kept at/under the 50ms ceiling so the cascade stays snappy
// rather than feeling sluggish as the list grows.
export const ENTRANCE_STAGGER = 0.05;

// Viewport trigger shared by the grid reveals (StaggerGrid, ValuesRail). Grids
// stack multiple rows, so a high `amount` ("60% of the whole grid visible")
// only fired after the user had already scrolled well into the grid — on first
// load the cards sat hidden below the fold. A low amount fires the stagger as
// soon as the grid's top edge enters the viewport, so the cards are already
// animating in the moment the grid appears.
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
