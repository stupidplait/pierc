"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  MeshTransmissionMaterial,
  useGLTF,
} from "@react-three/drei";
import { EffectComposer, Bloom, ChromaticAberration, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import { useSceneTokens, type ChromTokens } from "./use-scene-tokens";
import { FluidTrail } from "./FluidTrail";

/* ════════════════════════════════════════════════════════════════════
   ХРОМ — the WebGL stage. A liquid-chrome hero ring morphs toward the
   cursor over a dark void; a spark field drifts behind it; the camera
   dollies through the void on scroll while floating jewelry GLBs glide
   in at milestones and catch the light. Theme-aware via --scene-*.
   Scene progress is read from a ref (driven by ScrollTrigger upstream),
   so R3F and scroll stay in lockstep — no React state per frame.
   ════════════════════════════════════════════════════════════════════ */

const DRACO = "/draco/";

// Floating GLBs that glide in at scroll milestones.
const FLOATERS = [
  { url: "/jewelry-glb/seamless-hoop-gold585-8mm-16g.glb", at: 0.34, pos: [-2.6, 1.1, -3], scale: 9 },
  { url: "/jewelry-glb/curved-barbell-titanium-12mm-14g.glb", at: 0.5, pos: [2.7, -0.6, -2], scale: 7 },
  { url: "/jewelry-glb/labret-rose-gold-585-disc-8mm-16g.glb", at: 0.66, pos: [-2.2, -1.2, -4], scale: 11 },
  { url: "/jewelry-glb/nose-stud-l-titanium-blue-gem-18g.glb", at: 0.8, pos: [2.3, 1.3, -3.5], scale: 12 },
] as const;

const HERO_URL = "/jewelry-glb/seamless-hoop-titanium-10mm-14g.glb";

// Preload at module scope.
useGLTF.preload(HERO_URL, DRACO);
for (const f of FLOATERS) useGLTF.preload(f.url, DRACO);

function isSmallViewport() {
  return typeof window !== "undefined" && window.innerWidth < 720;
}

/* ── Liquid-chrome hero ───────────────────────────────────────────────
   A torus knot rendered with MeshTransmissionMaterial (glassy liquid
   chrome). Morphs/rotates toward the cursor; scroll pushes it back +
   slowly tumbles. */
function ChromeHero({
  mouseRef,
  pointerActiveRef,
  progressRef,
  tokens,
  reduced,
}: {
  mouseRef: React.RefObject<{ x: number; y: number }>;
  pointerActiveRef: React.RefObject<boolean>;
  progressRef: React.RefObject<number>;
  tokens: ChromTokens;
  reduced: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<React.ComponentRef<typeof MeshTransmissionMaterial> | null>(null);
  const smooth = useRef({ x: 0, y: 0 });
  const geom = useMemo(() => new THREE.TorusKnotGeometry(0.78, 0.27, 220, 36, 2, 3), []);
  useEffect(() => () => geom.dispose(), [geom]);

  useFrame((state, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const p = progressRef.current;
    const active = pointerActiveRef.current;

    const tx = active ? mouseRef.current.x : 0;
    const ty = active ? mouseRef.current.y : 0;
    const k = 1 - Math.exp(-(active ? 6 : 2.4) * dt);
    smooth.current.x += (tx - smooth.current.x) * k;
    smooth.current.y += (ty - smooth.current.y) * k;

    // cursor-driven tilt + slow ambient tumble + scroll spin
    const idle = reduced ? 0 : t * 0.18;
    mesh.rotation.x = smooth.current.y * 0.6 + idle * 0.5 + p * Math.PI;
    mesh.rotation.y = smooth.current.x * 0.8 + idle + p * Math.PI * 1.4;
    mesh.rotation.z = smooth.current.x * 0.15;

    // hero recedes + shrinks as the user scrolls into the void
    const breathe = reduced ? 1 : 1 + Math.sin(t * 0.9) * 0.02;
    const s = (1.05 - p * 0.45) * breathe;
    mesh.scale.setScalar(Math.max(0.2, s));
    mesh.position.y = (reduced ? 0 : Math.sin(t * 0.6) * 0.06) + p * 0.4;
    mesh.position.z = -p * 2.2;
  });

  // re-tint env intensity per theme so light stays clean chrome
  return (
    <mesh ref={ref} geometry={geom}>
      <MeshTransmissionMaterial
        ref={matRef}
        thickness={0.6}
        roughness={0.04}
        // On light, drop transmission and lean metallic so the piece reads as a
        // POLISHED CHROME mirror (with dark studio reflections) against the white
        // page instead of dissolving into it like clear glass.
        transmission={tokens.isLight ? 0.5 : 0.92}
        ior={1.32}
        chromaticAberration={0.14}
        anisotropy={0.5}
        iridescence={1}
        iridescenceIOR={1.6}
        iridescenceThicknessRange={[120, 560]}
        metalness={tokens.isLight ? 0.75 : 0.35}
        envMapIntensity={tokens.isLight ? 1.55 : 1.35}
        color={tokens.isLight ? "#aab6c2" : "#7fa8bd"}
        backside
        backsideThickness={0.3}
        resolution={isSmallViewport() ? 512 : 1024}
        samples={isSmallViewport() ? 4 : 8}
      />
    </mesh>
  );
}

/* ── Floating jewelry GLB — glides in around its scroll milestone ───── */
function Floater({
  url,
  at,
  pos,
  scale,
  progressRef,
  tokens,
  reduced,
}: {
  url: string;
  at: number;
  pos: readonly [number, number, number];
  scale: number;
  progressRef: React.RefObject<number>;
  tokens: ChromTokens;
  reduced: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const gltf = useGLTF(url, DRACO);

  // chrome-ify: clone + swap to a polished metal so all pieces read as chrome
  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const mat = new THREE.MeshStandardMaterial({
      color: tokens.isLight ? "#c9d2da" : "#aeb8c2",
      metalness: 1,
      roughness: 0.12,
      envMapIntensity: tokens.isLight ? 1.1 : 1.8,
    });
    clone.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = mat;
    });
    return { clone, mat };
  }, [gltf.scene, tokens.isLight]);

  useEffect(() => {
    return () => {
      scene.mat.dispose();
    };
  }, [scene]);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const p = progressRef.current;
    // local window: fades/slides in approaching `at`, drifts past after
    const d = p - at;
    const vis = THREE.MathUtils.clamp(1 - Math.abs(d) / 0.22, 0, 1);
    const eased = vis * vis * (3 - 2 * vis);
    g.visible = eased > 0.01;
    if (!g.visible) return;

    // slide from offscreen direction toward rest, then continue past
    const slide = (1 - eased) * Math.sign(pos[0]) * 3.2;
    g.position.x = pos[0] + slide;
    g.position.y = pos[1] + (reduced ? 0 : Math.sin(t * 0.7 + at * 10) * 0.18) - d * 1.5;
    g.position.z = pos[2];
    g.rotation.y = t * 0.5 + at * 6;
    g.rotation.x = reduced ? 0.2 : Math.sin(t * 0.4) * 0.3;
    const s = scale * eased;
    g.scale.setScalar(s);
  });

  return (
    <group ref={group} scale={0.001}>
      <primitive object={scene.clone} />
    </group>
  );
}

