"use client";

import { useEffect, useRef, useState } from "react";
import { markIntroSeen, useIntroSeen } from "@/lib/landing/intro-seen";

const MIN_DISPLAY_MS = 4400;
const SKIP_GRACE_MS = 800;
const DISMISS_DURATION_MS = 600;

export default function Preloader({
    ready,
    onDismissStart,
}: {
    ready: boolean;
    onDismissStart?: () => void;
}) {
    // Already played this session → skip the artificial minimum display and
    // dismiss as soon as the scene is ready. First visit keeps the full draw.
    const introSeen = useIntroSeen();
    const [minTimePassed, setMinTimePassed] = useState(false);
    const [canSkip, setCanSkip] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const dismissFired = useRef(false);

    useEffect(() => {
        if (introSeen) return;
        const id = setTimeout(() => setMinTimePassed(true), MIN_DISPLAY_MS);
        return () => clearTimeout(id);
    }, [introSeen]);

    useEffect(() => {
        const id = setTimeout(() => setCanSkip(true), SKIP_GRACE_MS);
        return () => clearTimeout(id);
    }, []);

    const shouldHide = ready && (minTimePassed || introSeen);

    useEffect(() => {
        const el = document.documentElement;
        if (!shouldHide) {
            el.classList.add("preloader-active");
        } else {
            el.classList.remove("preloader-active");
        }
        return () => el.classList.remove("preloader-active");
    }, [shouldHide]);

    useEffect(() => {
        if (!shouldHide || dismissFired.current) return;
        dismissFired.current = true;
        markIntroSeen();
        onDismissStart?.();
    }, [shouldHide, onDismissStart]);

    useEffect(() => {
        if (!shouldHide) return;
        const id = setTimeout(() => setDismissed(true), DISMISS_DURATION_MS);
        return () => clearTimeout(id);
    }, [shouldHide]);

    const handleSkip = () => {
        if (!canSkip) return;
        setMinTimePassed(true);
    };

    if (dismissed) return null;

    return (
        <div
            inert={!shouldHide || undefined}
            data-hidden={shouldHide ? "1" : "0"}
            data-can-skip={canSkip ? "1" : "0"}
            onClick={handleSkip}
            className="fixed inset-0 z-50 bg-bg pointer-events-auto opacity-100 cursor-default data-[hidden=1]:opacity-0 data-[hidden=1]:pointer-events-none data-[can-skip=1]:cursor-pointer transition-opacity duration-500 ease-out"
        >
            <div role="status" aria-live="polite" className="sr-only">
                {shouldHide ? "Загрузка завершена" : "Загрузка"}
            </div>

            <CornerBracket pos="tl" />
            <CornerBracket pos="tr" />
            <CornerBracket pos="bl" />
            <CornerBracket pos="br" />

            <div className="flex h-full w-full items-center justify-center px-4">
                <PreloaderLogo />
            </div>
        </div>
    );
}

function CornerBracket({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
    const placement = {
        tl: "top-10 left-10 border-t border-l",
        tr: "top-10 right-10 border-t border-r",
        bl: "bottom-10 left-10 border-b border-l",
        br: "bottom-10 right-10 border-b border-r",
    }[pos];
    return (
        <span
            aria-hidden="true"
            className={`absolute h-8 w-8 border-ink/25 ${placement}`}
        />
    );
}

function PreloaderLogo() {
    const fontStack = "var(--font-display), system-ui, sans-serif";
    const fontSize = 240;
    const letterSpacing = 24;
    const fontWeight = 900;
    // Stroke colour follows the themed ink so the draw-in is legible on the
    // light preloader background too (was a baked near-white that vanished on
    // white). Opacity carries the tinted-base vs bright-draw contrast.
    const tintedOpacity = 0.18;
    const brightOpacity = 0.96;
    const dasharray = 5600;

    return (
        <svg
            viewBox="0 0 2000 280"
            preserveAspectRatio="xMidYMid meet"
            overflow="visible"
            className="block h-auto w-[min(96vw,2100px)]"
            aria-hidden="true"
        >
            <text
                x="1000"
                y="205"
                textAnchor="middle"
                fontFamily={fontStack}
                fontSize={fontSize}
                fontWeight={fontWeight}
                letterSpacing={letterSpacing}
                fill="none"
                strokeWidth="1.8"
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ stroke: "var(--ink)", strokeOpacity: tintedOpacity }}
            >
                PIERCERKZN
            </text>

            <text
                x="1000"
                y="205"
                textAnchor="middle"
                fontFamily={fontStack}
                fontSize={fontSize}
                fontWeight={fontWeight}
                letterSpacing={letterSpacing}
                fill="none"
                strokeWidth="1.8"
                strokeDasharray={dasharray}
                strokeDashoffset={dasharray}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{
                    stroke: "var(--ink)",
                    strokeOpacity: brightOpacity,
                    animation: "preloaderDraw 4s linear forwards",
                }}
            >
                PIERCERKZN
            </text>
        </svg>
    );
}
