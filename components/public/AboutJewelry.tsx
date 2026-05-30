"use client";

import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import { useWebGL2Supported } from "@/lib/catalog/use-webgl2";

// Three.js needs `window` — defer the whole scene past hydration, never SSR it.
const AboutJewelryScene = dynamic(
  () => import("./AboutJewelryScene").then((m) => m.AboutJewelryScene),
  { ssr: false },
);

// Fade the canvas into the dotted backdrop and pool it toward the right so the
// hero copy on the left stays fully legible.
const FADE: CSSProperties = {
  opacity: 0.72,
  WebkitMaskImage:
    "radial-gradient(ellipse 68% 70% at 70% 42%, #000 26%, transparent 74%)",
  maskImage:
    "radial-gradient(ellipse 68% 70% at 70% 42%, #000 26%, transparent 74%)",
};

/**
 * AboutJewelry — client gate for the decorative 3D hero piece.
 *
 * Renders nothing until WebGL2 is confirmed (during the brief `null` window,
 * and permanently on `false`) — in those cases the page's AuthBackdrop is the
 * complete, intended backdrop, exactly like the catalog's LiteMode fallback.
 */
export function AboutJewelry({ className = "" }: { className?: string }) {
  const webgl2 = useWebGL2Supported();
  if (!webgl2) return null;

  return (
    <div className={`pointer-events-none ${className}`} aria-hidden>
      <div className="h-full w-full" style={FADE}>
        <AboutJewelryScene />
      </div>
    </div>
  );
}
