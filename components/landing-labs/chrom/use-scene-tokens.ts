"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

/* ════════════════════════════════════════════════════════════════════
   ХРОМ — reads the theme-aware --scene-* CSS tokens off <html> so the
   WebGL scene re-skins on a light/dark toggle (canonical approach from
   components/scene/wireframe-room/colors.ts). A MutationObserver on the
   html class/data-theme re-reads + the memo rebuilds THREE.Colors, so
   materials/env can regenerate when the theme flips.
   ════════════════════════════════════════════════════════════════════ */

export interface ChromTokens {
  bg: THREE.Color;
  ink: THREE.Color;
  accent: THREE.Color;
  reflect: THREE.Color;
  fog: THREE.Color;
  isLight: boolean;
}

const DARK = {
  bg: "#080808",
  ink: "#ffffff",
  accent: "#7cdfff",
  reflect: "#000000",
  fog: "#070709",
};

export function useSceneTokens(): ChromTokens {
  const [raw, setRaw] = useState(DARK);
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const read = () => {
      const s = getComputedStyle(html);
      const get = (name: string, fb: string) =>
        s.getPropertyValue(name).trim() || fb;
      setRaw({
        bg: get("--scene-bg", DARK.bg),
        ink: get("--scene-ink", DARK.ink),
        // prefer the cyan brand accent for chrom; fall back to scene accent
        accent: "#7cdfff",
        reflect: get("--scene-reflect", DARK.reflect),
        fog: get("--scene-fog", DARK.fog),
      });
      setIsLight(html.classList.contains("theme-light"));
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(html, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return useMemo(
    () => ({
      bg: new THREE.Color(raw.bg),
      ink: new THREE.Color(raw.ink),
      accent: new THREE.Color(raw.accent),
      reflect: new THREE.Color(raw.reflect),
      fog: new THREE.Color(raw.fog),
      isLight,
    }),
    [raw, isLight],
  );
}
