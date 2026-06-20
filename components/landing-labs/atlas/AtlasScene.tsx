"use client";

/* eslint-disable react-hooks/immutability --
 * Three.js r3f patterns: the camera rig mutates the live camera in useFrame, and
 * the body loader mutates the drei-cached GLTF scene (hide anchor empties). React
 * Compiler flags both as post-render mutation, but they are the canonical r3f
 * approach used across this repo (components/catalog/CameraRig.tsx + BodyModel.tsx).
 * Rig also opts out of the compiler via the local `"use no memo"` directive —
 * compiler errors aren't ESLint-suppressible, only the directive opts out; this
 * disable just silences the editor's hook-immutability warnings.
 */

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Html, Lightformer, useGLTF } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { useSceneColors } from "@/lib/theme/use-scene-colors";
import { ATLAS_ZONES, type AtlasZone } from "./atlas-data";
import styles from "./atlas.module.css";

const DRACO = "/draco/";
useGLTF.preload("/models/body/body.glb", DRACO);

/**
 * AtlasScene — the interactive body atlas centrepiece. Loads body.glb, frames a
 * clinical 3/4 portrait of the head/face/ear region, and projects HTML hotspot
 * markers at the REAL anchor positions (lifted from anchors.json). Hovering /
 * clicking a hotspot drives the parent's selected-zone state, and the camera
 * eases focus toward the selected zone (the atlas "travels" between placements).
 *
 * Mounted exclusively via dynamic(ssr:false) behind a WebGL2 gate.
 */
export function AtlasScene({
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  /** 0..1 scroll progress through the atlas section — gently rotates the head. */
  scrollRef,
}: {
  selectedId: string;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  scrollRef: React.RefObject<number>;
}) {
  const scene = useSceneColors();

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0.34, 1.555, 0.46], fov: 26, near: 0.05, far: 50 }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        stencil: false,
      }}
      style={{ background: "transparent" }}
      onCreated={({ camera }) => camera.lookAt(0, 1.55, 0)}
    >
      <Rig selectedId={selectedId} scrollRef={scrollRef} isLight={scene.isLight} />

      {/* clinical key + fill, brighter on the white studio so the face lifts. */}
      <ambientLight intensity={scene.isLight ? 0.95 : 0.4} />
      <directionalLight position={[2.2, 2.6, 2.4]} intensity={scene.isLight ? 1.7 : 1.1} color="#fff7ec" />
      <directionalLight position={[-2.4, 1.4, 1.2]} intensity={scene.isLight ? 0.7 : 0.4} color="#cfe1ff" />
      <directionalLight position={[0, 2, -3]} intensity={scene.isLight ? 0.28 : 0.7} color={scene.accent} />
      {scene.isLight ? (
        <directionalLight position={[0.4, 1.6, 3]} intensity={0.8} color="#ffffff" />
      ) : null}

      {/* Re-bakes on theme toggle (keyed) so reflections re-skin. */}
      <Environment key={scene.isLight ? "studio-l" : "studio-d"} resolution={128}>
        <Lightformer form="ring" intensity={scene.isLight ? 1.4 : 2.4} position={[0, 4, 1]} scale={6} color="#fffdf5" />
        <Lightformer form="rect" intensity={1.2} position={[3, 1.5, 2]} rotation={[0, -Math.PI / 2, 0]} scale={6} color="#fff4dd" />
      </Environment>

      <fog attach="fog" args={[scene.fog, 1.4, 3.6]} />

      <Suspense fallback={null}>
        <AtlasHead
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={onSelect}
          onHover={onHover}
        />
      </Suspense>

      <EffectComposer>
        <Bloom
          luminanceThreshold={scene.isLight ? 1.0 : 0.7}
          luminanceSmoothing={0.3}
          intensity={scene.isLight ? 0.5 : 1.0}
          mipmapBlur
          levels={3}
        />
      </EffectComposer>
    </Canvas>
  );
}

// ── Camera rig: eases focus toward the selected zone + slow scroll yaw ────────

const _focus = new THREE.Vector3();
const _camTarget = new THREE.Vector3();

