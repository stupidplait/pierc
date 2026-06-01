"use client";

import { forwardRef, useImperativeHandle, useRef, type Ref } from "react";
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
interface Chapter2Props {
    /** Section-snap anchor placed at the section midpoint — see the
     *  marker comment in the JSX for why snap targets the middle, not
     *  the top. */
    snapAnchorRef?: Ref<HTMLDivElement>;
}

const Chapter2 = forwardRef<HTMLElement, Chapter2Props>(function Chapter2(
    { snapAnchorRef },
    externalRef,
) {
    const localRef = useRef<HTMLElement | null>(null);
    useImperativeHandle(
        externalRef,
        () => localRef.current as HTMLElement,
    );

    return (
        <section
            ref={localRef}
            data-surface="light"
            aria-hidden="true"
            className="relative h-[200svh] w-full pointer-events-none"
        >
            {/* Section-snap anchor. Chapter 2 is 200svh but composes its
                full frame — grid + body at chapter2Phase = 1, info panel
                slid in and still pinned — only at its MIDPOINT (rect.top
                = -100svh). Snapping to the section *top* would land on the
                empty transition trough (phase 0, panel off-screen), and
                with no anchor in between, the snap loop pulls anyone
                resting mid-section to the nearest section top — Chapter
                2's own top or Chapter 3's — so the chapter could never
                hold. This zero-size marker at top: 50% (= 100svh of the
                200svh section) gives the snap loop the midpoint as
                Chapter 2's stop. */}
            <div
                ref={snapAnchorRef}
                aria-hidden="true"
                className="absolute left-0 top-1/2 h-px w-px"
            />
            <Ch2InfoPanel chapter2Ref={localRef} />
        </section>
    );
});

export default Chapter2;
