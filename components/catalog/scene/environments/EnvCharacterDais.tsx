"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Grid, MeshReflectorMaterial } from "@react-three/drei";
import type { BgVariant } from "@/lib/catalog/lab-state";
import { useSceneColors } from "@/lib/theme/use-scene-colors";
import { DaisBackdrop } from "./DaisBackdrop";

/**
 * Character-select dais — the body stands on a polished reflective disc set
 * into an infinite grid floor that fades into fog, lit with a strong magenta
 * rim so the silhouette pops like a fighting-game roster screen. The backdrop
 * behind the figure is swappable (`?bg=`). The idle turntable that completes
 * the look lives in CatalogStage (it must spin the body + equipped jewelry
 * together), gated on reduced-motion + no selection.
 */
export function EnvCharacterDais({ bg }: { bg: BgVariant }) {
  // Theme the stage from the shared --scene-* tokens so the dais matches the
  // page surface in every theme/light-hero combination. The fog colour tracks
  // the page background so the figure dissolves into it instead of into a
  // black halo on a white page.
  const scene = useSceneColors();
  const { invalidate } = useThree();

  // The catalog runs frameloop="demand"; repaint when the palette changes.
  useEffect(() => {
    invalidate();
  }, [scene, invalidate]);

  // On the dark stage the figure pops off a near-black void, so it needs
  // little fill. On the white studio that same rig leaves the body reading
  // dark against the bright page — so raise the key/ambient/front-fill and
  // ease the magenta rim (which would just muddy the figure on white).
  const rimIntensity = scene.isLight ? 0.32 : 0.9;
  const fillPoint = scene.isLight ? 7 : 6;
  const ambient = scene.isLight ? 1.05 : 0.35;
  const keyIntensity = scene.isLight ? 1.7 : 1.0;
  const fillIntensity = scene.isLight ? 0.8 : 0.4;

  return (
    <>
      {/* Fog pushed back so the backdrop reads; bare void keeps the tight haze. */}
      <fog attach="fog" args={[scene.fog, bg === "void" ? 3 : 5, 16]} />

      <DaisBackdrop bg={bg} />

      <ambientLight intensity={ambient} />
      <directionalLight position={[3, 6, 4]} intensity={keyIntensity} color="#fff7ec" />
      <directionalLight position={[-3, 3, 2]} intensity={fillIntensity} color="#cfe1ff" />
      {/* Front fill aimed at the camera side — only on light, to lift the face
          out of shadow against the white page. */}
      {scene.isLight ? (
        <directionalLight position={[0, 1.6, 3.5]} intensity={0.9} color="#ffffff" />
      ) : null}
      {/* Magenta rim from behind for the roster-screen silhouette. */}
      <directionalLight position={[0, 3, -4]} intensity={rimIntensity} color={scene.accent} />
      <pointLight position={[0, 0.4, 2.2]} intensity={fillPoint} distance={6} color="#ffd9ec" />

      {/* Polished reflective dais the figure stands on. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <circleGeometry args={[1.05, 64]} />
        <MeshReflectorMaterial
          resolution={1024}
          blur={[300, 80]}
          mixBlur={1}
          mixStrength={45}
          roughness={0.85}
          depthScale={1.1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.2}
          color={scene.dais}
          metalness={0.6}
          mirror={0.55}
        />
      </mesh>

      {/* Grid floor surrounding the dais, fading into fog. */}
      <Grid
        position={[0, 0, 0]}
        args={[24, 24]}
        infiniteGrid
        cellSize={0.2}
        cellThickness={0.5}
        cellColor={scene.gridCell}
        sectionSize={1}
        sectionThickness={1}
        sectionColor={scene.gridSection}
        fadeDistance={11}
        fadeStrength={2.5}
      />
    </>
  );
}
