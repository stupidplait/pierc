"use client";

import { m, useScroll, useTransform } from "framer-motion";
import type { RefObject } from "react";

/**
 * Ch2InfoPanel — left-side text overlay during Chapter 2.
 *
 * Slides in from the left edge with the same straight-rails motion
 * as the body slides in from the right, on opposite axes. Two parallel
 * tracks meeting toward the centre — they do NOT overlap because the
 * body holds at off-centre-right and the panel holds at off-centre-left.
 *
 * Sticky-positioned inside Chapter 2's 200svh section so the panel
 * stays in viewport throughout the scroll-through, with content driven
 * by the section's scrollYProgress.
 *
 * Animation timing (mirrors Ch2BodyModel):
 *   chapter2Phase 0.10 → 0.55   linear slide from off-screen left
 *   chapter2Phase 0.55 → 0.70   eased settle from overshoot to anchor
 *   chapter2Phase 0.70+         hold
 */
export function Ch2InfoPanel({
    chapter2Ref,
}: {
    chapter2Ref: RefObject<HTMLElement | null>;
}) {
    const { scrollYProgress } = useScroll({
        target: chapter2Ref,
        offset: ["start start", "end end"],
    });

    // The body uses chapter2Phase = -rect.top / vh which ramps 0 → 1
    // across the user's first 1vh of in-section scroll. useScroll's
    // ["start start", "end end"] offset over a 200svh section ramps
    // 0 → 1 across the same scroll range (factor of 2 cancels out
    // because section is 2× viewport tall).
    //
    // Slide windows match the body's: 0.10 → 0.55 (linear slide),
    // 0.55 → 0.70 (settle from overshoot back to final).
    const opacity = useTransform(scrollYProgress, [0.05, 0.20, 1.0], [0, 1, 1]);
    const x = useTransform(
        scrollYProgress,
        [0.10, 0.55, 0.70, 1.0],
        ["-100%", "8%", "0%", "0%"], // off-screen left → past final → final → locked
    );

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none sticky top-0 h-svh w-full
                       flex items-center justify-start
                       px-[clamp(24px,4vw,64px)] z-[3]"
        >
            <m.div
                style={{ opacity, x }}
                className="max-w-[clamp(260px,28vw,380px)] flex flex-col gap-3 text-[#1a1a1a]"
            >
                <span className="font-mono text-[11px] tracking-[0.22em] uppercase text-[#1a1a1a]/55">
                    Точка
                </span>
                <h3 className="font-display text-[clamp(36px,4vw,56px)] font-bold leading-[1.05] tracking-[-0.01em]">
                    Левая&nbsp;мочка
                </h3>
                <span
                    aria-hidden="true"
                    className="block w-[28px] h-px bg-[#1a1a1a]/30"
                />
                <p className="font-sans text-[clamp(13px,1.1vw,15px)] leading-[1.5] text-[#1a1a1a]/70 max-w-[28ch]">
                    Самое популярное место — большой выбор украшений, заживление 6–8 недель.
                </p>
                <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-[#1a1a1a]/45 mt-1">
                    18G&nbsp;·&nbsp;1.0&nbsp;мм
                </span>
            </m.div>
        </div>
    );
}
