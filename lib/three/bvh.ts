import { BufferGeometry, Mesh, type Object3D } from "three";
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from "three-mesh-bvh";

/**
 * Wire three-mesh-bvh into three's prototypes so `raycaster.intersectObjects`
 * uses a bounding-volume hierarchy whenever a mesh's geometry has a
 * `boundsTree`. Meshes without one fall back to the stock linear raycast, so
 * this is safe to install globally.
 *
 * Why: the showroom casts a per-anchor occlusion ray every frame the camera
 * moves (see components/catalog/AnchorDots.tsx). Against the raw ~65k-tri body
 * that's ~2M ray–triangle tests per frame across all dots — a brute-force
 * linear scan. A BVH turns each cast into an ~O(log n) tree descent.
 *
 * Idempotent: only patches the prototypes once.
 */
let installed = false;

export function installBVH(): void {
  if (installed) return;
  installed = true;
  BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
  BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
  Mesh.prototype.raycast = acceleratedRaycast;
}

/**
 * Build a bounds tree for every mesh under `root` that doesn't already have
 * one. Call once after a model loads. Cheap to re-call (skips meshes that are
 * already indexed), so it's fine to run from an effect that may re-fire.
 */
export function buildBoundsTrees(root: Object3D): void {
  installBVH();
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const geom = mesh.geometry;
    if (geom && !geom.boundsTree) geom.computeBoundsTree();
  });
}
