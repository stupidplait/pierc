// Route-level loader for /gallery. The live route is a coverflow STAGE — a focal
// portrait flanked by peeking neighbours over a vignette-masked framing grid — so
// a bare spinner read as out of place. This mirrors that silhouette (one large
// focal card + two dimmed neighbours on the same grid) so the route-stream →
// coverflow handoff reads as one continuous load. The shapes are decorative
// (the shared <Skeleton> is aria-hidden); one sr-only status line announces it.

import { ru } from "@/lib/i18n/ru";
import { Skeleton } from "@/components/ui/Skeleton";

export default function GalleryLoading() {
  return (
    <section
      className="relative grid h-svh place-items-center overflow-hidden bg-bg"
      aria-busy="true"
    >
      {/* Same 64px framing grid as the live stage, vignette-masked out of the
          central focal pool — keeps the backdrop identical across the handoff. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,var(--backdrop-grid)_1px,transparent_1px),linear-gradient(to_bottom,var(--backdrop-grid)_1px,transparent_1px)] [background-size:64px_64px] [background-position:center] [-webkit-mask-image:radial-gradient(ellipse_62%_58%_at_50%_50%,transparent_0%,transparent_32%,#000_78%)] [mask-image:radial-gradient(ellipse_62%_58%_at_50%_50%,transparent_0%,transparent_32%,#000_78%)]"
      />

      {/* Coverflow silhouette: a focal 2:3 portrait flanked by two dimmed,
          slightly-shrunk neighbours that the focal overlaps (z-10 + negative
          margins) — the same widths the live ring uses. */}
      <div className="relative flex items-center justify-center">
        <Skeleton className="aspect-[2/3] w-[clamp(140px,16vw,240px)] shrink-0 scale-90 rounded-2xl opacity-60" />
        <Skeleton className="z-10 -mx-[3vw] aspect-[2/3] w-[clamp(320px,40vw,520px)] shrink-0 rounded-2xl shadow-[0_30px_80px_-24px_var(--shadow-3),0_8px_24px_-12px_var(--shadow-2)] max-[820px]:w-[min(70vw,400px)]" />
        <Skeleton className="aspect-[2/3] w-[clamp(140px,16vw,240px)] shrink-0 scale-90 rounded-2xl opacity-60" />
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {ru.common.loading}
      </p>
    </section>
  );
}
