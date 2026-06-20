/**
 * GridBackdrop — flat 2D grid with a soft elliptical vignette mask.
 *
 * Replaces the prior CSS-3D perspective room. The brief: a flat grid (no
 * vanishing-point recession, no "inside a cube" feel) that fades softly
 * toward the corners, leaving a centered pool of grid where the card
 * sits. The vignette is the "rounded shadowing" effect — built with a
 * radial-gradient mask so the fade is smooth and elliptical.
 *
 * Composition:
 *   - Two layered repeating linear-gradients draw a 64px-cell square grid.
 *   - A radial-gradient `mask-image` clips the grid to a centered ellipse,
 *     so it's most visible at the page center and fades to fully
 *     transparent before reaching the edges.
 *
 * The grid line is themed via `--backdrop-grid` (pale cream over the dark
 * void; faint ink on light) so it stays visible in both themes.
 *
 * `aria-hidden` because decorative.
 */
export function GridBackdrop() {
  return (
    <>
      <style>{gridStyles}</style>
      <div className="backdrop-grid-flat" aria-hidden />
    </>
  );
}

const gridStyles = `
.backdrop-grid-flat {
  position: fixed;
  inset: 0;
  pointer-events: none;
  --grid-line: var(--backdrop-grid, rgba(239, 231, 216, 0.08));
  --grid-cell: 64px;
  background-image:
    linear-gradient(to right, var(--grid-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px);
  background-size: var(--grid-cell) var(--grid-cell);
  background-position: center center;
  /* Soft elliptical vignette — grid fades from full opacity at the
     center to transparent at ~80% of the radius. The ellipse is wider
     than tall so the fade matches landscape viewports naturally. */
  -webkit-mask-image: radial-gradient(
    ellipse 70% 65% at 50% 50%,
    #000 0%,
    #000 35%,
    transparent 100%
  );
  mask-image: radial-gradient(
    ellipse 70% 65% at 50% 50%,
    #000 0%,
    #000 35%,
    transparent 100%
  );
}
`;
