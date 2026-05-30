import type { LiteAnchorConfig } from "./types";

/**
 * The seven face anchors supported by lite mode v1.
 *
 * MediaPipe Face Landmarker emits 478 indexed mesh points; these indices
 * were chosen because they have direct anatomical landmarks (no
 * extrapolation needed). Ear/body/tongue anchors are deferred — see
 * docs/15-lite-mode.md for the rationale.
 *
 * Initial values are from MediaPipe's documented topology. Tune
 * empirically with 3–5 real test selfies if any anchor lands consistently
 * off the visible piercing site; commit the adjusted index here.
 *
 * `spriteWidthFrac` is the sprite display size as a fraction of the
 * detected face's bounding-box width. Keeps sprites proportional whether
 * the user uploads a close-up or a half-body shot.
 */
export const LITE_ANCHORS: LiteAnchorConfig[] = [
  { slug: "left-nostril", landmarkIdx: 49, spriteWidthFrac: 0.04 },
  { slug: "right-nostril", landmarkIdx: 279, spriteWidthFrac: 0.04 },
  { slug: "septum", landmarkIdx: 2, spriteWidthFrac: 0.05 },
  { slug: "lip-medusa", landmarkIdx: 0, spriteWidthFrac: 0.06 },
  { slug: "lip-labret", landmarkIdx: 17, spriteWidthFrac: 0.06 },
  { slug: "left-eyebrow", landmarkIdx: 105, spriteWidthFrac: 0.06 },
  { slug: "right-eyebrow", landmarkIdx: 334, spriteWidthFrac: 0.06 },
];

/** Lookup by slug for O(1) access during placement computation. */
export const LITE_ANCHORS_BY_SLUG: ReadonlyMap<string, LiteAnchorConfig> =
  new Map(LITE_ANCHORS.map((a) => [a.slug, a]));

/** Set of slugs that lite mode supports — used to filter the anchor list. */
export const LITE_ANCHOR_SLUGS: ReadonlySet<string> = new Set(
  LITE_ANCHORS.map((a) => a.slug),
);
