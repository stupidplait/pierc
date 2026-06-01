"use client";

import { forwardRef } from "react";

/**
 * Chapter 3 intro — pure 100svh scroll spacer. Mirrors Ch2Intro.
 *
 * No DOM content. The visible payload is the floating ЗАБРОНИРУЙ
 * title rendered inside WireframeRoom's R3F canvas, driven by
 * `ch3TitlePhase` which LandingShell computes from this section's
 * viewport position.
 *
 * Phase contract (consumed by AnimatedReserveText in WireframeRoom):
 *   slide-in:   ch3TitlePhase 0.25 → 0.42
 *   full vis:   ch3TitlePhase 0.42 → 0.58
 *   slide-out:  ch3TitlePhase 0.58 → 0.75
 *
 * Design intent: ЗАБРОНИРУЙ sits on the floor in accent (pink) instead
 * of luminous, signalling the conversion moment — eye reads accent =
 * action. The camera holds at the Ch2 final pose (looking straight
 * down at the floor) so the floor stage is shared with ПРИМЕРЬ but
 * never simultaneously visible thanks to the section-snap pacing.
 */
const Ch3Intro = forwardRef<HTMLElement>(function Ch3Intro(_, ref) {
    return (
        <section
            ref={ref}
            data-surface="light"
            aria-hidden="true"
            className="relative h-[100svh] w-full pointer-events-none"
        />
    );
});

export default Ch3Intro;
