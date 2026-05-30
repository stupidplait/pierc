"use client";

import { forwardRef } from "react";

/**
 * Chapter 2 intro — pure 100svh scroll spacer. Mirrors ChooseIntro.
 *
 * No DOM content. The visible payload is the floating ПРИМЕРЬ title
 * rendered inside WireframeRoom's R3F canvas, driven by `ch2TitlePhase`
 * which LandingShell computes from this section's viewport position.
 *
 * Phase contract (consumed by AnimatedPrimerText in WireframeRoom):
 *   slide-in:   ch2TitlePhase 0.00 → 0.20
 *   hold:       ch2TitlePhase 0.20 → 0.70
 *   slide-out:  ch2TitlePhase 0.70 → 1.00
 */
const Ch2Intro = forwardRef<HTMLElement>(function Ch2Intro(_, ref) {
    return (
        <section
            ref={ref}
            aria-hidden="true"
            className="relative h-[100svh] w-full pointer-events-none"
        />
    );
});

export default Ch2Intro;