/* ── Spark / dust field drifting behind the hero ──────────────────────── */
function Sparks({
  count,
  tokens,
  reduced,
}: {
  count: number;
  tokens: ChromTokens;
  reduced: boolean;
}) {
  const ref = useRef<THREE.Points>(null);

  /* eslint-disable react-hooks/purity -- one-time particle seed; re-seeds only when count changes */
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 12;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 8;
      arr[i * 3 + 2] = -2 - Math.random() * 8;
    }
    return arr;
  }, [count]);
  /* eslint-enable react-hooks/purity */

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);
  useEffect(() => () => geom.dispose(), [geom]);

  /* eslint-disable react-hooks/immutability -- in-place typed-array animation is the canonical r3f particle pattern */
  useFrame((state, delta) => {
    const pts = ref.current;
    if (!pts || reduced) return;
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const pos = geom.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      pos.array[i * 3 + 1] += Math.sin(t * 0.4 + i) * dt * 0.12;
      pos.array[i * 3] += Math.cos(t * 0.3 + i * 1.7) * dt * 0.06;
      if (pos.array[i * 3 + 1] > 4.5) pos.array[i * 3 + 1] = -4.5;
      if (pos.array[i * 3 + 1] < -4.5) pos.array[i * 3 + 1] = 4.5;
    }
    pos.needsUpdate = true;
    pts.rotation.y = t * 0.02;
  });
  /* eslint-enable react-hooks/immutability */

  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial
        color={tokens.isLight ? "#9fb4c4" : "#dff3ff"}
        size={tokens.isLight ? 0.025 : 0.035}
        transparent
        opacity={tokens.isLight ? 0.5 : 0.8}
        sizeAttenuation
        depthWrite={false}
        blending={tokens.isLight ? THREE.NormalBlending : THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ── Camera dolly — pushes forward through the void on scroll ─────────── */
function CameraDolly({ progressRef }: { progressRef: React.RefObject<number> }) {
  const { camera } = useThree();
  const smooth = useRef(0);
  /* eslint-disable react-hooks/immutability -- per-frame camera transform is the canonical r3f pattern */
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    smooth.current = THREE.MathUtils.damp(smooth.current, progressRef.current, 5, dt);
    const p = smooth.current;
    camera.position.z = 5 - p * 3.4;
    camera.position.y = p * 0.6;
    camera.lookAt(0, p * 0.3, -p * 2);
  });
  /* eslint-enable react-hooks/immutability */
  return null;
}

