/**
 * BrandMark — the studio's logo mark: a magenta-accent disc with a bold,
 * outlined X floating inside it. The X is a single closed silhouette stroked in
 * black (thick border, transparent interior so the disc shows through), with
 * rounded joins and a deliberate gap to the circle — it never touches the edge.
 *
 * Colours are baked in (fixed brand asset); `className` only sizes / positions
 * it. Always decorative (aria-hidden) — a link wrapper supplies the label.
 *
 * The X is the outline of two crossed bars (a slim "+" rotated 45°) — fully
 * symmetric, so it reads as an even X rather than squashed. Coordinates are
 * baked at a constant bar width, so the black border stays an even thickness
 * all the way round. It sits clear of the r=45 disc with a visible gap.
 */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" aria-hidden="true" className={className}>
      {/* Disc — filled with the magenta accent. */}
      <circle cx="50" cy="50" r="45" fill="var(--accent)" />
      {/* Outlined X — transparent inside, slim black border, gently rounded. */}
      <path
        d="M66.26 76.16 L76.16 66.26 L59.90 50 L76.16 33.74 L66.26 23.84 L50 40.10 L33.74 23.84 L23.84 33.74 L40.10 50 L23.84 66.26 L33.74 76.16 L50 59.90 Z"
        fill="none"
        stroke="#000"
        strokeWidth="6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
