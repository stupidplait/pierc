"use client";

import { BackSide } from "three";
import { GradientTexture } from "@react-three/drei";
import type { BgVariant } from "@/lib/catalog/lab-state";
import { useSceneColors } from "@/lib/theme/use-scene-colors";

/**
 * DaisBackdrop — the backdrop that SURROUNDS the character-select figure: a
 * large inverted sphere ("glow") wrapping a magenta horizon band 360° around
 * the dais, so it reads as a space the figure stands inside rather than a flat
 * card behind it. Renders behind everything (BackSide / no depth write).
 *
 * Locked design: bg = "glow". The void / gradient / beams variants from the
 * design lab were removed; any other value renders nothing.
 */
export function DaisBackdrop({ bg }: { bg: BgVariant }) {
  return bg === "glow" ? <Dome /> : null;
}

// ── Surrounding dome — an inverted sphere with a vertical gradient ───
// Centred on the figure's torso so the magenta band sits around the body.
function Dome() {
  // Vertical gradient (sphere UV ≈ latitude): poles fade to the page surface,
  // a magenta band sits at the horizon. Themed so the dome reads as a soft halo
  // on the light page instead of the dark cavern it is on the dark stage.
  const { bg, isLight } = useSceneColors();
  const stops = [0, 0.4, 0.55, 0.72, 1];
  const colors = isLight
    ? [bg, "#f3dbe6", "#f6c2d8", "#f3dbe6", bg]
    : ["#050507", "#1c0a13", "#43102a", "#1a0a12", "#050507"];

  return (
    <mesh position={[0, 1.1, 0]} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[9, 48, 32]} />
      <meshBasicMaterial side={BackSide} depthWrite={false} toneMapped={false} fog={false}>
        {/* Key on the theme so the baked gradient texture regenerates when
            the visitor toggles light/dark while standing in the catalog. */}
        <GradientTexture
          key={isLight ? "light" : "dark"}
          stops={stops}
          colors={colors}
        />
      </meshBasicMaterial>
    </mesh>
  );
}
