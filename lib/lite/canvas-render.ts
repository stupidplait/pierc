"use client";

import { LITE_ANCHORS_BY_SLUG } from "./anchor-config";
import type {
  AnchorPlacement,
  DragOffsetMap,
  PixelPoint,
} from "./types";

/**
 * Paint the source photo onto the canvas, sized to its natural dimensions.
 * Caller is responsible for setting canvas.width/height to match.
 */
function drawPhoto(
  ctx: CanvasRenderingContext2D,
  photo: HTMLImageElement,
): void {
  ctx.drawImage(photo, 0, 0, photo.naturalWidth, photo.naturalHeight);
}

/**
 * Task 4 helper: draw small colored circles at each resolved anchor
 * position. Used to visually verify the landmark indices in
 * `lib/lite/anchor-config.ts` against real selfies before sprite
 * compositing took over in Task 5.
 *
 * Kept exported because it's still useful while tuning new anchors
 * (e.g., when ear anchors get added). Toggle on by passing
 * `debugDots: true` to <SelfieCanvas>.
 */
export function drawDebugDots(
  canvas: HTMLCanvasElement,
  photo: HTMLImageElement,
  placements: AnchorPlacement[],
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPhoto(ctx, photo);

  const radius =
    placements[0] != null
      ? Math.max(4, placements[0].faceBboxWidth * 0.012)
      : 6;

  for (const p of placements) {
    const cfg = LITE_ANCHORS_BY_SLUG.get(p.anchorSlug);
    const color = cfg ? colorForAnchor(p.anchorSlug) : "#ff00ff";

    ctx.beginPath();
    ctx.arc(p.pixel.x, p.pixel.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = Math.max(1, radius * 0.25);
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  }
}

/**
 * Stable color-per-anchor for debug dots. Helps distinguish nostrils
 * from eyebrows at a glance during empirical landmark tuning.
 */
function colorForAnchor(slug: string): string {
  switch (slug) {
    case "left-nostril":
    case "right-nostril":
      return "#ff5d8f";
    case "septum":
      return "#fe017e";
    case "lip-medusa":
      return "#ffba49";
    case "lip-labret":
      return "#ffd166";
    case "left-eyebrow":
    case "right-eyebrow":
      return "#06aed5";
    default:
      return "#7c3aed";
  }
}

/**
 * Composite the photo + every equipped sprite onto the canvas.
 *
 * For each `[anchorSlug, jewelryId]` in `equippedBySlug`:
 *   • find the resolved placement (skip if no placement, e.g. when the
 *     visitor equipped a piece on a slug we don't render in v1)
 *   • find the cached sprite image (skip if it hasn't loaded yet — the
 *     caller will redraw once it has)
 *   • compute width = `cfg.spriteWidthFrac × placement.faceBboxWidth`,
 *     keep aspect ratio for height
 *   • draw centered on `placement.pixel + dragOffsets[<key>]`
 *
 * Anchors not registered in `LITE_ANCHORS_BY_SLUG` (i.e. anchors deferred
 * past v1 — ears/body/tongue) are rendered with a fallback width of
 * 4% face bbox so partial coverage still works gracefully if a future
 * task widens the supported set.
 */
export function composite(
  canvas: HTMLCanvasElement,
  photo: HTMLImageElement,
  placements: AnchorPlacement[],
  equippedBySlug: Record<string, string>,
  spritesByJewelryId: Map<string, HTMLImageElement>,
  dragOffsets: DragOffsetMap,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPhoto(ctx, photo);

  const placementBySlug = new Map(placements.map((p) => [p.anchorSlug, p]));

  for (const [anchorSlug, jewelryId] of Object.entries(equippedBySlug)) {
    const placement = placementBySlug.get(anchorSlug);
    if (!placement) continue;

    const sprite = spritesByJewelryId.get(jewelryId);
    if (!sprite || !sprite.complete) continue;

    const cfg = LITE_ANCHORS_BY_SLUG.get(anchorSlug);
    const widthFrac = cfg?.spriteWidthFrac ?? 0.04;
    const drawW = Math.max(8, widthFrac * placement.faceBboxWidth);
    const aspect =
      sprite.naturalHeight > 0 && sprite.naturalWidth > 0
        ? sprite.naturalHeight / sprite.naturalWidth
        : 1;
    const drawH = drawW * aspect;

    const offset = dragOffsets[`${anchorSlug}:${jewelryId}`];
    const cx = placement.pixel.x + (offset?.x ?? 0);
    const cy = placement.pixel.y + (offset?.y ?? 0);

    ctx.drawImage(sprite, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
  }
}

/**
 * Common helper used by both drawDebugDots and composite — apply a drag
 * offset to a pixel position. Pure; null offset returns the input.
 */
export function withOffset(
  pixel: PixelPoint,
  offset: PixelPoint | undefined,
): PixelPoint {
  if (!offset) return pixel;
  return { x: pixel.x + offset.x, y: pixel.y + offset.y };
}

/**
 * Trigger a download of the canvas's current state as a PNG. Output
 * resolution matches the canvas's natural pixel dimensions (which are
 * set to the source photo's resolution in `<SelfieCanvas>`).
 *
 * Uses `toBlob` + an ephemeral `<a download>` to avoid round-tripping
 * through the server. Privacy-preserving — the photo never leaves the
 * browser.
 */
export function saveToImage(
  canvas: HTMLCanvasElement,
  filename: string,
): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke after the click fires; small timeout in case the browser
    // hasn't yet picked up the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

/**
 * Build a `pierc-tryon-YYYYMMDD-HHmmss.png` filename for the saved
 * composite. Local time, no timezone offset (the user only sees the
 * file in their downloads folder).
 */
export function buildTryOnFilename(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `pierc-tryon-${stamp}.png`;
}
