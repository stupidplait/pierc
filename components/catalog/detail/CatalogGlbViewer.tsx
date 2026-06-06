"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useWebGL2Supported } from "@/lib/catalog/use-webgl2";
import { catalogStrings } from "@/lib/i18n/ru";
import type { LoaderVariant } from "@/lib/catalog/lab-state";
import { GlbPreviewBoundary } from "@/components/admin/GlbPreviewBoundary";
import { Spinner } from "@/components/catalog/scene/SceneLoader";
import { cn } from "@/lib/utils";

// Three.js needs `window` — defer the scene past hydration, never SSR it.
const GlbPreviewScene = dynamic(
  () => import("@/components/admin/GlbPreviewScene").then((m) => m.GlbPreviewScene),
  { ssr: false },
);

/**
 * Public-facing interactive 3D viewer for a piece's GLB on the detail page +
 * the in-rail card page. Mirrors the admin `GlbPreview` gate (WebGL2 check +
 * dynamic ssr:false + error boundary) with customer-facing copy and a
 * transparent surface. Shows a branded spinner until the model's first stats
 * arrive (i.e. it's loaded). Callers only render it when `piece.glbUrl` exists.
 */
export function CatalogGlbViewer({
  url,
  className,
  loaderVariant = "spinner",
}: {
  url: string;
  className?: string;
  loaderVariant?: LoaderVariant;
}) {
  const webgl2 = useWebGL2Supported();
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {webgl2 === false ? (
        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-mute">
          {catalogStrings.showroom.fallbackHint}
        </div>
      ) : webgl2 ? (
        <>
          <GlbPreviewBoundary
            key={url}
            fallback={
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-mute">
                {catalogStrings.showroom.fallbackHint}
              </div>
            }
          >
            <GlbPreviewScene url={url} onStats={() => setLoaded(true)} />
          </GlbPreviewBoundary>
          {!loaded ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <Spinner variant={loaderVariant} />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
