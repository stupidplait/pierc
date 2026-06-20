"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  MeshTransmissionMaterial,
  useGLTF,
  Float,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import type { SceneTokens } from "./use-scene-tokens";

/* The hero ring's signature jewelry — a titanium seamless hoop. Preloaded at
   module scope (self-hosted Draco decoders in /public/draco/). */
const HOOP_URL = "/jewelry-glb/seamless-hoop-titanium-10mm-14g.glb";
const LABRET_URL = "/jewelry-glb/labret-titanium-clear-gem-6mm-16g.glb";
const DRACO = "/draco/";
useGLTF.preload(HOOP_URL, DRACO);
useGLTF.preload(LABRET_URL, DRACO);

interface SceneProps {
  /** Pointer in NDC (-1..1), updated outside React via ref. */
  mouseRef: React.RefObject<{ x: number; y: number }>;
  pointerActiveRef: React.RefObject<boolean>;
  /** 0..1 global scroll progress, ref-driven (no re-render). */
  scrollRef: React.RefObject<number>;
  tokens: SceneTokens;
  reducedMotion: boolean;
  onReady?: () => void;
}

/* ── The chrome transmission torus ──────────────────────────────────────── */
function ChromeRing({
  mouseRef,
  pointerActiveRef,
  scrollRef,
  accent,
  reducedMotion,
}: {
  mouseRef: React.RefObject<{ x: number; y: number }>;
  pointerActiveRef: React.RefObject<boolean>;
  scrollRef: React.RefObject<number>;
  accent: THREE.Color;
  reducedMotion: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => new THREE.TorusGeometry(1.15, 0.34, 96, 220), []);
  useEffect(() => () => geo.dispose(), [geo]);

  const smooth = useRef({ x: 0, y: 0 });
  const spin = useRef(0);

  useFrame((state, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const dt = Math.min(delta, 0.05);
    const sp = scrollRef.current ?? 0;
    const active = pointerActiveRef.current;
    const t = 1 - Math.exp(-(active ? 7 : 2.4) * dt);
    const tx = active ? mouseRef.current.x : 0;
    const ty = active ? mouseRef.current.y : 0;
    smooth.current.x += (tx - smooth.current.x) * t;
    smooth.current.y += (ty - smooth.current.y) * t;

    // Slow constant spin (decelerates under reduced motion) + scroll-driven roll.
    spin.current += dt * (reducedMotion ? 0.05 : 0.18);
    mesh.rotation.x = smooth.current.y * 0.5 + sp * Math.PI * 1.2 - 0.25;
    mesh.rotation.y = smooth.current.x * 0.6 + spin.current + sp * Math.PI * 1.6;

    // Scroll pushes the ring back + scales it down so the acts read past it.
    const targetScale = 1 - sp * 0.34;
    const s = THREE.MathUtils.damp(mesh.scale.x, targetScale, 6, dt);
    mesh.scale.setScalar(s);
    mesh.position.z = THREE.MathUtils.damp(mesh.position.z, -sp * 2.2, 6, dt);
    const bob = reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.7) * 0.06;
    mesh.position.y = THREE.MathUtils.damp(mesh.position.y, bob - sp * 0.4, 5, dt);
  });

  return (
    <mesh ref={ref} geometry={geo}>
      <MeshTransmissionMaterial
        thickness={0.55}
        roughness={0.04}
        transmission={1}
        ior={1.4}
        chromaticAberration={0.32}
        anisotropy={0.3}
        distortion={0.2}
        distortionScale={0.4}
        temporalDistortion={reducedMotion ? 0 : 0.12}
        envMapIntensity={1.1}
        attenuationColor={accent}
        attenuationDistance={2.4}
        backside
        backsideThickness={0.4}
        resolution={
          typeof window !== "undefined" && window.devicePixelRatio > 1.5 ? 1024 : 512
        }
        samples={6}
      />
    </mesh>
  );
}

/* ── A real jewelry GLB floating beside the ring (chrome) ───────────────── */
function FloatingPiece({
  url,
  position,
  scale,
  reducedMotion,
  ink,
}: {
  url: string;
  position: [number, number, number];
  scale: number;
  reducedMotion: boolean;
  ink: THREE.Color;
}) {
  const gltf = useGLTF(url, DRACO);
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.material = new THREE.MeshStandardMaterial({
          color: ink,
          metalness: 1,
          roughness: 0.22,
          envMapIntensity: 1.2,
        });
      }
    });
    return cloned;
  }, [gltf.scene, ink]);

  useEffect(() => {
    return () => {
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && mesh.material) {
          (mesh.material as THREE.Material).dispose();
        }
      });
    };
  }, [scene]);

  return (
    <Float
      speed={reducedMotion ? 0 : 1.4}
      rotationIntensity={reducedMotion ? 0 : 0.6}
      floatIntensity={reducedMotion ? 0 : 0.7}
    >
      <primitive object={scene} position={position} scale={scale} />
    </Float>
  );
}

