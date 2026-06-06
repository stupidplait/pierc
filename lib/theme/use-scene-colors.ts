"use client";

import { useEffect, useState } from "react";

/**
 * Reads the resolved `--scene-*` CSS custom properties off <html> and keeps
 * them live across theme + light-hero changes (the toggle swaps the `.theme-*`
 * / `.lighthero-*` class and the `data-theme` attribute; we observe both).
 *
 * Returns the raw resolved colour strings — drei/three accept CSS colour
 * strings directly for `color` / `cellColor` / fog args, so callers can pass
 * these straight through. `isLight` lets a scene dial effects (fog density,
 * rim intensity) that aren't a single colour swap.
 *
 * Pairs with WireframeRoom's own `useThemeColors` (which parses to THREE.Color
 * for shader uniforms); this lighter variant is for components that only need
 * to feed colour strings into drei materials.
 */
export interface SceneColors {
  bg: string;
  fog: string;
  dais: string;
  gridCell: string;
  gridSection: string;
  accent: string;
  ink: string;
  isLight: boolean;
}

const FALLBACK: SceneColors = {
  bg: "#080808",
  fog: "#070709",
  dais: "#0d0d10",
  gridCell: "#1c1c20",
  gridSection: "#3a2230",
  accent: "#fe017e",
  ink: "#ffffff",
  isLight: false,
};

function readSceneColors(): SceneColors {
  if (typeof document === "undefined") return FALLBACK;
  const root = document.documentElement;
  const s = getComputedStyle(root);
  const get = (name: string, fb: string) =>
    s.getPropertyValue(name).trim() || fb;
  return {
    bg: get("--scene-bg", FALLBACK.bg),
    fog: get("--scene-fog", FALLBACK.fog),
    dais: get("--scene-dais", FALLBACK.dais),
    gridCell: get("--scene-grid-cell", FALLBACK.gridCell),
    gridSection: get("--scene-grid-section", FALLBACK.gridSection),
    accent: get("--scene-accent", FALLBACK.accent),
    ink: get("--scene-ink", FALLBACK.ink),
    isLight: root.classList.contains("theme-light"),
  };
}

export function useSceneColors(): SceneColors {
  // Lazy initial read so the first render already has the correct palette —
  // important for one-shot consumers like drei's <GradientTexture>, which
  // bakes its texture from the colours present on mount and won't pick up a
  // post-effect state change under the catalog's demand frameloop. (These
  // hosts are all ssr:false, so document is available at init.)
  const [colors, setColors] = useState<SceneColors>(readSceneColors);

  useEffect(() => {
    const read = () => setColors(readSceneColors());
    read(); // re-sync in case the class landed between init and mount
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}
