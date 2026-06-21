"use client";

import dynamic from "next/dynamic";
import { CatalogLoadingScreen } from "./CatalogLoadingScreen";

/**
 * Client-only `<ShowroomStage>` boundary. Three.js / r3f / postprocessing touch
 * `window`, so the Canvas must never render on the server — every catalog
 * layout mounts the stage through this single `ssr:false` import and shares
 * one loading shell. Re-exported under the original name so JSX reads
 * `<ShowroomStage .../>`.
 *
 * The chunk-download fallback uses the shared <CatalogLoadingScreen> (same
 * spinner as the route fallback + the in-canvas cover) so the hand-off from
 * route-stream → chunk-download → scene-load is visually seamless.
 */
export const ShowroomStage = dynamic(
  () => import("./ShowroomStage").then((m) => m.ShowroomStage),
  {
    ssr: false,
    loading: () => <CatalogLoadingScreen className="h-full" />,
  },
);
