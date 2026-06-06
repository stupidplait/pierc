// Route-level loader for /catalog. Overrides the generic content skeleton at
// app/loading.tsx — the catalog is a full-bleed dark 3D stage, so a card-grid
// skeleton mismatches badly. This matches the scene's dark surface + the same
// spinner the WebGL stage shows, so route-stream → scene-load reads as one
// continuous load.

import { catalogStrings } from "@/lib/i18n/ru";

export default function CatalogLoading() {
  return (
    <div className="grid h-svh place-items-center bg-bg">
      <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
        <span className="size-9 animate-spin rounded-full border-2 border-line border-t-accent" />
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">
          {catalogStrings.showroom.sceneLoading}
        </p>
      </div>
    </div>
  );
}
