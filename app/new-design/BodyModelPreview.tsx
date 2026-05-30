"use client";

import { useEffect } from "react";
import styles from "./page.module.css";
import { useScrollReveal } from "@/lib/hooks/useScrollReveal";
import BodyModelGLB from "./BodyModelGLB";

/* Body areas — zone IDs match BUST_ANCHORS in WireframeRoom.tsx so the
   active jewelry travels to the correct anchor on the wireframe bust
   when the user picks a zone. */
const BODY_AREAS = [
    { id: "ear_left", label: "Левое ухо", count: 8 },
    { id: "ear_right", label: "Правое ухо", count: 8 },
    { id: "nose", label: "Нос", count: 3 },
    { id: "lip", label: "Губа", count: 4 },
    { id: "eyebrow", label: "Бровь", count: 2 },
    { id: "navel", label: "Пупок", count: 1 },
];

interface BodyModelPreviewProps {
    chapterRef: React.RefObject<HTMLDivElement | null>;
    /* Scroll-driven progress through Ch2's own viewport (0 at top, 1
       at bottom). When provided, the chapter switches to scroll-driven
       reveals: nameplate / body / zones lerp in from --ch2-content-reveal
       et al, gated AFTER the grid settles at ph 0.35. When omitted (the
       /new-design-cinematic and /new-design-editorial variant pages
       reuse this component without the canonical's scroll wiring), the
       chapter falls back to the generic data-visible binary slide-in.

       The variant pages aren't part of the canonical landing — they're
       an idea bank kept around for design polishing per DESIGN.md. */
    ch2BodyPhase?: React.RefObject<number>;
    onAreaChange?: (areaId: string) => void;
    activeArea: string;
}

export default function BodyModelPreview({
    chapterRef,
    ch2BodyPhase,
    onAreaChange,
    activeArea,
}: BodyModelPreviewProps) {
    const { isVisible, progress } = useScrollReveal(chapterRef, { once: false });
    const activeIdx = Math.max(
        0,
        BODY_AREAS.findIndex((a) => a.id === activeArea)
    );
    const activeLabel = BODY_AREAS[activeIdx]?.label ?? "";

    /* Ch2 content reveal — scroll-driven from ch2BodyPhase, NOT from
       the binary data-visible attribute. The grid (Ch2GridOverlay)
       finishes rising at ph = 0.75; until that handover happens the
       content must remain completely offstage so the visitor reads
       the transition as "the floor changed colour" rather than
       "elements appeared on top of a panel." All three reveal windows
       therefore start at ph ≥ 0.75.

       Three exposed variables on the chapter root:
         --ch2-content-reveal  0 → 1  across ph 0.75 → 0.85  (nameplate)
         --ch2-body-reveal     0 → 1  across ph 0.78 → 0.90  (SVG bust)
         --ch2-zones-reveal    0 → 1  across ph 0.85 → 0.97  (rail + callouts)

       After 0.97 the grid begins its compressed slide-out (Ch2GridOverlay
       handles 0.97 → 1.00 itself); content stays at full reveal until
       chapter2 leaves the viewport.

       Read each frame via rAF; the chapter root's CSS rules consume
       these variables directly so the wipe + draw-on lerps with the
       user's actual scroll position rather than playing a fixed-
       duration transition the moment the chapter becomes data-visible.

       Skipped on the variant pages that omit the ch2BodyPhase prop. */
    useEffect(() => {
        if (!ch2BodyPhase) return;
        let raf = 0;
        const tick = () => {
            const ph = ch2BodyPhase.current ?? 0;

            const smoothstep = (edge0: number, edge1: number, x: number) => {
                const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
                return t * t * (3 - 2 * t);
            };

            // Reveal windows for the chapter content. With the
            // chapter now sized to 240svh, ch2BodyPhase advances
            // much more gradually per pixel of scroll, so each
            // band can be wider without dragging.
            //
            //   --ch2-content-reveal  nameplate          0.18 → 0.32
            //   --ch2-body-reveal     body GLB opacity   0.30 → 0.55
            //                                 fade-out   0.85 → 0.95
            //   --ch2-zones-reveal    zone rail callouts 0.40 → 0.62
            //                                 fade-out   0.85 → 0.95
            const contentReveal = smoothstep(0.18, 0.32, ph);
            const bodyIn = smoothstep(0.30, 0.55, ph);
            const bodyOut = 1 - smoothstep(0.85, 0.95, ph);
            const bodyReveal = bodyIn * bodyOut;
            const zonesIn = smoothstep(0.40, 0.62, ph);
            const zonesOut = 1 - smoothstep(0.85, 0.95, ph);
            const zonesReveal = zonesIn * zonesOut;

            const el = chapterRef.current;
            if (el) {
                el.style.setProperty("--ch2-content-reveal", String(contentReveal));
                el.style.setProperty("--ch2-body-reveal", String(bodyReveal));
                el.style.setProperty("--ch2-zones-reveal", String(zonesReveal));
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [ch2BodyPhase, chapterRef]);

    return (
        <div
            id="try-on"
            className={`${styles.chapter} ${styles.chapter2}`}
            ref={chapterRef}
            data-visible={isVisible ? "1" : "0"}
            data-ch2-scroll-driven={ch2BodyPhase ? "1" : "0"}
            style={{ "--reveal-progress": Math.min(1, progress * 2) } as React.CSSProperties}
        >
            {/* Bottom-left nameplate — chapter title + active zone label.
                Mirrors Ch1's nameplate character; fills the same corner
                slot. Slide-in is scroll-driven by --ch2-content-reveal
                (0 → 1 across ph 0.30 → 0.55), so it lands AFTER the
                grid has settled rather than racing it on entry. */}
            <div className={styles.nameplate} aria-live="polite">
                <span className={styles.nameplateChapter}>Глава 02</span>
                <span className={styles.nameplateRule} aria-hidden="true" />
                <span className={styles.nameplateHeading}>ПРИМЕРЬ</span>
                <span className={styles.nameplateSubhead}>Где встанет?</span>
                <span className={styles.nameplateZoneLabel}>{activeLabel}</span>
            </div>

            {/* 3D body GLB rotating in from the right (NFS Carbon
                character intro vocabulary). Lives in its own R3F
                canvas because the main WireframeRoom canvas is
                occluded by the opaque 2D grid that takes over Ch2.
                Entry tied to ch2BodyPhase 0.78 → 0.92. */}
            {ch2BodyPhase ? <BodyModelGLB ch2BodyPhase={ch2BodyPhase} /> : null}

            {/* Vertical zone rail — right edge, mirrors Ch1's rolodex
                character. Each zone is a labeled tick; clicking advances
                the wireframe-bust active anchor. */}
            <div className={styles.zoneRail} aria-label="Зоны пирсинга">
                <div className={styles.zoneRailList}>
                    {BODY_AREAS.map((area, i) => {
                        const isActive = area.id === activeArea;
                        return (
                            <button
                                key={area.id}
                                type="button"
                                className={styles.zoneRailItem}
                                data-active={isActive ? "true" : "false"}
                                onClick={() => onAreaChange?.(area.id)}
                                aria-pressed={isActive ? "true" : "false"}
                                aria-label={area.label}
                            >
                                <span className={styles.zoneRailTick} aria-hidden="true" />
                                <span className={styles.zoneRailIndex}>
                                    {String(i + 1).padStart(2, "0")}
                                </span>
                                <span className={styles.zoneRailLabel}>{area.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export { BODY_AREAS };
