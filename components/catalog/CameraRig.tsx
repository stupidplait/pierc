"use client";

/* eslint-disable react-hooks/immutability --
 * Three.js camera-rig pattern: we reassign Vector3 refs on anchor change and
 * mutate the live camera object (position via .lerp(), and fov + projection
 * matrix via direct assignment). React Compiler flags any of these as
 * post-render mutation, but they're the canonical r3f pattern.
 */

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import type { AnchorWire } from "@/lib/catalog/types";

interface CameraRigProps {
  anchor: AnchorWire | null;
}

// Default "full body" view — used when no anchor is selected.
const DEFAULT_POS = new Vector3(0, 1.25, 1.6);
const DEFAULT_TARGET = new Vector3(0, 1.05, 0);
const DEFAULT_FOV = 35;

// Distance threshold below which we consider the camera "settled" and stop
// invalidating the frame loop. Tuned for the showroom's body-scale (~1m).
const SETTLE_THRESHOLD = 0.0008;

/**
 * Tween the active camera between presets. Each anchor's first cameraPreset
 * (seeded server-side) is used as the focused view.
 *
 * Frame-loop integration: paired with `frameloop="demand"` on the parent
 * <Canvas/>. When the anchor changes, `isMovingRef` flips true; useFrame
 * lerps + calls `invalidate()` until the camera converges, then idles.
 * Mobile battery loves this.
 */
export function CameraRig({ anchor }: CameraRigProps) {
  const { camera, invalidate } = useThree();

  const targetPosRef = useRef<Vector3>(DEFAULT_POS.clone());
  const targetLookRef = useRef<Vector3>(DEFAULT_TARGET.clone());
  const currentLookRef = useRef<Vector3>(DEFAULT_TARGET.clone());
  const isMovingRef = useRef<boolean>(false);

  useEffect(() => {
    if (anchor && anchor.cameraPresets[0]) {
      const preset = anchor.cameraPresets[0];
      targetPosRef.current = new Vector3(
        preset.position.x,
        preset.position.y,
        preset.position.z,
      );
      targetLookRef.current = new Vector3(
        preset.target.x,
        preset.target.y,
        preset.target.z,
      );
      if ("fov" in camera && typeof camera.fov === "number") {
        camera.fov = preset.fov;
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
  }, [anchor, camera, invalidate]);

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
