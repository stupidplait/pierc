import { Vector3 } from "three";
import type { AnchorWire, JewelryWire } from "@/lib/catalog/types";

export interface Frame {
  position: Vector3;
  target: Vector3;
  fov: number;
}

// When framing a multi-anchor piece, the camera distance is computed from
// the bbox span × this multiplier. Roughly: distance such that the bbox fits
// within the camera frustum at the configured FOV with comfortable margin.
const MULTI_FRAME_DISTANCE_MULT = 2.4;
const MULTI_FRAME_MIN_DISTANCE = 0.1;
const MULTI_FRAME_MAX_DISTANCE = 0.6;

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Computes the framing for the camera based on selected anchor + equipped
 * jewelry. Returns null when nothing is selected (caller falls back to the
 * default body-shot).
 *
 * Single-anchor: returns the anchor's first preset verbatim.
 * Multi-anchor: target = centroid of all endpoints, position = preset's
 *   anchor-relative offset rebased on the centroid + scaled distance to fit
 *   the bbox.
 */
export function computeFrame(
  anchor: AnchorWire | null,
  equippedAnchors: AnchorWire[] | null,
  equippedJewelry: JewelryWire | null,
): Frame | null {
  if (!anchor || !anchor.cameraPresets[0]) return null;
  const preset = anchor.cameraPresets[0];
  const presetPos = new Vector3(
    preset.position.x,
    preset.position.y,
    preset.position.z,
  );
  const presetTarget = new Vector3(
    preset.target.x,
    preset.target.y,
    preset.target.z,
  );
  const presetFov = preset.fov;

  // Single-anchor path: use the preset verbatim.
  const isMulti =
    equippedJewelry !== null &&
    equippedAnchors !== null &&
    equippedAnchors.length >= 2 &&
    equippedJewelry.piercingCount >= 2;
  if (!isMulti) {
    return { position: presetPos, target: presetTarget, fov: presetFov };
  }

  // Multi-anchor path: centre on the centroid, expand distance to fit bbox.
  const centroid = new Vector3();
  for (const a of equippedAnchors!) {
    centroid.add(new Vector3(a.position.x, a.position.y, a.position.z));
  }
  centroid.divideScalar(equippedAnchors!.length);

  // Bbox diagonal across all endpoints — what we need to fit on screen.
  let maxSpan = 0;
  for (let i = 0; i < equippedAnchors!.length; i += 1) {
    for (let j = i + 1; j < equippedAnchors!.length; j += 1) {
      const a = equippedAnchors![i].position;
      const b = equippedAnchors![j].position;
      const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      if (d > maxSpan) maxSpan = d;
    }
  }

  // The preset's offset from its anchor — direction the camera should sit
  // relative to the centroid. We preserve the angle, just rescale distance.
  const presetOffset = presetPos.clone().sub(presetTarget);
  const presetDist = presetOffset.length() || 0.3;

  const desiredDist = clamp(
    maxSpan * MULTI_FRAME_DISTANCE_MULT,
    MULTI_FRAME_MIN_DISTANCE,
    MULTI_FRAME_MAX_DISTANCE,
  );
  const newDist = Math.max(presetDist, desiredDist);
  const newOffset = presetOffset.multiplyScalar(newDist / presetDist);

  return {
    position: centroid.clone().add(newOffset),
    target: centroid,
    fov: presetFov,
  };
}