/* ── Postprocessing — bloom + CA + noise + vignette, theme-tuned ─────── */
function ChromPostFx({
  mouseRef,
  tokens,
}: {
  mouseRef: React.RefObject<{ x: number; y: number }>;
  tokens: ChromTokens;
}) {
  const { invalidate } = useThree();
  const bloomRef = useRef<{ intensity: number; luminanceMaterial?: { threshold: number } } | null>(
    null,
  );
  const vignetteRef = useRef<{ darkness: number } | null>(null);
  const caOffset = useMemo(() => new THREE.Vector2(0.0009, 0.0012), []);

  useEffect(() => {
    const b = bloomRef.current;
    if (b) {
      if (b.luminanceMaterial) b.luminanceMaterial.threshold = tokens.isLight ? 1.0 : 0.78;
      b.intensity = tokens.isLight ? 0.5 : 0.8;
    }
    const v = vignetteRef.current;
    if (v) v.darkness = tokens.isLight ? 0.25 : 0.85;
    invalidate();
  }, [tokens.isLight, invalidate]);

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        ref={bloomRef}
        luminanceThreshold={tokens.isLight ? 1.0 : 0.78}
        luminanceSmoothing={0.3}
        intensity={tokens.isLight ? 0.5 : 0.8}
        mipmapBlur
        levels={4}
      />
      <ChromaticAberration
        offset={caOffset}
        radialModulation={false}
        modulationOffset={0}
        blendFunction={BlendFunction.NORMAL}
      />
      <FluidTrail mouseRef={mouseRef} isDark={!tokens.isLight} />
      <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={tokens.isLight ? 0.22 : 0.4} />
      <Vignette ref={vignetteRef} eskil={false} offset={0.22} darkness={tokens.isLight ? 0.25 : 0.85} />
    </EffectComposer>
  );
}

/* ── Scene background + fog, set imperatively on the real scene root ───
   Attaching <color attach="background"/> inside a nested <group> attaches
   to the group (a no-op) instead of the scene, so on a light load the
   canvas stayed black. Setting scene.background/fog via useThree+useEffect
   targets the scene directly and updates reactively on a theme toggle. */
function SceneBackground({ tokens }: { tokens: ChromTokens }) {
  const { scene, invalidate } = useThree();
  useEffect(() => {
    /* eslint-disable react-hooks/immutability -- setting scene.background/fog on the r3f scene root is the documented pattern */
    scene.background = tokens.bg;
    scene.fog = new THREE.Fog(tokens.fog, 6, 18);
    /* eslint-enable react-hooks/immutability */
    invalidate();
    return () => {
      scene.fog = null;
    };
  }, [scene, tokens, invalidate]);
  return null;
}

