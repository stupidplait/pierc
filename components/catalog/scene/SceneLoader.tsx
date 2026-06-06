"use client";

import { useEffect } from "react";
import { useProgress } from "@react-three/drei";
import { AnimatePresence, m } from "framer-motion";
import { catalogStrings } from "@/lib/i18n/ru";
import type { LoaderVariant } from "@/lib/catalog/lab-state";
import { markSceneReady, useSceneReady } from "@/lib/catalog/scene-ready";
import { useLoaderPreview } from "@/lib/catalog/loader-preview";
import { cn } from "@/lib/utils";

/** The animated loader glyph — four switchable styles (?loader=). */
function LoaderGlyph({
  variant,
  progress,
}: {
  variant: LoaderVariant;
  progress?: number;
}) {
  if (variant === "bars") {
    return (
      <span className="flex h-8 items-end gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="loader-bar w-1.5 rounded-full bg-accent"
            style={{ height: "100%", animationDelay: `${i * 120}ms` }}
          />
        ))}
      </span>
    );
  }

  if (variant === "pulse") {
    return (
      <span className="relative grid size-9 place-items-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" />
        <span className="size-3 rounded-full bg-accent" />
      </span>
    );
  }

  if (variant === "ring") {
    const p =
      typeof progress === "number"
        ? Math.max(0, Math.min(100, progress))
        : null;
    const C = 2 * Math.PI * 15;
    return (
      <svg
        viewBox="0 0 36 36"
        className={cn("size-9 -rotate-90", p === null && "animate-spin")}
        aria-hidden="true"
      >
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--color-line)" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={p === null ? C * 0.72 : C * (1 - p / 100)}
        />
      </svg>
    );
  }

  // spinner (default) — capped ring.
  return (
    <span className="size-9 animate-spin rounded-full border-2 border-line border-t-accent" />
  );
}

/** Branded spinner — a loader glyph + a mono caption. */
export function Spinner({
  variant = "spinner",
  label,
  progress,
  className,
}: {
  variant?: LoaderVariant;
  label?: string;
  progress?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <LoaderGlyph variant={variant} progress={progress} />
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
  const preview = useLoaderPreview();
  useEffect(() => {
    if (!active && progress >= 100) markSceneReady();
  }, [active, progress]);
  const show = !ready || preview;

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
            progress={preview ? undefined : progress}
          />
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
