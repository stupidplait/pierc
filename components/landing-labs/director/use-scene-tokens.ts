"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/lib/theme/theme-provider";

/**
 * Director variant — scene token reader.
 *
 * Reads the app-wide `--scene-*` CSS variables off <html> so the WebGL ring
 * re-skins with the theme. We DON'T keep these in React state via
 * useEffect+setState (the repo's strict react-hooks lint forbids that). Instead
 * the consumer also calls useTheme(); the returned `theme` string is keyed onto
 * the scene component so it remounts/regenerates materials + Environment on a
 * theme flip — and on each render we read the live computed tokens fresh.
 *
 * `useThemeTick()` is a thin useSyncExternalStore that re-renders the caller
 * whenever the <html> class / data-theme changes, without ever calling setState
 * in an effect.
 */

export interface SceneTokens {
  bg: string;
  ink: string;
  accent: string;
  reflect: string;
  gridMinor: string;
  gridMajor: string;
  isLight: boolean;
}

const DARK_FALLBACK: SceneTokens = {
  bg: "#080808",
  ink: "#ffffff",
  accent: "#f06ba0",
  reflect: "#000000",
  gridMinor: "#171717",
  gridMajor: "#3e3e3e",
  isLight: false,
};

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme"],
  });
  return () => observer.disconnect();
}

// A monotonically-changing snapshot string so useSyncExternalStore notices a
// theme flip. We hash the current theme class — cheap, allocation-free enough.
function getSnapshot(): string {
  return document.documentElement.className;
}
function getServerSnapshot(): string {
  return "theme-dark";
}

/** Re-renders the caller on every <html> theme-class change (lint-safe). */
export function useThemeTick(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Read the live --scene-* tokens. Call inside a component that also subscribes
 *  to theme changes (via useThemeTick or useTheme) so it re-reads on flip. */
export function readSceneTokens(): SceneTokens {
  if (typeof document === "undefined") return DARK_FALLBACK;
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fb: string) =>
    cs.getPropertyValue(name).trim() || fb;
  return {
    bg: get("--scene-bg", DARK_FALLBACK.bg),
    ink: get("--scene-ink", DARK_FALLBACK.ink),
    accent: get("--scene-accent", DARK_FALLBACK.accent),
    reflect: get("--scene-reflect", DARK_FALLBACK.reflect),
    gridMinor: get("--scene-grid-minor", DARK_FALLBACK.gridMinor),
    gridMajor: get("--scene-grid-major", DARK_FALLBACK.gridMajor),
    isLight: document.documentElement.classList.contains("theme-light"),
  };
}

/** Convenience: subscribe + read in one call. Returns fresh tokens on each
 *  theme change. Also pulls useTheme() so the value is consistent app-wide. */
export function useSceneTokens(): SceneTokens {
  useThemeTick();
  // Ensure we're inside the ThemeProvider; also makes the dependency explicit.
  useTheme();
  return readSceneTokens();
}
