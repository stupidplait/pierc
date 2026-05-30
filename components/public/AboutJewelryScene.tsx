"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bounds, Center, useGLTF } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import type { Group } from "three";

// A single iconic piece for the decorative hero. Gold reads warm against the
// #080808 void and is instantly legible as jewelry. Swap the filename to change
// the hero piece — any model in /public/jewelry-glb works.
const MODEL_URL = "/jewelry-glb/seamless-hoop-gold585-8mm-16g.glb";

function Piece({ spin }: { spin: boolean }) {
  const gltf = useGLTF(MODEL_URL) as unknown as { scene: Group };
  // Clone so we never mutate drei's cached scene graph.
  const cloned = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const ref = useRef<Group>(null);

  useFrame((_, delta) => {
    if (spin && ref.current) {
      // ~0.35 rad/s — a full, unhurried turn every ~18s.
      ref.current.rotation.y += delta * 0.35;
    }
  });

  return (
    <Center>
      <group ref={ref} rotation={[0.35, 0, 0]}>
        <primitive object={cloned} />
      </group>
    </Center>
  );
}

/**
 * AboutJewelryScene — decorative, non-interactive r3f backdrop for the About
 * hero. The WebGL analog of AuthBackdrop: one jewelry GLB rotating gently,
 * lit like the catalog showroom so the metal reads as the same material the
 * try-on uses. `prefers-reduced-motion` freezes the spin (and idles the loop).
 *
 * Mounted only via a `dynamic(ssr:false)` import behind a WebGL2 gate, so it
 * never runs on the server and never blocks the page's content/SEO.
 */
export function AboutJewelryScene() {
  const reduced = useReducedMotion();
  const spin = !reduced;

  return (
    <Canvas
      // Cap dpr so mobile/high-DPI GPUs don't render at 3×.
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 3], fov: 35, near: 0.05, far: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
      // Continuous only while it actually animates; idle otherwise.
      frameloop={spin ? "always" : "demand"}
    >
      {/* Lighting mirrors ShowroomScene so the hero piece and the try-on read
          as one material vocabulary: warm key, cool fill, magenta rim. */}
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#fff7ec", "#0a0a0a", 0.4]} />
      <directionalLight position={[3, 6, 4]} intensity={1.2} color="#fff7ec" />
      <directionalLight position={[-3, 2, 2]} intensity={0.45} color="#cfe1ff" />
      <directionalLight position={[0, 2, -3]} intensity={0.35} color="#fe017e" />

      <Suspense fallback={null}>
        <Bounds fit clip observe margin={1.35}>
          <Piece spin={spin} />
        </Bounds>
      </Suspense>
    </Canvas>
  );
}

// Warm the GLB into drei's cache as soon as this client chunk loads.
useGLTF.preload(MODEL_URL);