/* ── Wireframe floor grid for atmosphere/depth ──────────────────────────── */
function GridFloor({ color }: { color: THREE.Color }) {
  return (
    <gridHelper
      args={[60, 60, color, color]}
      position={[0, -3.4, -4]}
      // dim it; gridHelper material supports opacity
      onUpdate={(g) => {
        const mat = g.material as THREE.Material | THREE.Material[];
        const apply = (m: THREE.Material) => {
          m.transparent = true;
          m.opacity = 0.16;
        };
        if (Array.isArray(mat)) mat.forEach(apply);
        else apply(mat);
      }}
    />
  );
}

/* ── Readiness signal — fire onReady after first composited frame ───────── */
function Ready({ onReady }: { onReady?: () => void }) {
  const fired = useRef(false);
  useFrame(() => {
    if (fired.current || !onReady) return;
    fired.current = true;
    onReady();
  });
  return null;
}

function SceneContents({
  mouseRef,
  pointerActiveRef,
  scrollRef,
  tokens,
  reducedMotion,
  onReady,
}: SceneProps) {
  const accent = useMemo(() => new THREE.Color(tokens.accent), [tokens.accent]);
  const ink = useMemo(() => new THREE.Color(tokens.ink), [tokens.ink]);
  const grid = useMemo(() => new THREE.Color(tokens.gridMajor), [tokens.gridMajor]);
  const reflect = useMemo(() => new THREE.Color(tokens.reflect), [tokens.reflect]);
  const bg = useMemo(() => new THREE.Color(tokens.bg), [tokens.bg]);

  // Keep the WebGL clear colour in lockstep with the scene bg token so the
  // transmission material refracts the same colour the user sees behind canvas.
  const { gl } = useThree();
  useEffect(() => {
    gl.setClearColor(bg, 0);
  }, [gl, bg]);

  return (
    <>
      <color attach="background" args={[bg.r, bg.g, bg.b]} />
      <ambientLight intensity={tokens.isLight ? 0.9 : 0.35} />
      <directionalLight position={[3, 4, 5]} intensity={tokens.isLight ? 1.1 : 0.8} />

      <GridFloor color={grid} />

      <Suspense fallback={null}>
        <ChromeRing
          mouseRef={mouseRef}
          pointerActiveRef={pointerActiveRef}
          scrollRef={scrollRef}
          accent={accent}
          reducedMotion={reducedMotion}
        />
        <FloatingPiece
          url={HOOP_URL}
          position={[2.6, 1.1, -1.5]}
          scale={9}
          reducedMotion={reducedMotion}
          ink={ink}
        />
        <FloatingPiece
          url={LABRET_URL}
          position={[-2.7, -1.2, -1.2]}
          scale={9}
          reducedMotion={reducedMotion}
          ink={ink}
        />

        {/* Reflection env — key it on the reflect token so it re-bakes on flip.
            (The whole scene tree is keyed on theme by the parent, so this is a
            fresh mount per theme; no live re-bake of an existing PMREM.) */}
        <Environment resolution={256}>
          <mesh scale={60}>
            <sphereGeometry args={[1, 32, 32]} />
            <meshBasicMaterial color={reflect} side={THREE.BackSide} />
          </mesh>
          <Lightformer
            form="ring"
            intensity={tokens.isLight ? 3 : 5}
            position={[0, 5, 1]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[5, 5, 1]}
            color="#fffdf5"
          />
          <Lightformer
            form="rect"
            intensity={2}
            position={[6, 1, 2]}
            rotation={[0, -Math.PI / 2, 0]}
            scale={[8, 8, 1]}
            color="#ffe9c9"
          />
          <Lightformer
            form="rect"
            intensity={1.6}
            position={[-6, 1, 2]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[8, 8, 1]}
            color="#cfe0ff"
          />
        </Environment>

        <Ready onReady={onReady} />
      </Suspense>

      <EffectComposer>
        <Bloom
          // On light raise the threshold so the white studio doesn't blow out.
          luminanceThreshold={tokens.isLight ? 1.05 : 0.7}
          luminanceSmoothing={0.3}
          intensity={tokens.isLight ? 0.5 : 1.1}
          mipmapBlur
          levels={3}
        />
        <Vignette eskil={false} offset={0.25} darkness={tokens.isLight ? 0.25 : 0.7} />
      </EffectComposer>
    </>
  );
}

export default function RingScene(props: SceneProps) {
  // Lower DPR on small screens for perf.
  const dpr = useMemo<[number, number]>(() => {
    if (typeof window === "undefined") return [1, 2];
    return window.innerWidth < 720 ? [1, 1.5] : [1, 2];
  }, []);

  return (
    <Canvas
      dpr={dpr}
      camera={{ fov: 42, position: [0, 0, 6], near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
    >
      <SceneContents {...props} />
    </Canvas>
  );
}
