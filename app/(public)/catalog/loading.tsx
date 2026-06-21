// Route-level loader for /catalog. Overrides the generic content skeleton at
// app/loading.tsx — the catalog is a full-bleed dark 3D stage, so a card-grid
// skeleton mismatches badly. Renders the SAME spinner the chunk fallback and
// the in-canvas scene cover use, so route-stream → chunk-download → scene-load
// reads as one continuous loader rather than several stacked preloaders.

import { CatalogLoadingScreen } from "@/components/catalog/scene/CatalogLoadingScreen";

export default function CatalogLoading() {
  // The route fallback is the single loader that announces to assistive tech;
  // the downstream chunk fallback + in-canvas cover render the same visual but
  // stay out of the a11y tree so the caption isn't re-read on every boundary
  // swap (see CatalogLoadingScreen `announce`).
  return <CatalogLoadingScreen className="h-svh" announce />;
}
