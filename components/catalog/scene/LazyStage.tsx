"use client";

import dynamic from "next/dynamic";
import { catalogStrings } from "@/lib/i18n/ru";

/**
 * Client-only `<CatalogStage>` boundary. Three.js / r3f / postprocessing touch
 * `window`, so the Canvas must never render on the server — every catalog
 * layout mounts the stage through this single `ssr:false` import and shares
 * one loading shell. Re-exported under the original name so JSX reads
 * `<CatalogStage .../>`.
 */
export const CatalogStage = dynamic(
  () => import("./CatalogStage").then((m) => m.CatalogStage),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-sm text-mute">
        {catalogStrings.showroom.sceneLoading}
      </div>
    ),
  },
);
