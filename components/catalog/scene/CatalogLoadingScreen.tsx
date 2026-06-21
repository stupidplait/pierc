// Shared catalog loading visual. Server-safe (no hooks / no "use client") so it
// can be rendered identically by every phase of the catalog load:
//   1. the route Suspense fallback   (app/(public)/catalog/loading.tsx)
//   2. the ssr:false chunk fallback  (scene/LazyStage.tsx)
//   3. the in-canvas scene cover     (scene/SceneLoader.tsx)
//
// Rendering the *same* spinner on the *same* bg-bg surface across all three
// makes route-stream → chunk-download → asset-load read as ONE continuous
// loader that simply fades to the scene — instead of the old spinner → bare
// text → spinner+% sequence that looked like several stacked preloaders.

import { cn } from "@/lib/utils";
import { catalogStrings } from "@/lib/i18n/ru";

export function CatalogLoadingScreen({
  className,
  label = catalogStrings.showroom.sceneLoading,
  announce = false,
}: {
  /** Sizing override — the route fallback fills the viewport (`h-svh`), the
   *  in-stage covers fill their box (`h-full`). */
  className?: string;
  label?: string;
  /**
   * Expose this loader as a polite live region to assistive tech. Only ONE of
   * the (up to three) sequential catalog loaders should announce — otherwise a
   * screen reader re-reads the same caption as each Suspense/chunk/scene
   * boundary swaps. The route fallback announces; the chunk fallback and the
   * in-canvas cover stay hidden from the a11y tree.
   */
  announce?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid h-full w-full place-items-center bg-bg",
        className,
      )}
      {...(announce
        ? { role: "status", "aria-live": "polite" as const }
        : { "aria-hidden": true })}
    >
      <div className="flex flex-col items-center gap-3">
        <span
          className="size-9 animate-spin rounded-full border-2 border-line border-t-accent"
          aria-hidden
        />
        {label ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">
            {label}
          </p>
        ) : null}
      </div>
    </div>
  );
}