function SceneContents({
  mouseRef,
  pointerActiveRef,
  progressRef,
  reduced,
}: {
  mouseRef: React.RefObject<{ x: number; y: number }>;
  pointerActiveRef: React.RefObject<boolean>;
  progressRef: React.RefObject<number>;
  reduced: boolean;
}) {
  const tokens = useSceneTokens();
  const small = isSmallViewport();
  const sparkCount = small ? 120 : 320;

  return (
    // key on theme so drei <Environment> / materials regenerate on toggle
    <group key={tokens.isLight ? "light" : "dark"}>
      <SceneBackground tokens={tokens} />

      <CameraDolly progressRef={progressRef} />

      <ambientLight intensity={tokens.isLight ? 0.7 : 0.25} />
      <directionalLight position={[3, 4, 5]} intensity={tokens.isLight ? 1.2 : 0.8} color="#ffffff" />
      <pointLight position={[-4, -2, 2]} intensity={tokens.isLight ? 0.4 : 1.1} color={`#${tokens.accent.getHexString()}`} />

      <Suspense fallback={null}>
        <Environment resolution={256}>
          {/* enclosing reflection sphere themed via --scene-reflect:
              black void (dark) → soft wash (light studio) */}
          <mesh scale={60}>
            <sphereGeometry args={[1, 32, 32]} />
            {/* Reflection env. On light keep it a DARK studio (not near-white):
                a chrome mirror needs dark surroundings to refract/reflect so it
                stays visible against the white page — the lightformers below add
                the bright highlights. */}
            <meshBasicMaterial
              color={tokens.isLight ? "#2b2e35" : `#${tokens.reflect.getHexString()}`}
              side={THREE.BackSide}
            />
          </mesh>
          <Lightformer
            form="ring"
            intensity={tokens.isLight ? 2.4 : 3.6}
            position={[0, 5, 1]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[7, 7, 1]}
            color="#ffffff"
          />
          <Lightformer
            form="rect"
            intensity={tokens.isLight ? 1.4 : 2.6}
            position={[6, 1, 2]}
            rotation={[0, -Math.PI / 2, 0]}
            scale={[8, 8, 1]}
            color="#bfe9ff"
          />
          <Lightformer
            form="rect"
            intensity={tokens.isLight ? 1.2 : 2}
            position={[-6, 1, 2]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[8, 8, 1]}
            color="#ffd9c2"
          />
        </Environment>

        <Sparks count={sparkCount} tokens={tokens} reduced={reduced} />

        <ChromeHero
          mouseRef={mouseRef}
          pointerActiveRef={pointerActiveRef}
          progressRef={progressRef}
          tokens={tokens}
          reduced={reduced}
        />

        {FLOATERS.map((f) => (
          <Floater
            key={f.url}
            url={f.url}
            at={f.at}
            pos={f.pos}
            scale={f.scale}
            progressRef={progressRef}
            tokens={tokens}
            reduced={reduced}
          />
        ))}
      </Suspense>

      <ChromPostFx mouseRef={mouseRef} tokens={tokens} />
    </group>
  );
}

export default function ChromScene({
  mouseRef,
  pointerActiveRef,
  progressRef,
  reduced,
}: {
  mouseRef: React.RefObject<{ x: number; y: number }>;
  pointerActiveRef: React.RefObject<boolean>;
  progressRef: React.RefObject<number>;
  reduced: boolean;
}) {
  // pause the render loop while the tab is hidden so the heavy
  // transmission + fluid passes don't keep the GPU busy in the background.
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");
  useEffect(() => {
    const onVis = () => setFrameloop(document.hidden ? "never" : "always");
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <Canvas
      frameloop={frameloop}
      dpr={[1, isSmallViewport() ? 1.5 : 2]}
      camera={{ fov: 42, position: [0, 0, 5], near: 0.1, far: 60 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
    >
      <SceneContents
        mouseRef={mouseRef}
        pointerActiveRef={pointerActiveRef}
        progressRef={progressRef}
        reduced={reduced}
      />
    </Canvas>
  );
}
