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
import { MathUtils, Spherical, Vector3 } from "three";
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

// When framing a multi-anchor piece, the camera distance is computed from
// the bbox span × this multiplier. Roughly: distance such that the bbox fits
// within the camera frustum at the configured FOV with comfortable margin.
const MULTI_FRAME_DISTANCE_MULT = 2.4;
const MULTI_FRAME_MIN_DISTANCE = 0.1;
const MULTI_FRAME_MAX_DISTANCE = 0.6;

// Constrained user orbit: drag rotates the camera around the framed target,
// clamped to ±ORBIT_LIMIT (azimuth + polar) from the current preset so the
// piece never leaves frame. Resets to the preset when the focused anchor changes.
const ORBIT_LIMIT = Math.PI / 4; // ±45°
const ORBIT_SPEED = 0.005; // radians per px dragged
const ORBIT_MOVE_TOLERANCE = 4; // px before a press becomes a drag (vs. a dot click)
const ORBIT_DAMP = 6; // lower = softer/floatier follow; higher = snappier
// Frame-rate-independent ease for the anchor→anchor camera glide. Lower =
// slower / more cinematic. (≈ the old 0.08/frame lerp was ~5.)
const MOVE_DAMP = 2.6;

// Reusable scratch so the per-frame arc math doesn't allocate.
const _arcSph = new Spherical();
const _arcOffset = new Vector3();

/** Place the camera on a sphere around `look`, offset by the user's clamped
 *  azimuth/polar orbit. Pure — no closure over component state. */
