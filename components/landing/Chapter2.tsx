"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { Ch2InfoPanel } from "./Ch2InfoPanel";

/**
 * Chapter 2 — 200svh scroll spacer hosting:
 *   1. The 3D grid + body, rendered inside WireframeRoom's canvas
 *      (driven by chapter2Phase computed in LandingShell).
 *   2. A sticky-positioned text panel on the left side (DOM, on top
 *      of the canvas). Slides in from the left mirroring the body's
 *      slide-in from the right — opposite-direction parallel rails.
 *
 * The 200svh height gives the user 1 viewport of scroll real-estate
 * during which chapter2Phase ramps 0 → 1, driving every Chapter 2
 * animation in lockstep.
 */
const Chapter2 = forwardRef<HTMLElement>(function Chapter2(_, externalRef) {
    const localRef = useRef<HTMLElement | null>(null);
    useImperativeHandle(
        externalRef,
        () => localRef.current as HTMLElement,
    );

    return (
        <section
            ref={localRef}
            aria-hidden="true"
            className="relative h-[200svh] w-full pointer-events-none"
        >
            <Ch2InfoPanel chapter2Ref={localRef} />
        </section>
    );
});

export default Chapter2;
