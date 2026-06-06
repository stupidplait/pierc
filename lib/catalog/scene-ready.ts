"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny external store for "the catalog scene has finished its FIRST load".
 * Read via {@link useSceneReady} (useSyncExternalStore — the project's pattern
 * for external state, avoiding set-state-in-effect), flipped once via
 * {@link markSceneReady} from an effect/event. Module-scoped so it's true for
 * the rest of the session: later jewelry-GLB loads must not re-show the cover.
 */
let ready = false;
const listeners = new Set<() => void>();

export function markSceneReady(): void {
  if (ready) return;
  ready = true;
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): boolean {
  return ready;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useSceneReady(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
