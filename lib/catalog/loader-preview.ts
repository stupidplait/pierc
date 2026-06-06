"use client";

import { useSyncExternalStore } from "react";

/**
 * Dev affordance: force the scene loader visible for a moment so loader styles
 * can be compared without waiting for a real load. `previewLoader(ms)` flips a
 * flag (read via useSyncExternalStore — lint-clean) for `ms`, then clears it.
 */
let previewing = false;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

export function previewLoader(ms = 1000): void {
  previewing = true;
  for (const l of listeners) l();
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    previewing = false;
    timer = null;
    for (const l of listeners) l();
  }, ms);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): boolean {
  return previewing;
}

export function useLoaderPreview(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