function placeCamera(
  camera: { position: Vector3; lookAt: (v: Vector3) => void },
  basePos: Vector3,
  look: Vector3,
  az: number,
  polar: number,
) {
  const offset = basePos.clone().sub(look);
  const sph = new Spherical().setFromVector3(offset);
  sph.theta += az;
  sph.phi = clamp(sph.phi + polar, 0.12, Math.PI - 0.12);
  sph.makeSafe();
  offset.setFromSpherical(sph);
  camera.position.copy(look).add(offset);
  camera.lookAt(look);
}

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
  const { camera, invalidate, gl } = useThree();

  const targetPosRef = useRef<Vector3>(DEFAULT_POS.clone());
  const targetLookRef = useRef<Vector3>(DEFAULT_TARGET.clone());
  const basePosRef = useRef<Vector3>(DEFAULT_POS.clone());
  const currentLookRef = useRef<Vector3>(DEFAULT_TARGET.clone());
  const isMovingRef = useRef<boolean>(false);
  // First effect run snaps straight to the framed view (no fly-in from the
  // canvas default) so the catalog lands already looking at the initial anchor.
  const firstFrameRef = useRef<boolean>(true);
  const prevAnchorIdRef = useRef<string | null>(null);

  // User orbit offset (clamped). The drag sets the *target*; the frame loop
  // damps the *current* toward it for a buttery follow + ease-out on release.
  const azRef = useRef(0);
  const polarRef = useRef(0);
  const targetAzRef = useRef(0);
  const targetPolarRef = useRef(0);
  const draggingRef = useRef(false);

  // Arc tween: the camera travels AROUND a pivot on the body's central axis in
  // spherical coords — azimuth (theta) and elevation (phi) ease INDEPENDENTLY,
  // so a combined left↔right + high↔low switch (e.g. left ear → right hip)
  // sweeps around the FRONT of the figure instead of looping over the top of
  // the head. (The old single-quaternion slerp took the shortest 3D geodesic,
  // which crested the pole when the elevation change was large.) Per tween we
  // store the start/target spherical offsets, the shortest azimuth delta, and a
  // clearance bow; the frame loop lerps each channel.
  const tweenRef = useRef(1);
  const startLookRef = useRef<Vector3>(new Vector3());
  const pivotRef = useRef<Vector3>(new Vector3());
  const startSphRef = useRef<Spherical>(new Spherical(1, Math.PI / 2, 0));
  const targetSphRef = useRef<Spherical>(new Spherical(1, Math.PI / 2, 0));
  const thetaDeltaRef = useRef(0);
  const bowRef = useRef(0);

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

  // Pointer-drag orbit on the bare canvas, clamped to ±ORBIT_LIMIT. Starts only
  // on a canvas press (overlays/cards sit above and swallow their own presses),
  // and ignores sub-tolerance moves so clicking an anchor dot doesn't orbit.
  useEffect(() => {
    const el = gl.domElement;
    let lastX = 0;
    let lastY = 0;
    let moved = 0;
    const onDown = (e: PointerEvent) => {
      draggingRef.current = true;
      lastX = e.clientX;
      lastY = e.clientY;
      moved = 0;
    };
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved < ORBIT_MOVE_TOLERANCE) return;
      targetAzRef.current = clamp(
        targetAzRef.current - dx * ORBIT_SPEED,
        -ORBIT_LIMIT,
        ORBIT_LIMIT,
      );
      targetPolarRef.current = clamp(
        targetPolarRef.current - dy * ORBIT_SPEED,
        -ORBIT_LIMIT,
        ORBIT_LIMIT,
      );
      // Keep the loop running so the current value damps toward the target.
      isMovingRef.current = true;
      invalidate();
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [gl, invalidate]);

  useEffect(() => {
    const pos = frame ? frame.position : DEFAULT_POS.clone();
    const look = frame ? frame.target : DEFAULT_TARGET.clone();
    const fov = frame ? frame.fov : DEFAULT_FOV;
    targetPosRef.current = pos;
    targetLookRef.current = look;
    if ("fov" in camera && typeof camera.fov === "number") {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    // Recenter the orbit whenever the focused anchor changes — but only the
    // TARGET, so any active user orbit unwinds *smoothly* toward 0 while the
    // camera glides to the new anchor. (Snapping the current value to 0 was
    // what made a switch-after-rotating jump instantly.)
    const anchorId = anchor?.id ?? null;
    if (anchorId !== prevAnchorIdRef.current) {
      targetAzRef.current = 0;
      targetPolarRef.current = 0;
      prevAnchorIdRef.current = anchorId;
    }

    if (firstFrameRef.current) {
      // Land already framed — no animation from the canvas default.
      firstFrameRef.current = false;
      basePosRef.current.copy(pos);
      currentLookRef.current.copy(look);
      tweenRef.current = 1;
      placeCamera(camera, basePosRef.current, currentLookRef.current, 0, 0);
      isMovingRef.current = false;
    } else {
      // Set up a spherical arc from the current camera state to the new framing.
      // Pivot sits on the body's vertical axis at the mid look-height; both
      // endpoints orbit it. Interpolating azimuth + elevation SEPARATELY (rather
      // than slerping the 3D direction) keeps elevation monotonic between the
      // two presets, so the path never overshoots up over the head.
      const start = basePosRef.current.clone();
      startLookRef.current.copy(currentLookRef.current);
      pivotRef.current.set(0, (currentLookRef.current.y + look.y) / 2, 0);
      startSphRef.current.setFromVector3(start.sub(pivotRef.current));
      targetSphRef.current.setFromVector3(pos.clone().sub(pivotRef.current));
      if (startSphRef.current.radius < 1e-4) startSphRef.current.radius = 1e-4;
      if (targetSphRef.current.radius < 1e-4) targetSphRef.current.radius = 1e-4;
      // Shortest way around for the azimuth so it crosses the FRONT (both
      // presets sit in front of the figure), never the long way past the back.
      let dTheta = targetSphRef.current.theta - startSphRef.current.theta;
      while (dTheta > Math.PI) dTheta -= Math.PI * 2;
      while (dTheta < -Math.PI) dTheta += Math.PI * 2;
      thetaDeltaRef.current = dTheta;
      // Bow the radius out at the arc midpoint, scaled by how far we sweep
      // horizontally, so a big left↔right move clears the torso as it crosses
      // the front. Small / same-side moves barely bow at all.
      bowRef.current = Math.min(Math.abs(dTheta) / Math.PI, 1) * 0.14;
      tweenRef.current = 0;
      isMovingRef.current = true;
    }
    invalidate();
  }, [frame, camera, invalidate, anchor]);

  useFrame((_, delta) => {
    if (!isMovingRef.current && !draggingRef.current) return;
    const dt = Math.min(delta, 0.05);

    // Advance the arc tween (cinematic ease-out), then sweep position around
    // the pivot: slerp the direction, lerp the radius. Look lerps straight.
    if (isMovingRef.current) {
      tweenRef.current = MathUtils.damp(tweenRef.current, 1, MOVE_DAMP, dt);
      const t = tweenRef.current;
      if (t > 0.999) {
        basePosRef.current.copy(targetPosRef.current);
        currentLookRef.current.copy(targetLookRef.current);
        isMovingRef.current = false;
      } else {
        const start = startSphRef.current;
        const end = targetSphRef.current;
        // Ease azimuth + elevation independently; clamp phi off the poles so the
        // sweep stays around the figure, plus a sine-bowed radius for clearance.
        _arcSph.theta = start.theta + thetaDeltaRef.current * t;
        _arcSph.phi = clamp(
          MathUtils.lerp(start.phi, end.phi, t),
          0.12,
          Math.PI - 0.12,
        );
        _arcSph.radius =
          MathUtils.lerp(start.radius, end.radius, t) +
          Math.sin(t * Math.PI) * bowRef.current;
        _arcSph.makeSafe();
        _arcOffset.setFromSpherical(_arcSph);
        basePosRef.current.copy(pivotRef.current).add(_arcOffset);
        currentLookRef.current.lerpVectors(
          startLookRef.current,
          targetLookRef.current,
          t,
        );
      }
    }

    // Buttery orbit: frame-rate-independent exponential ease toward the target.
    azRef.current = MathUtils.damp(azRef.current, targetAzRef.current, ORBIT_DAMP, dt);
    polarRef.current = MathUtils.damp(
      polarRef.current,
      targetPolarRef.current,
      ORBIT_DAMP,
      dt,
    );
    placeCamera(
      camera,
      basePosRef.current,
      currentLookRef.current,
      azRef.current,
      polarRef.current,
    );

    const orbitSettled =
      Math.abs(azRef.current - targetAzRef.current) < 1e-4 &&
      Math.abs(polarRef.current - targetPolarRef.current) < 1e-4;

    if (!isMovingRef.current && orbitSettled && !draggingRef.current) {
      azRef.current = targetAzRef.current;
      polarRef.current = targetPolarRef.current;
      placeCamera(
        camera,
        basePosRef.current,
        currentLookRef.current,
        azRef.current,
        polarRef.current,
      );
    } else {
      invalidate(); // request another frame while still easing
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
