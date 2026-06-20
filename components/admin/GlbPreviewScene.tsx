"use client";

import { Suspense, useEffect, useMemo } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Bounds, Center, OrbitControls, useGLTF } from "@react-three/drei";
import { Box3, DoubleSide, Vector3 } from "three";
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
  quaternion,
  showAttach = false,
  pickMode = false,
  onPick,
  pickedPoint = null,
}: {
  url: string;
  onStats?: (stats: GlbStats) => void;
  /** Live model orientation [x,y,z,w] — the admin's in-canvas nudge, pre-save. */
  quaternion?: [number, number, number, number];
  /** Render a marker at the `attach:primary` empty (where it meets the piercing). */
  showAttach?: boolean;
  /** Click the model to set a new attach point (returns the local-space hit). */
  pickMode?: boolean;
  onPick?: (point: [number, number, number]) => void;
  /** The currently-picked local point, drawn as a marker (pre-save). */
  pickedPoint?: [number, number, number] | null;
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

  // Marker radius, sized to the model so it reads at any scale.
  const markerR = useMemo(() => {
    const diag = new Box3().setFromObject(cloned).getSize(new Vector3()).length();
    return Math.max(diag * 0.05, 1e-4);
  }, [cloned]);

  // Locate the current attach:primary (the skin-contact point).
  const attachPos = useMemo(() => {
    if (!showAttach) return null;
    let pos: Vector3 | null = null;
    cloned.traverse((o) => {
      // three's GLTFLoader strips ':' from node names (sanitizeNodeName), so the
      // live name is "attachprimary"; the original "attach:primary" survives in
      // userData.name. Accept either form.
      const raw = (o.userData?.name as string | undefined) ?? o.name;
      if (raw === "attach:primary" || raw === "attachprimary") {
        pos = o.position.clone();
      }
    });
    return pos as Vector3 | null;
  }, [cloned, showAttach]);

  // Click → convert the world-space hit into the model's LOCAL frame (the frame
  // attach nodes + readAttachLocals use), so the picked point bakes correctly.
  const handlePick = (e: ThreeEvent<MouseEvent>) => {
    if (!pickMode || !onPick) return;
    e.stopPropagation();
    const local = cloned.worldToLocal(e.point.clone());
    onPick([local.x, local.y, local.z]);
  };

  return (
    <Center>
      <group quaternion={quaternion ?? [0, 0, 0, 1]}>
        <primitive
          object={cloned}
          {...(pickMode ? { onClick: handlePick } : {})}
        />
        {attachPos ? (
          // renderOrder + depthTest:false draws the marker ON TOP — the attach
          // point sits at the neck/center, often buried inside the geometry, so
          // a depth-tested marker would be invisible.
          <mesh position={attachPos} renderOrder={999}>
            <sphereGeometry args={[markerR, 16, 16]} />
            <meshBasicMaterial
              color="#fe017e"
              toneMapped={false}
              depthTest={false}
              depthWrite={false}
              transparent
            />
          </mesh>
        ) : null}
        {attachPos ? (
          // Seating cue at the attach point: a faint "skin" disc (the plane that
          // meets the body, perpendicular to the local +Z = outward) and a green
          // outward tick. The decorative side should sit on the +Z side of the
          // disc — if the gem pokes through to the back, it's facing INTO the body.
          // Depth-tested so it reads as part of the model, not an overlay.
          <group position={attachPos}>
            <mesh>
              <circleGeometry args={[markerR * 3, 40]} />
              <meshBasicMaterial
                color="#9aa0a6"
                transparent
                opacity={0.16}
                side={DoubleSide}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            <mesh position={[0, 0, markerR * 2.5]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[markerR * 0.12, markerR * 0.12, markerR * 5, 8]} />
              <meshBasicMaterial color="#22c55e" toneMapped={false} />
            </mesh>
          </group>
        ) : null}
        {pickedPoint ? (
          // The freshly-picked point (pre-save), distinct cyan so it reads apart
          // from the current pink attach marker.
          <mesh position={pickedPoint} renderOrder={1000}>
            <sphereGeometry args={[markerR * 1.1, 16, 16]} />
            <meshBasicMaterial
              color="#22d3ee"
              toneMapped={false}
              depthTest={false}
              depthWrite={false}
              transparent
            />
          </mesh>
        ) : null}
      </group>
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
  quaternion,
  showAttach = false,
  lockCamera = false,
  pickMode = false,
  onPick,
  pickedPoint = null,
}: {
  url: string;
  onStats?: (stats: GlbStats) => void;
  quaternion?: [number, number, number, number];
  showAttach?: boolean;
  /** When editing orientation, lock the camera face-on so the only rotation is
   *  the model's (driven by drag) — no orbit-camera-vs-model-rotate confusion. */
  lockCamera?: boolean;
  /** Click the model to set a new attach point (orbit stays on so the admin can
   *  rotate to the mount first). */
  pickMode?: boolean;
  onPick?: (point: [number, number, number]) => void;
  pickedPoint?: [number, number, number] | null;
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
        {/* Re-fit only when the URL changes (keyed) — NOT on every rotation, so an
            in-canvas roll/flip doesn't make the framing jump. */}
        <Bounds key={url} fit clip margin={1.2}>
          <Piece
            url={url}
            onStats={onStats}
            quaternion={quaternion}
            showAttach={showAttach}
            pickMode={pickMode}
            onPick={onPick}
            pickedPoint={pickedPoint}
          />
        </Bounds>
      </Suspense>

      {/* While editing orientation the camera is locked face-on (drag rotates the
          MODEL, not the camera); otherwise OrbitControls allows free inspection. */}
      {lockCamera ? null : (
        <OrbitControls makeDefault enablePan={false} minDistance={0.6} maxDistance={8} />
      )}
    </Canvas>
  );
}
