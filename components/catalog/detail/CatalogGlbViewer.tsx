"use client";

import dynamic from "next/dynamic";
import { useWebGL2Supported } from "@/lib/catalog/use-webgl2";
import { catalogStrings } from "@/lib/i18n/ru";
import { GlbPreviewBoundary } from "@/components/admin/GlbPreviewBoundary";
import { cn } from "@/lib/utils";

// Three.js needs `window` — defer the scene past hydration, never SSR it.
const GlbPreviewScene = dynamic(
  () => import("@/components/admin/GlbPreviewScene").then((m) => m.GlbPreviewScene),
  { ssr: false },
);

/**
 * Public-facing interactive 3D viewer for a piece's GLB on the detail page.
 * Mirrors the admin `GlbPreview` gate (WebGL2 check + dynamic ssr:false +
 * error boundary) but with customer-facing copy and a transparent surface so
 * it can sit on any variant's background. Callers only render it when
 * `piece.glbUrl` exists.
 */
export function CatalogGlbViewer({
  url,
  className,
}: {
  url: string;
  className?: string;
}) {
  const webgl2 = useWebGL2Supported();

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {webgl2 === false ? (
        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-mute">
          {catalogStrings.showroom.fallbackHint}
        </div>
      ) : webgl2 ? (
        <GlbPreviewBoundary
          key={url}
          fallback={
            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-mute">
              {catalogStrings.showroom.fallbackHint}
            </div>
          }
        >
          <GlbPreviewScene url={url} />
        </GlbPreviewBoundary>
      ) : null}
    </div>
  );
}
