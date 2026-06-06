"use client";

import { AdditiveBlending, BackSide, DoubleSide } from "three";
import { GradientTexture } from "@react-three/drei";
import type { BgVariant } from "@/lib/catalog/lab-state";
import { useSceneColors } from "@/lib/theme/use-scene-colors";
import { ACCENT } from "./types";

/**
 * DaisBackdrop — swappable backdrops that SURROUND the character-select figure
 * (a large inverted sphere / ring of columns), so the dais reads as a space
 * the figure stands inside rather than a flat card behind it. Driven by `?bg=`:
 *   - void     → nothing (bare dark stage)
 *   - glow     → a magenta horizon band wrapping the figure 360°
 *   - gradient → a soft neutral cyclorama dome
 *   - beams    → a ring of faint vertical light columns around the dais
 * All render behind everything (BackSide / no depth write).
 */
export function DaisBackdrop({ bg }: { bg: BgVariant }) {
  if (bg === "glow") return <Dome variant="glow" />;
  if (bg === "gradient") return <Dome variant="gradient" />;
  if (bg === "beams") return <Beams />;
  return null;
}

// ── Surrounding dome — an inverted sphere with a vertical gradient ───
// Centred on the figure's torso so the colour band sits around the body.
function Dome({ variant }: { variant: "glow" | "gradient" }) {
  // Vertical gradient (sphere UV ≈ latitude): poles fade to the page surface,
  // a coloured band sits at the horizon. Glow = a magenta wrap; gradient = a
  // neutral cyclorama. Themed so the dome reads as a soft halo on the light
  // page instead of the dark cavern it is on the dark stage.
  const { bg, isLight } = useSceneColors();
  const stops = [0, 0.4, 0.55, 0.72, 1];
  const colors = isLight
    ? variant === "glow"
      ? [bg, "#f3dbe6", "#f6c2d8", "#f3dbe6", bg]
      : [bg, "#ece9f1", "#e2dced", "#ece9f1", bg]
    : variant === "glow"
      ? ["#050507", "#1c0a13", "#43102a", "#1a0a12", "#050507"]
      : ["#050507", "#14101a", "#221a28", "#15121b", "#050507"];

  return (
    <mesh position={[0, 1.1, 0]} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[9, 48, 32]} />
      <meshBasicMaterial side={BackSide} depthWrite={false} toneMapped={false} fog={false}>
        {/* Key on the theme so the baked gradient texture regenerates when
            the visitor toggles light/dark while standing in the catalog. */}
        <GradientTexture
          key={`${variant}-${isLight ? "light" : "dark"}`}
          stops={stops}
          colors={colors}
        />
      </meshBasicMaterial>
    </mesh>
  );
}

// ── beams — a ring of faint additive light columns around the figure ─
const BEAMS = [
  { a: -0.7, w: 0.45, o: 0.1, cool: false },
  { a: -0.2, w: 0.28, o: 0.07, cool: true },
  { a: 0.35, w: 0.5, o: 0.1, cool: false },
  { a: 0.85, w: 0.3, o: 0.08, cool: true },
  { a: 1.4, w: 0.4, o: 0.07, cool: false },
  { a: -1.3, w: 0.32, o: 0.06, cool: true },
];
const BEAM_RADIUS = 3.2;

function Beams() {
  return (
    <group position={[0, 1.5, 0]}>
      {BEAMS.map((b, i) => {
        const x = Math.sin(b.a) * BEAM_RADIUS;
        const z = -Math.cos(b.a) * BEAM_RADIUS;
        return (
          <mesh key={i} position={[x, 0, z]} rotation={[0, b.a, 0]} frustumCulled={false}>
            <planeGeometry args={[b.w, 10]} />
            <meshBasicMaterial
              color={b.cool ? "#7fbfff" : ACCENT}
              transparent
              opacity={b.o}
              blending={AdditiveBlending}
              depthWrite={false}
              side={DoubleSide}
              toneMapped={false}
              fog={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
