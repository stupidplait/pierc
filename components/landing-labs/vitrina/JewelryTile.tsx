"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF, Center } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { useReducedMotion } from "framer-motion";
import { useSceneColors } from "@/lib/theme/use-scene-colors";

/**
 * JewelryTile — the single live-3D bento tile: a hero jewelry GLB on a slow
 * turntable inside a small R3F canvas. Mounted ONLY via a dynamic(ssr:false)
 * wrapper in Experience.tsx (the WebGL guard there picks a static fallback when
 * WebGL2 is unavailable).
 *
 * Theme: the scene clear-colour + reflection env read the live `--scene-*`
 * tokens (re-skins on toggle). The whole <Canvas> subtree is keyed on the theme
 * upstream so drei's <Environment> re-bakes cleanly instead of mutating a baked
 * PMREM in place (which throws under React 19).
 */

const DRACO_PATH = "/draco/";

const GLBS = [
  "/jewelry-glb/seamless-hoop-gold585-8mm-16g.glb",
  "/jewelry-glb/labret-titanium-pink-gem-8mm-16g.glb",
  "/jewelry-glb/curved-barbell-titanium-12mm-14g.glb",
  "/jewelry-glb/nose-stud-l-gold585-opal-18g.glb",
];

// Preload every selectable piece so swaps are instant.
for (const url of GLBS) useGLTF.preload(url, DRACO_PATH);

function Piece({ url, reduced }: { url: string; reduced: boolean }) {
  const gltf = useGLTF(url, DRACO_PATH);
  const ref = useRef<THREE.Group | null>(null);
  const { invalidate } = useThree();

  // Each tile owns its own clone so the drei cache stays pristine across swaps.
  // The GLBs are modelled at real-world metres (a 6–16 mm piece), so at this
  // camera distance an un-scaled clone is a sub-pixel speck — normalise the
  // largest dimension to a constant on-screen size so every piece fills the tile.
  const { scene, fitScale } = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      }
    });
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    return { scene: clone, fitScale: 1.9 / maxDim };
  }, [gltf.scene]);

  useEffect(() => {
    // Kick a first frame; the turntable below keeps requesting subsequent ones.
    invalidate();
    return () => {
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose?.();
          const mat = mesh.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose?.();
        }
      });
    };
  }, [scene, invalidate]);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    if (reduced) return;
    g.rotation.y += Math.min(delta, 0.05) * 0.55;
    invalidate();
  });

  return (
    <group ref={ref} scale={fitScale}>
      <Center>
        <primitive object={scene} />
      </Center>
    </group>
  );
}

function Rig({ accent }: { accent: string }) {
  const accentColor = useMemo(() => new THREE.Color(accent), [accent]);
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 3]} intensity={1.4} />
      <directionalLight position={[-3, 1, -2]} intensity={0.5} color={accentColor} />
      {/* Bright synthetic studio so the metals read as polished. */}
      <Environment resolution={128}>
        <Lightformer
          form="ring"
          intensity={4}
          position={[0, 3, 1]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[5, 5, 1]}
          color="#fffdf5"
        />
        <Lightformer
          form="rect"
          intensity={2}
          position={[3, 1, 2]}
          scale={[6, 6, 1]}
          color="#fff4dd"
        />
        <Lightformer
          form="rect"
          intensity={1.4}
          position={[-3, 1, 1]}
          scale={[6, 6, 1]}
          color="#dce6ff"
        />
      </Environment>
    </>
  );
}

export default function JewelryTile({ glbIndex }: { glbIndex: number }) {
  const colors = useSceneColors();
  const reduced = useReducedMotion() ?? false;
  const url = GLBS[glbIndex % GLBS.length];

  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop="demand"
      camera={{ position: [0, 0.2, 3.4], fov: 32, near: 0.1, far: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={[colors.bg]} />
      <Suspense fallback={null}>
        <Piece url={url} reduced={reduced} />
        <Rig accent={colors.accent} />
      </Suspense>
      <EffectComposer>
        <Bloom
          luminanceThreshold={colors.isLight ? 1.05 : 0.7}
          luminanceSmoothing={0.3}
          intensity={colors.isLight ? 0.5 : 1.0}
          mipmapBlur
          levels={3}
        />
      </EffectComposer>
    </Canvas>
  );
}
