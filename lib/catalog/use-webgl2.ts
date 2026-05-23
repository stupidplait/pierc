"use client";

import { useEffect, useState } from "react";

/**
 * Returns whether the current browser supports WebGL2.
 *
 *   - `null`  — not yet checked (initial SSR / first paint)
 *   - `true`  — WebGL2 confirmed available
 *   - `false` — unavailable; caller should render a non-3D fallback
 *
 * Cheap to run (one canvas creation) and runs once per mount via useEffect,
 * so the result is stable for the component's lifetime.
 */
export function useWebGL2Supported(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2");
      setSupported(!!gl);
    } catch {
      setSupported(false);
    }
  }, []);

  return supported;
}
