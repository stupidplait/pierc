"use client";

/* eslint-disable react-hooks/immutability --
 * Three.js camera-rig pattern: we reassign Vector3 refs on anchor change and
 * mutate the live camera object (position via .lerp(), and fov + projection
 * matrix via direct assignment). React Compiler flags any of these as
 * post-render mutation, but they're the canonical r3f pattern.
 *
 * The component itself opts out of React Compiler via `"use no memo"` below —
 * compiler errors aren't suppressible by ESLint disables, only by the directive.
 * The eslint-disable still silences the editor's hook-immutability warnings.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import type { AnchorWire, JewelryWire } from "@/lib/catalog/types";

interface CameraRigProps {
  anchor: AnchorWire | null;
  /**
   * The jewelry currently equipped at `anchor`. When this jewelry is a
   * multi-anchor type (BARBELL / CIRCULAR_BARBELL / ORBITAL / CHAIN_LADDER)
   * AND multiple of its bindings are equipped, we expand the frame to fit
   * all the equipped endpoints — otherwise the camera might look at a
   * 14mm bar through one end and miss the other. Optional; falls back to
   * the legacy single-anchor framing when null/empty.
   *
   * Phase B: see docs/20-multi-anchor-jewelry.md.
   */
  equippedAnchorsForFraming?: AnchorWire[];
  equippedJewelry?: JewelryWire | null;
}

// Default "full body" view — used when no anchor is selected.
const DEFAULT_POS = new Vector3(0, 1.25, 1.6);
const DEFAULT_TARGET = new Vector3(0, 1.05, 0);
const DEFAULT_FOV = 35;

// Distance threshold below which we consider the camera "settled" and stop
// invalidating the frame loop. Tuned for the showroom's body-scale (~1m).
const SETTLE_THRESHOLD = 0.0008;

// When framing a multi-anchor piece, the camera distance is computed from
// the bbox span × this multiplier. Roughly: distance such that the bbox fits
// within the camera frustum at the configured FOV with comfortable margin.
const MULTI_FRAME_DISTANCE_MULT = 2.4;
const MULTI_FRAME_MIN_DISTANCE = 0.1;
const MULTI_FRAME_MAX_DISTANCE = 0.6;

/**
 * Tween the active camera between presets. Each anchor's first cameraPreset
 * (seeded server-side) is used as the focused view.
 *
 * Multi-anchor pieces: when an anchor is part of an equipped multi-anchor
 * jewelry (e.g. industrial bar), the framing target is the centroid of all
 * its endpoints and the camera is pulled back enough to fit the span. Falls
 * back to the per-anchor preset when single-anchor / nothing equipped.
 *
 * Frame-loop integration: paired with `frameloop="demand"` on the parent
 * <Canvas/>. When the anchor changes, `isMovingRef` flips true; useFrame
 * lerps + calls `invalidate()` until the camera converges, then idles.
 * Mobile battery loves this.
 */
export function CameraRig({
  anchor,
  equippedAnchorsForFraming,
  equippedJewelry,
}: CameraRigProps) {
  "use no memo";
  const { camera, invalidate } = useThree();

  const targetPosRef = useRef<Vector3>(DEFAULT_POS.clone());
  const targetLookRef = useRef<Vector3>(DEFAULT_TARGET.clone());
  const currentLookRef = useRef<Vector3>(DEFAULT_TARGET.clone());
  const isMovingRef = useRef<boolean>(false);

  // Compute the framing target — either the per-anchor preset OR an expanded
  // multi-anchor frame.
  const frame = useMemo(
    () =>
      computeFrame(
        anchor,
        equippedAnchorsForFraming ?? null,
        equippedJewelry ?? null,
      ),
    [anchor, equippedAnchorsForFraming, equippedJewelry],
  );

  useEffect(() => {
    if (frame) {
      targetPosRef.current = frame.position;
      targetLookRef.current = frame.target;
      if ("fov" in camera && typeof camera.fov === "number") {
        camera.fov = frame.fov;
        camera.updateProjectionMatrix();
      }
    } else {
      targetPosRef.current = DEFAULT_POS.clone();
      targetLookRef.current = DEFAULT_TARGET.clone();
      if ("fov" in camera && typeof camera.fov === "number") {
        camera.fov = DEFAULT_FOV;
        camera.updateProjectionMatrix();
      }
    }
    isMovingRef.current = true;
    invalidate(); // kick off the tween
  }, [frame, camera, invalidate]);

  useFrame(() => {
    if (!isMovingRef.current) return;

    camera.position.lerp(targetPosRef.current, 0.08);
    currentLookRef.current.lerp(targetLookRef.current, 0.08);
    camera.lookAt(currentLookRef.current);

    const dist = camera.position.distanceTo(targetPosRef.current);
    if (dist < SETTLE_THRESHOLD) {
      // Snap to exact target and stop the loop.
      camera.position.copy(targetPosRef.current);
      currentLookRef.current.copy(targetLookRef.current);
      camera.lookAt(currentLookRef.current);
      isMovingRef.current = false;
    } else {
      invalidate(); // request another frame
    }
  });

  return null;
}

interface Frame {
  position: Vector3;
  target: Vector3;
  fov: number;
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
function computeFrame(
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

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
