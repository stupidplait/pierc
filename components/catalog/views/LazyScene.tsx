"use client";

import dynamic from "next/dynamic";
import { catalogStrings } from "@/lib/i18n/ru";

/**
 * Client-only `<ShowroomScene>` wrapper. Three.js / react-three-fiber touch
 * `window`, so the Canvas must never render on the server — every catalog
 * variant imports the scene through this single `ssr:false` boundary (and
 * shares one loading shell) instead of repeating the dynamic import.
 *
 * Re-exported under the original name so view JSX stays `<ShowroomScene .../>`.
 */
export const ShowroomScene = dynamic(
  () => import("../ShowroomScene").then((m) => m.ShowroomScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-sm text-mute">
        {catalogStrings.showroom.sceneLoading}
      </div>
    ),
  },
);
