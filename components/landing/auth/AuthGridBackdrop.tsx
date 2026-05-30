/**
 * AuthGridBackdrop — flat 2D grid with a soft elliptical vignette mask.
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
 * The site is single-theme dark, so the grid line is always the pale cream
 * value — it stays visible over the `#080808` void regardless of the visitor's
 * OS `prefers-color-scheme`.
 *
 * `aria-hidden` because decorative.
 */
export function AuthGridBackdrop() {
  return (
    <>
      <style>{authGridStyles}</style>
      <div className="auth-grid-flat" aria-hidden />
    </>
  );
}

const authGridStyles = `
.auth-grid-flat {
  position: fixed;
  inset: 0;
  pointer-events: none;
  --auth-grid-line: rgba(239, 231, 216, 0.08);
  --auth-grid-cell: 64px;
  background-image:
    linear-gradient(to right, var(--auth-grid-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--auth-grid-line) 1px, transparent 1px);
  background-size: var(--auth-grid-cell) var(--auth-grid-cell);
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
