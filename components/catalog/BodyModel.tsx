"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Object3D } from "three";

/**
 * Loads the real CC3 body.glb (A-pose mannequin, ~340 KB Draco-compressed)
 * exported by the Blender pipeline (see scripts/blender/ + README "Body model
 * pipeline" for details).
 *
 * The .glb contains:
 *   - 5 meshes: Body, Hair_30629, Eye, Teeth, Underwear_Bottoms
 *   - 29 named anchor empties (anchor:left-ear-lobe, anchor:septum, …)
 *
 * The anchor empties are hidden here because the showroom renders its own
 * <AnchorDots> driven by the DB rows (see prisma/seed-data/anchors.json),
 * so we don't need the GLB's empties to be visible. Their transforms remain
 * in the scene graph for any code path that wants to read them via
 * `scene.getObjectByName("anchor:slug")`.
 *
 * Coordinate system (matches what the rest of the showroom assumes):
 *   • origin at the floor between feet
 *   • +Y is up
 *   • +Z is "forward" (toward the camera by default)
 *
 * Body height is 1.7 m, feet on Y=0.
 */
export function BodyModel() {
  return (
    <Suspense fallback={null}>
      <BodyMesh />
    </Suspense>
  );
}

function BodyMesh() {
  const gltf = useGLTF("/models/body/body.glb");

  // Hide all `anchor:*` empties so they don't render or eat picks.
  // Mark the scene as body model for occlusion culling optimization.
  useEffect(() => {
    gltf.scene.userData.isBodyModel = true;
    gltf.scene.traverse((obj: Object3D) => {
      if (obj.name.startsWith("anchor:")) {
        obj.visible = false;
        // No mesh on empties so no further hiding needed.
      }
    });
  }, [gltf.scene]);

  // Per-render clone is unnecessary — there's only one body in the scene.
  // We use the cached scene directly.
  const scene = useMemo(() => gltf.scene, [gltf.scene]);

  return <primitive object={scene} />;
}

// Eagerly preload the GLB at module import time so the first render can
// short-circuit the Suspense fallback when the user navigates fast.
useGLTF.preload("/models/body/body.glb");
