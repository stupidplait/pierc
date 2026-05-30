"use client";

import type { Config } from "@imgly/background-removal";
import { IMGLY_PUBLIC_PATH } from "./wasm-urls";

type RemoveBackgroundFn = (
  imageSrc: ImageData | ArrayBuffer | Uint8Array | Blob | URL | string,
  config?: Config,
) => Promise<Blob>;

let cachedFn: RemoveBackgroundFn | null = null;

/**
 * Lazy-load and cache the imgly background-removal entry point. The library
 * is ~170 KB compressed and pulls ~80 MB of model+WASM chunks on first run
 * (cached in the browser thereafter). We dynamic-import so admins who never
 * open the sprite uploader pay zero cost.
 */
async function getRemoveBackground(): Promise<RemoveBackgroundFn> {
  if (cachedFn) return cachedFn;
  const mod = await import("@imgly/background-removal");
  // The runtime ESM module exposes named exports only — the README's
  // default-import example is misleading and the typed default export
  // doesn't exist in the actual .mjs file.
  cachedFn = mod.removeBackground as RemoveBackgroundFn;
  return cachedFn;
}

export interface BgRemovalProgress {
  /** 0..1 — progress against total bytes loaded for the first call. */
  fraction: number;
  /** Last load message, e.g. the chunk being fetched. */
  message: string;
}

export interface BgRemovalOptions {
  onProgress?: (p: BgRemovalProgress) => void;
}

/**
 * Run background removal on a File / Blob / URL and return a transparent
 * PNG Blob. Pulls model assets from our self-hosted Vercel Blob mirror
 * (see `IMGLY_PUBLIC_PATH`).
 *
 * Throws when the WASM mirror is missing — admin should run
 * `npm run lite:wasm` to populate Blob.
 */
export async function removeBackground(
  source: File | Blob | string,
  opts: BgRemovalOptions = {},
): Promise<Blob> {
  const fn = await getRemoveBackground();
  return fn(source, {
    publicPath: IMGLY_PUBLIC_PATH,
    output: { format: "image/png" },
    progress: opts.onProgress
      ? (key, current, total) => {
          const fraction = total > 0 ? current / total : 0;
          opts.onProgress?.({ fraction, message: key });
        }
      : undefined,
  });
}
