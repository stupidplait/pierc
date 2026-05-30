// Shared types for the photo-upload lite mode (docs/15-lite-mode.md).

/** Normalized 0..1 landmark coordinate in image space. */
export interface NormalizedPoint {
  x: number;
  y: number;
}

/** Pixel-space landmark coordinate, relative to the source image. */
export interface PixelPoint {
  x: number;
  y: number;
}

/** Per-anchor placement once landmarks have been resolved into pixels. */
export interface AnchorPlacement {
  /** AnchorPoint slug, e.g. "septum", "lip-medusa". */
  anchorSlug: string;
  /** Pixel position on the source photo where this anchor sits. */
  pixel: PixelPoint;
  /**
   * Width of the detected face's bounding box in image pixels — used to
   * scale sprite display size proportionally to face size.
   */
  faceBboxWidth: number;
}

/**
 * Configuration for one v1 face anchor. Maps an `AnchorPoint.slug` from
 * the DB to a MediaPipe Face Landmarker landmark index plus the relative
 * sprite display size (% of detected face bounding box width).
 *
 * See `lib/lite/anchor-config.ts` for the registered v1 anchors.
 */
export interface LiteAnchorConfig {
  slug: string;
  /** MediaPipe Face Landmarker index (0..477). */
  landmarkIdx: number;
  /** Sprite width, expressed as fraction of face bounding box width. */
  spriteWidthFrac: number;
}

/** Drag offset (in image pixels) keyed by `${anchorSlug}:${jewelryId}`. */
export type DragOffsetMap = Record<string, PixelPoint>;
