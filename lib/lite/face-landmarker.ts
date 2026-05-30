"use client";

import type {
  FaceLandmarker,
  FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { LITE_ANCHORS } from "./anchor-config";
import type { AnchorPlacement } from "./types";
import { FACE_LANDMARKER_MODEL_URL } from "./wasm-urls";

/**
 * MediaPipe ships its WASM runtime files (~9 MB each) inside the npm
 * package. We point FilesetResolver at jsDelivr's pinned-version CDN —
 * this matches Google's recommended setup, avoids bundling the heavy
 * wasm into our build output, and gets globally cached for free.
 *
 * The .task model itself is self-hosted on Vercel Blob (see
 * FACE_LANDMARKER_MODEL_URL) so we can pin and version it.
 */
const VISION_WASM_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm";

let cachedLandmarkerPromise: Promise<FaceLandmarker> | null = null;

async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (cachedLandmarkerPromise) return cachedLandmarkerPromise;

  cachedLandmarkerPromise = (async () => {
    const { FaceLandmarker, FilesetResolver } = await import(
      "@mediapipe/tasks-vision"
    );
    const fileset = await FilesetResolver.forVisionTasks(VISION_WASM_BASE_URL);
    return FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: FACE_LANDMARKER_MODEL_URL,
        delegate: "GPU",
      },
      runningMode: "IMAGE",
      numFaces: 1,
    });
  })();

  return cachedLandmarkerPromise;
}

/** A single landmark resolved into image-pixel space. */
export interface DetectionOutcome {
  /** Resolved placements for the 7 v1 anchors. */
  placements: AnchorPlacement[];
  /** Number of faces the landmarker detected (we only use the first). */
  facesDetected: number;
  /** Raw MediaPipe result, useful for debug rendering. */
  raw: FaceLandmarkerResult;
}

/**
 * Run face landmark detection on a loaded image and convert the result
 * into our `AnchorPlacement[]` shape (pixel coords + face bbox width
 * for sprite scaling).
 *
 * Returns `null` if no face was detected — caller should surface a
 * "не нашли лицо на фото" message.
 */
export async function detectFacePlacements(
  image: HTMLImageElement | HTMLCanvasElement,
  imageWidth: number,
  imageHeight: number,
): Promise<DetectionOutcome | null> {
  const landmarker = await getFaceLandmarker();
  const result = landmarker.detect(image);
  const faces = result.faceLandmarks ?? [];
  if (faces.length === 0) return null;

  const landmarks = faces[0]; // numFaces:1 — only the first face matters.

  // Compute the face bounding-box width in pixels — used to scale sprites.
  let minX = 1;
  let maxX = 0;
  for (const lm of landmarks) {
    if (lm.x < minX) minX = lm.x;
    if (lm.x > maxX) maxX = lm.x;
  }
  const faceBboxWidth = Math.max(1, (maxX - minX) * imageWidth);

  const placements: AnchorPlacement[] = [];
  for (const cfg of LITE_ANCHORS) {
    const lm = landmarks[cfg.landmarkIdx];
    if (!lm) continue;
    placements.push({
      anchorSlug: cfg.slug,
      pixel: { x: lm.x * imageWidth, y: lm.y * imageHeight },
      faceBboxWidth,
    });
  }

  return {
    placements,
    facesDetected: faces.length,
    raw: result,
  };
}
