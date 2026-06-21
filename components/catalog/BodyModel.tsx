"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Object3D } from "three";
import { buildBoundsTrees } from "@/lib/three/bvh";

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
export function BodyModel({ onReady }: { onReady?: () => void }) {
  return (
    <Suspense fallback={null}>
      <BodyMesh onReady={onReady} />
    </Suspense>
  );
}

// Self-hosted Draco decoder (public/draco/) instead of drei's default gstatic
// CDN — body.glb is Draco-compressed and would otherwise fail under strict CSP,
// offline, ad-blockers, or the Expo WebView. See public/draco/.
const DRACO_PATH = "/draco/";

function BodyMesh({ onReady }: { onReady?: () => void }) {
  const gltf = useGLTF("/models/body/body.glb", DRACO_PATH);

  // The body GLB is the only async asset in the initial showroom (the dais,
  // dome gradient and grid are all procedural), so "the body has mounted" IS
  // "the scene is ready". Fire once this component commits — which only happens
  // after `useGLTF` resolves (instantly on a cache hit, after the load on a
  // cold visit). This is what lets the scene cover dismiss WITHOUT depending on
  // drei's `useProgress` — a module singleton shared with the landing's r3f
  // canvases whose stale state could otherwise strand the loader forever.
  useEffect(() => {
    onReady?.();
  }, [onReady]);

  // Hide all `anchor:*` empties so they don't render or eat picks.
  // Mark the scene as body model for occlusion culling optimization.
  useEffect(() => {
    // Tagging the drei-cached scene + hiding anchor empties is an intentional,
    // idiomatic mutation of the loaded GLTF (consumed by occlusion culling).
    // eslint-disable-next-line react-hooks/immutability -- mutating loaded scene is the documented r3f pattern
    gltf.scene.userData.isBodyModel = true;
    gltf.scene.traverse((obj: Object3D) => {
      if (obj.name.startsWith("anchor:")) {
        obj.visible = false;
        // No mesh on empties so no further hiding needed.
      }
    });
    // Index the body geometry with a BVH so the per-anchor occlusion rays in
    // <AnchorDots> are ~O(log n) instead of scanning every triangle each frame.
    buildBoundsTrees(gltf.scene);
  }, [gltf.scene]);

  // Per-render clone is unnecessary — there's only one body in the scene.
  // We use the cached scene directly.
  const scene = useMemo(() => gltf.scene, [gltf.scene]);

  return <primitive object={scene} />;
}

// Eagerly preload the GLB at module import time so the first render can
// short-circuit the Suspense fallback when the user navigates fast.
useGLTF.preload("/models/body/body.glb", DRACO_PATH);
