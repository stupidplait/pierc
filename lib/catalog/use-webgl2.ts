"use client";

import { useSyncExternalStore } from "react";

/**
 * Returns whether the current browser supports WebGL2.
 *
 *   - `null`  — SSR / not yet known (the hook subscribes once on the
 *               client and resolves on first paint)
 *   - `true`  — WebGL2 confirmed available
 *   - `false` — unavailable; caller should render a non-3D fallback
 *
 * The check runs once per page load and is cached at module scope —
 * subsequent calls (any number of components using this hook) read
 * the cached value without recreating a `<canvas>` each time.
 *
 * Implemented via `useSyncExternalStore` instead of
 * `useEffect + setState` so the project's `react-hooks/set-state-in-effect`
 * lint rule stays happy and React's concurrent-rendering guarantees
 * around external state are preserved.
 */

let cached: boolean | null = null;

function getSnapshot(): boolean | null {
  if (typeof document === "undefined") return null;
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement("canvas");
    cached = !!canvas.getContext("webgl2");
  } catch {
    cached = false;
  }
  return cached;
}

function getServerSnapshot(): boolean | null {
  // On the server we never know — the answer always comes from the
  // client. Returning null matches the original hook's "still
  // checking" sentinel so callers don't need to change.
  return null;
}

function subscribe(): () => void {
  // WebGL2 capability never changes during a session; no subscription
  // needed. The no-op unsubscriber is required by the API.
  return () => {};
}

export function useWebGL2Supported(): boolean | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
