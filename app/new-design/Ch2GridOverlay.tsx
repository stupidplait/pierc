"use client";

import { useEffect, useRef } from "react";
import styles from "./page.module.css";

interface Ch2GridOverlayProps {
    /* Drives the 2D-grid slide. 0 = off-screen below, 1 = fully covering
       the viewport. Read every frame; --grid-translate on the overlay is
       mutated directly to avoid React re-renders. */
    ch2BodyPhase: React.RefObject<number>;
}

/**
 * Ch2GridOverlay — the 2D HTML floor that rises from the bottom of the
 * viewport during Ch2 to take over from the held 3D floor close-up.
 *
 * **Floor-continuity intent.** This is NOT a translucent panel sliding
 * over the scene; the goal is for the visitor to read the transition
 * as "the floor just changed colour." Pattern, alphas, and background
 * colour are calibrated against the 3D corridor floor at stage-D camera
 * distance so the handover is invisible — the only perceptible change
 * is that the things behind/above the rising edge get occluded by an
 * identical-looking surface. (See .ch2GridOverlay calibration comment
 * in page.module.css.)
 *
 * Animation vocabulary:
 *
 *   • Pure vertical slide. ONE axis of motion only — translateY.
 *     No fade, no blur, no scale-Y squash. The grid is fully opaque
 *     from the moment it appears at the bottom of the viewport to the
 *     moment it leaves at exit. The off-screen translateY(100%) hides
 *     it pre-arrival; no opacity ramp needed.
 *
 *   • easeOutCubic on the slide so it decelerates as it lands rather
 *     than arriving at constant velocity. No bounce, no overshoot.
 *
 *   • Long, deliberate climb across the majority of the chapter
 *     phase. The previous "snap up early then sit idle" pacing read as
 *     the transition happening at the start of Ch2 instead of being
 *     the transition INTO Ch2.
 *
 * Lifecycle across ch2BodyPhase (0 = top of Ch2, 1 = bottom of Ch2):
 *
 *   • 0.00 → 0.30   slide IN (translateY 100% → 0%, easeOutCubic).
 *                   Grid fully covers the viewport at ph = 0.30.
 *                   Ch2 content (body GLB, nameplate, zones) begins
 *                   revealing only after this — gated by
 *                   --ch2-content-reveal / --ch2-body-reveal /
 *                   --ch2-zones-reveal in BodyModelPreview.
 *   • 0.30 → 1.00   held PERMANENTLY at 0% — grid is the section's
 *                   floor for the rest of Ch2. Per the latest design
 *                   pass the slide-out at chapter exit was removed:
 *                   once the grid covers the screen it stays as the
 *                   backdrop, with the body GLB rotating in over it.
 */
export default function Ch2GridOverlay({ ch2BodyPhase }: Ch2GridOverlayProps) {
    const overlayRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        let raf = 0;
        const tick = () => {
            const ph = ch2BodyPhase.current ?? 0;

            // Slide-in 0 → 0.30 with easeOutCubic.
            const inT = Math.max(0, Math.min(1, ph / 0.3));
            const inEased = 1 - Math.pow(1 - inT, 3);

            const overlay = overlayRef.current;
            if (overlay) {
                // Grid rises until ph=0.30, then sits at 0% for the
                // rest of the chapter — never retreats.
                const translateY = (1 - inEased) * 100;
                overlay.style.setProperty("--grid-translate", `${translateY}%`);
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [ch2BodyPhase]);

    return <div ref={overlayRef} className={styles.ch2GridOverlay} aria-hidden="true" />;
}
