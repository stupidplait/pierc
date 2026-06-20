// Extracted from WireframeRoom.tsx (mechanical split — no logic changes).
import { useSyncExternalStore } from "react";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function subscribeReducedMotion(onChange: () => void): () => void {
    const mql = window.matchMedia(REDUCED_MOTION_QUERY);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
}

/**
 * Detects prefers-reduced-motion (accessibility / vestibular disorders).
 * useSyncExternalStore keeps SSR + client consistent and re-renders only on the
 * (rare) runtime change — no setState-in-effect or ref-read-during-render.
 */
export function useReducedMotion(): boolean {
    return useSyncExternalStore(
        subscribeReducedMotion,
        () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
        () => false, // server snapshot: assume motion is allowed
    );
}
