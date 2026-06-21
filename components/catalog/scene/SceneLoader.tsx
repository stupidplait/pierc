"use client";

import { useEffect } from "react";
import { AnimatePresence, m } from "framer-motion";
import type { LoaderVariant } from "@/lib/catalog/lab-state";
import { markSceneReady, useSceneReady } from "@/lib/catalog/scene-ready";
import { CatalogLoadingScreen } from "./CatalogLoadingScreen";
import { cn } from "@/lib/utils";

/** The branded loader glyph. Locked design: loader = "spinner" — the bars /
 *  pulse / ring glyphs from the design lab were removed. */
function LoaderGlyph() {
  return (
    <span className="size-9 animate-spin rounded-full border-2 border-line border-t-accent" />
  );
}

/**
 * Branded spinner — a loader glyph + a mono caption, on a transparent surface.
 * Used by the detail-page GLB viewer (CatalogGlbViewer) over its own backdrop.
 * The full-stage scene cover uses <CatalogLoadingScreen> instead (same glyph on
 * an opaque bg-bg surface).
 */
export function Spinner({
  label,
  progress,
  className,
}: {
  // `variant` is still accepted so callers can thread the loader axis through,
  // but the locked design only renders the spinner glyph now.
  variant?: LoaderVariant;
  label?: string;
  progress?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <LoaderGlyph />
      {label ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">
          {label}
          {typeof progress === "number" && progress < 100
            ? ` ${Math.round(progress)}%`
            : ""}
        </p>
      ) : null}
    </div>
  );
}

/**
 * CatalogSceneLoader — full-stage cover shown while the body model loads, then
 * fades out and never returns (later jewelry GLBs load behind the live scene
 * behind their own per-piece placeholders).
 *
 * Readiness is driven by {@link useSceneReady}, which `<BodyModel onReady>`
 * flips the instant the body is in the scene graph. We deliberately do NOT gate
 * on drei's `useProgress`: that store is a module-level singleton shared with
 * the landing page's r3f canvases, and navigating in from the landing can leave
 * it in a state the catalog never resolves (body.glb resolves from cache with
 * no fresh progress events) — which used to strand this cover on a permanent
 * spinner. A timeout backstop guarantees the cover can never outlive the scene
 * even if the mount signal is somehow missed.
 */
export function CatalogSceneLoader() {
  const ready = useSceneReady();

  // Safety net: reveal the scene after a generous timeout no matter what, so a
  // missed ready-signal (e.g. body.glb 404s and its Suspense never resolves)
  // can never freeze the page on a loader. The normal landing->catalog case is
  // already handled instantly by the body-mount signal (a cached body commits
  // immediately), so this only ever fires on genuine asset failure — hence it's
  // set above a slow-mobile body load + Draco decode rather than aggressively.
  // `markSceneReady` is idempotent, so a late real signal is harmless.
  useEffect(() => {
    const t = setTimeout(markSceneReady, 8000);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {ready ? null : (
        <m.div
          key="scene-loader"
          className="absolute inset-0 z-30"
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <CatalogLoadingScreen />
        </m.div>
      )}
    </AnimatePresence>
  );
}
