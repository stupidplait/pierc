"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { useTheme } from "@/lib/theme/theme-provider";

/**
 * StudScene — the single, small 3D accent for «ОСТРИЁ»: one chrome labret stud
 * slowly rotating in the hero corner. Deliberately minimal (this variant is
 * type-led). It reads the SEPARATE --scene-* tokens so the canvas re-skins with
 * the theme, and is keyed on `theme` from the shell so <Environment> regenerates.
 *
 * Loaded via dynamic import with { ssr:false } from Experience; WebGL is guarded
 * upstream by useWebGL2Supported(). DRACO decoders live in /public/draco/.
 */

const GLB_URL = "/jewelry-glb/labret-titanium-ball-6mm-16g.glb";
const DRACO_PATH = "/draco/";

useGLTF.preload(GLB_URL, DRACO_PATH);

/** Reads --scene-* tokens off <html>, re-reading on theme change. */
function useSceneTokens() {
  const [tokens, setTokens] = useState({
    ink: "#0a0a0a",
    accent: "#e91e63",
    reflect: "#15131a",
    isLight: true,
  });

  useEffect(() => {
    const read = () => {
      const s = getComputedStyle(document.documentElement);
      const get = (n: string, fb: string) => s.getPropertyValue(n).trim() || fb;
      setTokens({
        ink: get("--scene-ink", "#0a0a0a"),
        accent: get("--scene-accent", "#e91e63"),
        reflect: get("--scene-reflect", "#15131a"),
        isLight: document.documentElement.classList.contains("theme-light"),
      });
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return tokens;
}

function Stud({ accent }: { accent: string }) {
  const gltf = useGLTF(GLB_URL, DRACO_PATH);
  const groupRef = useRef<THREE.Group>(null);
  const reduceRef = useRef(false);

  useEffect(() => {
    reduceRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);

  // Centre + fit the GLB once so any piece sits framed regardless of its origin.
  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    clone.position.sub(center);
    const fit = 2.4 / maxDim;
    clone.scale.setScalar(fit);
    // Retint to a polished chrome/accent so the stud reads as jewelry, not GLB.
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(accent),
      metalness: 1,
      roughness: 0.18,
      envMapIntensity: 1.4,
    });
    clone.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).material = mat;
      }
    });
    return clone;
  }, [gltf.scene, accent]);

  useFrame((_, delta) => {
    if (!groupRef.current || reduceRef.current) return;
    groupRef.current.rotation.y += delta * 0.5;
    groupRef.current.rotation.x += delta * 0.12;
  });

  // Dispose the cloned material/geometry on unmount.
  useEffect(() => {
    return () => {
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose?.();
          const m = mesh.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m?.dispose?.();
        }
      });
    };
  }, [scene]);

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}

export default function StudScene() {
  const { theme } = useTheme();
  const tokens = useSceneTokens();
  // Key the Environment subtree on theme so the PMREM cubemap regenerates with
  // the right reflection wash when the user toggles light/dark.
  const isLight = tokens.isLight;

  return (
    <Canvas
      dpr={[1, 1.6]}
      camera={{ fov: 38, position: [0, 0, 4.6] }}
      gl={{ antialias: true, alpha: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <Suspense fallback={null}>
        <Stud accent={tokens.accent} />
        <Environment key={theme} resolution={128}>
          <mesh scale={60}>
            <sphereGeometry args={[1, 24, 24]} />
            <meshBasicMaterial
              color={tokens.reflect}
              side={THREE.BackSide}
            />
          </mesh>
          <Lightformer
            form="ring"
            intensity={4}
            position={[0, 3, 2]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[4, 4, 1]}
            color="#fffdf5"
          />
          <Lightformer
            form="rect"
            intensity={2}
            position={[3, 1, 1]}
            rotation={[0, -Math.PI / 2, 0]}
            scale={[5, 5, 1]}
            color={tokens.accent}
          />
        </Environment>
      </Suspense>
      <ambientLight intensity={isLight ? 0.5 : 0.25} />
      <directionalLight position={[2, 3, 4]} intensity={1.1} />
      <EffectComposer>
        {/* On light, lift the threshold above the white studio so the stud
            doesn't blow out; on dark, let the chrome highlight glow. */}
        <Bloom
          luminanceThreshold={isLight ? 1.0 : 0.6}
          luminanceSmoothing={0.3}
          intensity={isLight ? 0.4 : 0.9}
          mipmapBlur
          levels={3}
        />
      </EffectComposer>
    </Canvas>
  );
}
