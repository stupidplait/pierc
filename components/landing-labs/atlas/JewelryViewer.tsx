"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bounds, Center, Environment, Lightformer, useGLTF } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import { BackSide, Box3, Group, type Material, type Mesh, Vector3 } from "three";
import { useSceneColors } from "@/lib/theme/use-scene-colors";

/**
 * JewelryViewer — the deep-dive macro viewer. A single real jewelry GLB from
 * /jewelry-glb/, auto-framed and slowly rotating on a turntable so the piece
 * reads as an instrument-case specimen. Mounted ONLY via dynamic(ssr:false)
 * from Experience, behind a WebGL2 gate.
 *
 * Each GLB is < 14 KB and Draco-free (the jewelry pipeline ships them
 * uncompressed), so no DRACO path is needed here. Materials cloned per piece so
 * disposal on swap never touches drei's shared cache.
 */
export function JewelryViewer({ url }: { url: string }) {
  const scene = useSceneColors();

  return (
    <Canvas
      dpr={[1, 1.6]}
      camera={{ position: [0, 0, 2.4], fov: 32, near: 0.05, far: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
      frameloop="always"
    >
      <ambientLight intensity={scene.isLight ? 0.85 : 0.45} />
      <hemisphereLight args={["#fff7ec", "#0a0a0a", scene.isLight ? 0.5 : 0.35]} />
      <directionalLight position={[3, 5, 4]} intensity={scene.isLight ? 1.6 : 1.2} color="#fff7ec" />
      <directionalLight position={[-3, 2, 2]} intensity={0.5} color="#cfe1ff" />
      <directionalLight position={[0, 2, -3]} intensity={0.5} color={scene.accent} />
      {/* Synthetic env for crisp metal — inline Lightformers (no CDN HDR fetch,
          robust under CSP / offline). Keyed on theme so it re-bakes on toggle. */}
      <Environment key={scene.isLight ? "l" : "d"} resolution={128}>
        <mesh scale={50}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshBasicMaterial color={scene.isLight ? "#dcdce2" : "#0c0c11"} side={BackSide} />
        </mesh>
        <Lightformer form="ring" intensity={3} position={[0, 4, 1]} scale={5} color="#fffdf5" />
        <Lightformer form="rect" intensity={1.6} position={[3, 1, 2]} rotation={[0, -Math.PI / 2, 0]} scale={5} color="#fff4dd" />
        <Lightformer form="rect" intensity={1.2} position={[-3, 1, 2]} rotation={[0, Math.PI / 2, 0]} scale={5} color="#dce6ff" />
      </Environment>

      <Suspense fallback={null}>
        <Bounds key={url} fit clip margin={1.25}>
          <Turntable>
            <Specimen url={url} />
          </Turntable>
        </Bounds>
      </Suspense>
    </Canvas>
  );
}

function Turntable({ children }: { children: React.ReactNode }) {
  const ref = useRef<Group | null>(null);
  const reduced = useReducedMotion() ?? false;
  useFrame((_, delta) => {
    const g = ref.current;
    if (!g || reduced) return;
    g.rotation.y += Math.min(delta, 0.05) * 0.6;
  });
  return <group ref={ref}>{children}</group>;
}

function Specimen({ url }: { url: string }) {
  const gltf = useGLTF(url) as unknown as { scene: Group };
  const { invalidate } = useThree();

  // Per-instance clone (children + materials) so swaps never mutate the cache,
  // and so unmount disposal is safe.
  const { cloned, disposables } = useMemo(() => {
    const clone = new Group();
    const disposables: Material[] = [];
    gltf.scene.children.forEach((child) => {
      const c = child.clone(true);
      clone.add(c);
    });
    clone.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((m) => {
          const cm = m.clone();
          disposables.push(cm);
          return cm;
        });
      } else if (mesh.material) {
        const cm = mesh.material.clone();
        disposables.push(cm);
        mesh.material = cm;
      }
    });
    return { cloned: clone, disposables };
  }, [gltf.scene]);

  // Lift to a centred local frame so <Center>/<Bounds> measure cleanly and the
  // spin axis runs through the piece, not its corner.
  const offset = useMemo(() => {
    const box = new Box3().setFromObject(cloned);
    return box.getCenter(new Vector3()).negate();
  }, [cloned]);

  useEffect(() => {
    invalidate();
    return () => {
      for (const m of disposables) m.dispose();
    };
  }, [disposables, invalidate]);

  return (
    <Center>
      <group position={offset}>
        <primitive object={cloned} />
      </group>
    </Center>
  );
}
