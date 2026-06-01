"use client";

import { useSyncExternalStore } from "react";

// Tailwind's `lg` breakpoint. Catalog switches between the stacked mobile
// layout and the full-bleed desktop console here.
const DESKTOP_QUERY = "(min-width: 1024px)";

// matchMedia as an external store — avoids set-state-in-effect (the project's
// ESLint treats that as an error; mirrors the pattern in booking/Drawer.tsx).
function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}

function getSnapshot(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches
  );
}

function getServerSnapshot(): boolean {
  return true; // assume desktop pre-hydration; corrected on first client read
}

/**
 * `true` at the Tailwind `lg` breakpoint and up. Drives single-canvas mounting
 * in the catalog so only one WebGL context exists at a time (rendering both the
 * mobile and desktop scenes — even with one `display:none` — would create two
 * contexts and upload the body model to the GPU twice).
 */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