function Rig({
  selectedId,
  scrollRef,
  isLight,
}: {
  selectedId: string;
  scrollRef: React.RefObject<number>;
  isLight: boolean;
}) {
  // Three.js camera-rig pattern: useFrame mutates the live camera (position +
  // lookAt) each frame. React Compiler flags this as post-render mutation, but
  // it's the canonical r3f approach (see components/catalog/CameraRig.tsx). The
  // compiler error isn't ESLint-suppressible — only the directive opts out; the
  // file-level eslint-disable at the top silences the editor immutability hints.
  "use no memo";
  const { camera } = useThree();
  const reduced = useReducedMotion() ?? false;
  // Current eased look target + radius — refs only (no setState in frame).
  const lookRef = useRef(new THREE.Vector3(0, 1.55, 0));
  void isLight;

  const zone = useMemo(
    () => ATLAS_ZONES.find((z) => z.id === selectedId) ?? ATLAS_ZONES[0],
    [selectedId],
  );

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    // Look target eases toward the selected zone (clamped a touch toward head
    // centre so the face stays in frame, not edge-cropped).
    _focus.set(
      zone.position[0] * 0.55,
      THREE.MathUtils.clamp(zone.position[1], 1.06, 1.6),
      zone.position[2] * 0.5,
    );
    lookRef.current.x = THREE.MathUtils.damp(lookRef.current.x, _focus.x, 4, dt);
    lookRef.current.y = THREE.MathUtils.damp(lookRef.current.y, _focus.y, 4, dt);
    lookRef.current.z = THREE.MathUtils.damp(lookRef.current.z, _focus.z, 4, dt);

    // Scroll yaw: orbit the camera a few degrees around the head over the
    // section so the atlas reads as a slow instrument sweep. Reduced motion → 0.
    const p = reduced ? 0 : scrollRef.current ?? 0;
    const yaw = (p - 0.5) * 0.7; // ~±20°
    const radius = 0.56;
    const height = 1.555 + (lookRef.current.y - 1.55) * 0.4;
    _camTarget.set(
      Math.sin(0.55 + yaw) * radius,
      height,
      Math.cos(0.55 + yaw) * radius,
    );
    camera.position.x = THREE.MathUtils.damp(camera.position.x, _camTarget.x, 3, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, _camTarget.y, 3, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, _camTarget.z, 3, dt);
    camera.lookAt(lookRef.current);
  });

  return null;
}

// ── Body mesh (head focus) + hotspots ────────────────────────────────────────

function AtlasHead({
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}: {
  selectedId: string;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const gltf = useGLTF("/models/body/body.glb", DRACO) as unknown as {
    scene: THREE.Group;
  };

  // Hide anchor empties so they don't render. Mutating the cached scene is the
  // documented r3f pattern.
  useEffect(() => {
    gltf.scene.userData.isBodyModel = true;
    gltf.scene.traverse((obj: THREE.Object3D) => {
      if (obj.name.startsWith("anchor:")) obj.visible = false;
    });
  }, [gltf.scene]);

  return (
    <group>
      <primitive object={gltf.scene} />
      {ATLAS_ZONES.map((z) => (
        <Hotspot
          key={z.id}
          zone={z}
          active={selectedId === z.id}
          hovered={hoveredId === z.id}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
    </group>
  );
}

function Hotspot({
  zone,
  active,
  hovered,
  onSelect,
  onHover,
}: {
  zone: AtlasZone;
  active: boolean;
  hovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <group position={zone.position}>
      <Html
        center
        distanceFactor={0.9}
        zIndexRange={[40, 0]}
        // occlude against the body mesh so a hotspot behind the head hides.
        occlude="blending"
        style={{ pointerEvents: "auto" }}
      >
        <div
          className={[
            styles.hotspot,
            zone.flag === "left" ? styles.flagLeft : "",
            active || hovered ? styles.hotspotOn : "",
          ].join(" ")}
          role="button"
          tabIndex={0}
          aria-label={`${zone.name} — открыть детали`}
          aria-pressed={active}
          onClick={() => onSelect(zone.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(zone.id);
            }
          }}
          onPointerEnter={() => onHover(zone.id)}
          onPointerLeave={() => onHover(null)}
          onFocus={() => onHover(zone.id)}
          onBlur={() => onHover(null)}
        >
          <span className={styles.hotspotDot} aria-hidden="true" />
          <span className={styles.hotspotLabel}>
            <b>{zone.no}</b>
            {zone.name}
          </span>
        </div>
      </Html>
    </group>
  );
}
