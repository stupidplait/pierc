"use client";

import dynamic from "next/dynamic";
import { useWebGL2Supported } from "@/lib/catalog/use-webgl2";
import { ru } from "@/lib/i18n/ru";
import { GlbPreviewBoundary } from "./GlbPreviewBoundary";
import type { GlbStats } from "./GlbPreviewScene";

export type { GlbStats } from "./GlbPreviewScene";

// Three.js needs `window` — defer the whole scene past hydration, never SSR it.
const GlbPreviewScene = dynamic(
  () => import("./GlbPreviewScene").then((m) => m.GlbPreviewScene),
  { ssr: false },
);

/**
 * GlbPreview — client gate + framed surface for the interactive jewelry GLB
 * viewer used in the admin model panel. Lets the admin orbit/zoom an uploaded
 * or AI-generated piece to verify it before publishing/approving.
 *
 * Follows the project's 3D discipline: WebGL2-gated, `dynamic(ssr:false)`,
 * dpr-capped (in the scene). On browsers without WebGL2 it shows a short
 * notice — callers keep their "open .glb" link as the real fallback.
 *
 * `onStats` bubbles the loaded GLB's geometry tally up to the inspector.
 *
 * Orientation editing: pass `quaternion` to rotate the model in the preview and
 * `lockCamera` to fix the camera face-on (so X/Y/Z controls map to consistent
 * screen directions). `showAttach` draws the attach:primary marker.
 */
export function GlbPreview({
  url,
  className = "",
  onStats,
  quaternion,
  showAttach = false,
  lockCamera = false,
  pickMode = false,
  onPick,
  pickedPoint = null,
}: {
  url: string;
  className?: string;
  onStats?: (stats: GlbStats) => void;
  /** Live model orientation [x,y,z,w] applied in the preview (pre-save). */
  quaternion?: [number, number, number, number];
  /** Show a marker at the attach:primary point (where it meets the piercing). */
  showAttach?: boolean;
  /** Lock the camera face-on (orientation-editing mode). */
  lockCamera?: boolean;
  /** Click the model to set a new attach point (returns local-space hit). */
  pickMode?: boolean;
  onPick?: (point: [number, number, number]) => void;
  pickedPoint?: [number, number, number] | null;
}) {
  const webgl2 = useWebGL2Supported();

  return (
    <div
      className={`relative aspect-square w-full overflow-hidden rounded-xl border border-line bg-bg ${className}`}
    >
      {webgl2 === false ? (
        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-mute">
          {ru.admin.jewelry.model.previewUnavailable}
        </div>
      ) : webgl2 ? (
        // Keyed by url so a new model resets the boundary after a prior
        // load failure (expired/403 link). Without this, one bad GLB would
        // crash the whole edit page instead of just this preview box.
        <GlbPreviewBoundary
          key={url}
          fallback={
            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-mute">
              {ru.admin.jewelry.model.previewLoadError}
            </div>
          }
        >
          <GlbPreviewScene
            url={url}
            onStats={onStats}
            quaternion={quaternion}
            showAttach={showAttach}
            lockCamera={lockCamera}
            pickMode={pickMode}
            onPick={onPick}
            pickedPoint={pickedPoint}
          />
        </GlbPreviewBoundary>
      ) : null}
    </div>
  );
}
