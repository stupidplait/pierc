/**
 * Vercel Blob URLs for self-hosted lite-mode WASM assets.
 *
 * The `BLOB_PUBLIC_ORIGIN` is the project's public Blob URL prefix —
 * derived from any committed Blob URL (see e.g. the seed-data jewelry
 * uploads). It does not include a trailing slash.
 *
 * If you ever migrate to a new Blob project (different account / region),
 * update this constant. The `lite:wasm` mirror script and runtime callers
 * both read from here.
 *
 * See docs/15-lite-mode.md "WASM hosting" for the full strategy.
 */
export const BLOB_PUBLIC_ORIGIN =
  "https://4hfidxargsvlocxu.public.blob.vercel-storage.com";

/**
 * Folder URL the `@imgly/background-removal` library uses as its
 * `publicPath` config option. The library appends `resources.json`
 * (manifest) and individual chunk hashes to this prefix; both must
 * exist as files on Blob, populated by `npm run lite:wasm`.
 *
 * MUST end with a trailing slash so `new URL(chunkName, publicPath)`
 * resolves correctly.
 */
export const IMGLY_PUBLIC_PATH = `${BLOB_PUBLIC_ORIGIN}/lite/imgly/`;

/**
 * Direct URL to the MediaPipe Face Landmarker `.task` model used by
 * lite-mode at runtime (Task 4). Mirrored from MediaPipe's GCS by the
 * same `lite:wasm` script.
 */
export const FACE_LANDMARKER_MODEL_URL = `${BLOB_PUBLIC_ORIGIN}/lite/mediapipe/face_landmarker.task`;
