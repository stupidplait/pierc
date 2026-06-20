"use client";

import { useEffect } from "react";
import { useProgress } from "@react-three/drei";
import { AnimatePresence, m } from "framer-motion";
import { catalogStrings } from "@/lib/i18n/ru";
import type { LoaderVariant } from "@/lib/catalog/lab-state";
import { markSceneReady, useSceneReady } from "@/lib/catalog/scene-ready";
import { cn } from "@/lib/utils";

/** The branded loader glyph. Locked design: loader = "spinner" — the bars /
 *  pulse / ring glyphs from the design lab were removed. */
function LoaderGlyph() {
  return (
    <span className="size-9 animate-spin rounded-full border-2 border-line border-t-accent" />
  );
}

/** Branded spinner — a loader glyph + a mono caption. */
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
 * CatalogSceneLoader — full-stage cover shown while the body model + initial
 * assets load (drei `useProgress`), then fades out and never returns (later
 * jewelry GLBs load behind the live scene). Also shows on a manual preview.
 */
export function CatalogSceneLoader({
  variant = "spinner",
}: {
  variant?: LoaderVariant;
}) {
  const { progress, active } = useProgress();
  const ready = useSceneReady();
  useEffect(() => {
    if (!active && progress >= 100) markSceneReady();
  }, [active, progress]);
  const show = !ready;

  return (
    <AnimatePresence>
      {show ? (
        <m.div
          key="scene-loader"
          className="absolute inset-0 z-30 grid place-items-center bg-bg"
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <Spinner
            variant={variant}
            label={catalogStrings.showroom.sceneLoading}
            progress={progress}
          />
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
