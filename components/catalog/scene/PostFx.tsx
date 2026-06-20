"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import type { HudVariant } from "@/lib/catalog/lab-state";
import { useSceneColors } from "@/lib/theme/use-scene-colors";

/**
 * Catalog postprocessing, driven by the hud axis (not the env):
 *   - full     → punchy arcade bloom + vignette (the magenta grid/rim glows)
 *   - landing  → mirrors the new-design scene's Bloom params for a 1:1 look
 *   - subtle   → no postprocessing at all (clean, restrained)
 *
 * Rendered as the last child of ShowroomStage's <Canvas>. Reduced-motion users
 * keep bloom (it's static) — only the env's ambient motion is what we freeze.
 *
 * Theme tuning (bloom threshold/intensity, vignette darkness) is applied
 * IMPERATIVELY via refs, NOT as props: these are effect constructor args, so
 * changing them via props rebuilds the effects inside <EffectComposer>, which
 * under React 19 dev crashes the canvas (circular-JSON while serializing the
 * THREE scene → WebGL context loss). Mutating the underlying material/uniform
 * in place avoids the rebuild. On light the lit body is near-white and would
 * bloom into a halo, so the threshold is lifted above it; the dark vignette is
 * also pulled back so it doesn't grime the white page's corners.
 */
export function PostFx({ hud }: { hud: HudVariant }) {
  const { isLight } = useSceneColors();
  const bloomRef = useRef<{
    intensity: number;
    luminanceMaterial?: { threshold: number };
  } | null>(null);
  const vignetteRef = useRef<{ darkness: number } | null>(null);
  const { invalidate } = useThree();

  useEffect(() => {
    const b = bloomRef.current;
    if (b) {
      if (b.luminanceMaterial) {
        b.luminanceMaterial.threshold = isLight
          ? 1.0
          : hud === "landing"
            ? 0.85
            : 0.55;
      }
      b.intensity = isLight ? 0.6 : hud === "landing" ? 1.0 : 1.4;
    }
    const v = vignetteRef.current;
    if (v) v.darkness = isLight ? 0.2 : 0.75;
    invalidate(); // demand frameloop — repaint with the new tuning
  }, [isLight, hud, invalidate]);

  if (hud === "subtle") return null;

  if (hud === "landing") {
    // Match WireframeRoom's Bloom configuration so catalog ≈ landing.
    return (
      <EffectComposer>
        <Bloom
          ref={bloomRef}
          luminanceThreshold={0.85}
          luminanceSmoothing={0.3}
          intensity={1.0}
          mipmapBlur
          levels={3}
        />
      </EffectComposer>
    );
  }

  // full — heavier glow + a soft vignette to frame the stage.
  return (
    <EffectComposer>
      <Bloom
        ref={bloomRef}
        luminanceThreshold={0.55}
        luminanceSmoothing={0.25}
        intensity={1.4}
        mipmapBlur
        levels={4}
      />
      <Vignette ref={vignetteRef} eskil={false} offset={0.2} darkness={0.75} />
    </EffectComposer>
  );
}
