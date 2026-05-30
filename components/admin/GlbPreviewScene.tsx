"use client";

import { Suspense, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Center, OrbitControls, useGLTF } from "@react-three/drei";
import type { Group, Mesh } from "three";

/** Geometry summary read off the loaded GLB — surfaced in the admin inspector
 *  so junk meshes (e.g. a million-triangle Tripo blob) are caught pre-publish. */
export interface GlbStats {
  triangles: number;
  vertices: number;
  meshes: number;
  materials: number;
}

/**
 * The piece itself. Clones drei's cached scene so a re-mount on another URL
 * never mutates the shared graph, and auto-centers it inside the <Bounds> fit.
 * Also walks the cloned graph once to tally geometry stats for the inspector.
 */
function Piece({
  url,
  onStats,
}: {
  url: string;
  onStats?: (stats: GlbStats) => void;
}) {
  const gltf = useGLTF(url) as unknown as { scene: Group };
  const cloned = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  const stats = useMemo<GlbStats>(() => {
    let triangles = 0;
    let vertices = 0;
    let meshes = 0;
    const materials = new Set<string>();
    cloned.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      meshes += 1;
      const pos = mesh.geometry.getAttribute("position");
      if (pos) vertices += pos.count;
      const index = mesh.geometry.getIndex();
      triangles += index ? index.count / 3 : pos ? pos.count / 3 : 0;
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m && materials.add(m.uuid));
      else if (mat) materials.add(mat.uuid);
    });
    return {
      triangles: Math.round(triangles),
      vertices,
      meshes,
      materials: materials.size,
    };
  }, [cloned]);

  // onStats is a stable setState from the parent — fire once per loaded scene.
  useEffect(() => {
    onStats?.(stats);
  }, [stats, onStats]);

  return (
    <Center>
      <primitive object={cloned} />
    </Center>
  );
}

/**
 * GlbPreviewScene — interactive r3f viewer for a single jewelry GLB, used by
 * the admin model panel to *see* an uploaded or AI-generated piece before
 * publishing/approving it. Unlike the decorative AboutJewelryScene this one is
 * URL-driven (any `.glb`) and user-driven: orbit to rotate, scroll to zoom.
 *
 * `frameloop="demand"` keeps it idle until the admin interacts (or <Bounds>
 * fits) — no continuous render cost. Lighting mirrors ShowroomScene so metal
 * reads as the same material the catalog try-on uses.
 *
 * Mounted only via a `dynamic(ssr:false)` import behind a WebGL2 gate
 * (see GlbPreview.tsx), so it never runs on the server.
 */
export function GlbPreviewScene({
  url,
  onStats,
}: {
  url: string;
  onStats?: (stats: GlbStats) => void;
}) {
  return (
    <Canvas
      // Cap dpr so high-DPI GPUs don't render at 3×.
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 3], fov: 35, near: 0.05, far: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
      // Render on demand — OrbitControls/Bounds request frames when needed.
      frameloop="demand"
    >
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#fff7ec", "#0a0a0a", 0.4]} />
      <directionalLight position={[3, 6, 4]} intensity={1.2} color="#fff7ec" />
      <directionalLight position={[-3, 2, 2]} intensity={0.45} color="#cfe1ff" />
      <directionalLight position={[0, 2, -3]} intensity={0.35} color="#fe017e" />

      <Suspense fallback={null}>
        {/* Re-fit when the URL changes so a new model isn't framed by the old. */}
        <Bounds key={url} fit clip observe margin={1.2}>
          <Piece url={url} onStats={onStats} />
        </Bounds>
      </Suspense>

      <OrbitControls makeDefault enablePan={false} minDistance={0.6} maxDistance={8} />
    </Canvas>
  );
}
