"use client";

import { useEffect, useRef, useState } from "react";
import {
    AnimatePresence,
    m,
    useReducedMotion,
    useScroll,
    useSpring,
    useTransform,
} from "framer-motion";
import { useScrollReveal } from "@/lib/hooks/useScrollReveal";
import { useJewelrySwap } from "./hooks/useJewelrySwap";

/* Roster aligned 1:1 with PIECE_GEOMETRIES in wireframe-room/geometry.ts — index 0
   is the hero floating torus ring, so what the user sees in hero IS the
   first carousel item once they scroll into Chapter 1. */
const ROSTER = [
    { id: "ring",          name: "Кольцо",       material: "Хирургическая сталь",  gauge: "18G", weight: "1.0г", style: "Минимализм",  price: "₽3,200" },
    { id: "cross-earring", name: "Крест-серьга", material: "Хирургическая сталь",  gauge: "18G", weight: "1.2г", style: "Готика",      price: "₽2,800" },
    { id: "labret",        name: "Лабрет",       material: "Титан ASTM F136",      gauge: "16G", weight: "0.8г", style: "Минимализм",  price: "₽1,900" },
    { id: "stud-earring",  name: "Пусета",       material: "Титан с цирконием",    gauge: "20G", weight: "0.6г", style: "Элегант",     price: "₽4,500" },
    { id: "barbell",       name: "Штанга",       material: "Титан ASTM F136",      gauge: "14G", weight: "1.8г", style: "Индастриал",  price: "₽2,400" },
    { id: "septum-ring",   name: "Септум",       material: "Хирургическая сталь",  gauge: "16G", weight: "1.1г", style: "Этника",      price: "₽3,600" },
];

interface JewelryShowcaseProps {
    chapterRef: React.RefObject<HTMLDivElement | null>;
    onJewelryChange?: (index: number) => void;
    onNameChange?: (name: string) => void;
    activeJewelry: number;
    transitionProgress: React.RefObject<number>;
    swapDirection: React.RefObject<number>;
    onTransitionStart?: () => void;
    onTransitionEnd?: () => void;
}

const SLIDE_TRANSITION = { type: "spring" as const, stiffness: 420, damping: 38, mass: 0.8 };
const INSTANT_TRANSITION = { duration: 0 };
const HALO_EASE = [0.16, 1, 0.3, 1] as const;
const SLIDE_DISTANCE = 28;

const activeVariants = {
    enter: (dir: 1 | -1) => ({ opacity: 0, y: dir * SLIDE_DISTANCE }),
    rest: { opacity: 1, y: 0 },
    exit: (dir: 1 | -1) => ({ opacity: 0, y: dir * -SLIDE_DISTANCE }),
};

export default function JewelryShowcase({
    chapterRef,
    onJewelryChange,
    onNameChange,
    activeJewelry,
    transitionProgress,
    swapDirection,
    onTransitionStart,
    onTransitionEnd,
}: JewelryShowcaseProps) {
    const { isVisible } = useScrollReveal(chapterRef);
    const prefersReducedMotion = useReducedMotion();
    const transition = prefersReducedMotion ? INSTANT_TRANSITION : SLIDE_TRANSITION;

    const swipeThreshold = 100;
    const current = ROSTER[activeJewelry];

    const handleJewelryChange = (next: number) => {
        onJewelryChange?.(next);
        onNameChange?.(ROSTER[next].name);
        onTransitionEnd?.();
    };

    const { triggerSwap, goToIndex } = useJewelrySwap({
        activeJewelry,
        onJewelryChange: handleJewelryChange,
        transitionProgressRef: transitionProgress,
        swapDirectionRef: swapDirection,
    });

    const swipeRef = useRef(triggerSwap);
    useEffect(() => {
        swipeRef.current = triggerSwap;
    });

    const wrappedTriggerSwap = (direction: number) => {
        onTransitionStart?.();
        swipeRef.current(direction);
    };

    const prevActive = useRef(activeJewelry);
    const [direction, setDirection] = useState<1 | -1>(1);
    useEffect(() => {
        if (prevActive.current === activeJewelry) return;
        const total = ROSTER.length;
        const forward = (activeJewelry - prevActive.current + total) % total;
        const backward = (prevActive.current - activeJewelry + total) % total;
        setDirection(forward <= backward ? 1 : -1);
        prevActive.current = activeJewelry;
    }, [activeJewelry]);

    const rolodexRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const el = rolodexRef.current;
        if (!el) return;
        let lockUntil = 0;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const now = Date.now();
            if (now < lockUntil) return;
            if (Math.abs(e.deltaY) < 4) return;
            lockUntil = now + 350;
            wrappedTriggerSwap(e.deltaY > 0 ? 1 : -1);
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!isVisible) return;
        const el = chapterRef.current;
        if (!el) return;

        let startX = 0, startY = 0;
        let swiping = false;
        let directionLocked = false;
        let isHorizontal = false;

        const onPointerDown = (e: PointerEvent) => {
            if ((e.target as HTMLElement)?.closest("button")) return;
            swiping = true; directionLocked = false; isHorizontal = false;
            startX = e.clientX; startY = e.clientY;
        };
        const onPointerMove = (e: PointerEvent) => {
            if (!swiping) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (!directionLocked && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
                directionLocked = true;
                isHorizontal = Math.abs(dx) > Math.abs(dy);
            }
            if (directionLocked && isHorizontal && Math.abs(dx) > swipeThreshold) {
                onTransitionStart?.();
                swipeRef.current(dx < 0 ? 1 : -1);
                swiping = false;
            }
        };
        const onPointerUp = () => { swiping = false; };

        const onTouchStart = (e: TouchEvent) => {
            if ((e.target as HTMLElement)?.closest("button")) return;
            swiping = true; directionLocked = false; isHorizontal = false;
            startX = e.touches[0].clientX; startY = e.touches[0].clientY;
        };
        const onTouchMove = (e: TouchEvent) => {
            if (!swiping) return;
            const dx = e.touches[0].clientX - startX;
            const dy = e.touches[0].clientY - startY;
            if (!directionLocked && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
                directionLocked = true;
                isHorizontal = Math.abs(dx) > Math.abs(dy);
            }
            if (directionLocked && isHorizontal && Math.abs(dx) > swipeThreshold) {
                onTransitionStart?.();
                swipeRef.current(dx < 0 ? 1 : -1);
                swiping = false;
            }
        };
        const onTouchEnd = () => { swiping = false; };

        el.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        el.addEventListener("touchstart", onTouchStart, { passive: true });
        window.addEventListener("touchmove", onTouchMove, { passive: true });
        window.addEventListener("touchend", onTouchEnd);

        return () => {
            el.removeEventListener("pointerdown", onPointerDown);
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            el.removeEventListener("touchstart", onTouchStart);
            window.removeEventListener("touchmove", onTouchMove);
            window.removeEventListener("touchend", onTouchEnd);
        };
    }, [chapterRef, isVisible, onTransitionStart]);

    useEffect(() => {
        if (!isVisible) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft")  { onTransitionStart?.(); swipeRef.current(-1); }
            if (e.key === "ArrowRight") { onTransitionStart?.(); swipeRef.current(1); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isVisible, onTransitionStart]);

    const total = ROSTER.length;
    const prevIdx = (activeJewelry - 1 + total) % total;
    const nextIdx = (activeJewelry + 1) % total;

    /* Scroll-driven entrance — uses framer-motion's useScroll hook.
       Two-stage offset covers BOTH entry AND exit:
         - "start end"   ⇒ progress 0  (section just below viewport)
         - "end start"   ⇒ progress 1  (section fully past, top side)
       So progress ramps 0 → 1 across 2× viewport heights of scroll,
       with the section filling viewport at progress = 0.5.

       Opacity multi-point transform: fades in 0 → 0.4, holds 0.4 → 0.6,
       fades out 0.6 → 1.0. Ensures the UI is invisible BOTH before
       entering AND after leaving Chapter 1, so when it's fixed-positioned
       it doesn't bleed into adjacent sections.

       Scale ramps subtly during entry only.

       Smoothing via a very tight spring (stiffness 600, damping 45,
       mass 0.4 — time constant ~13 ms = under one frame). */
    const { scrollYProgress } = useScroll({
        target: chapterRef,
        offset: ["start end", "end start"],
    });
    const smoothProgress = useSpring(scrollYProgress, {
        stiffness: 600,
        damping: 45,
        mass: 0.4,
        restDelta: 0.001,
    });

    const nameplateOpacity = useTransform(
        smoothProgress,
        [0.25, 0.4, 0.6, 0.85],
        [0, 1, 1, 0],
    );
    const nameplateScale = useTransform(
        smoothProgress,
        [0.25, 0.5, 1.0],
        [0.96, 1, 1],
    );
    const rolodexOpacity = useTransform(
        smoothProgress,
        [0.25, 0.4, 0.6, 0.85],
        [0, 1, 1, 0],
    );
    const rolodexScale = useTransform(
        smoothProgress,
        [0.25, 0.5, 1.0],
        [0.96, 1, 1],
    );

    /* Pointer-events follow opacity — disable interactivity when UI is
       invisible so the rolodex buttons can't be triggered while user is
       outside Chapter 1 (since the elements stay mounted via fixed
       positioning, they remain in the DOM throughout). */
    const interactivity = useTransform(smoothProgress, (v) =>
        v > 0.3 && v < 0.75 ? "auto" : "none",
    );

    const haloMotion = {
        initial: { opacity: 0, y: 4 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -4 },
        transition: { duration: 0.28, ease: HALO_EASE },
    };

    return (
        <div
            id="showcase"
            ref={chapterRef}
            data-visible={isVisible ? "1" : "0"}
            className="relative grid min-h-[100svh] grid-cols-1 grid-rows-[auto_1fr_auto] items-center justify-items-center pointer-events-auto touch-manipulation
                       pt-[clamp(24px,4vw,64px)] px-[clamp(24px,4vw,64px)] pb-[clamp(16px,3vw,40px)]"
        >
            {/* Instrument nameplate — bottom-left museum-caption block.
                Surfaces the active piece's specs (material, gauge·weight, price). */}
            <m.div
                aria-live="polite"
                style={{
                    opacity: nameplateOpacity,
                    scale: nameplateScale,
                    pointerEvents: interactivity,
                }}
                className="fixed z-[4] flex flex-col items-start gap-2 pointer-events-none
                           bottom-[clamp(28px,5vh,56px)] left-[clamp(24px,4vw,64px)]
                           max-w-[clamp(180px,22vw,260px)]
                           max-[480px]:left-1/2 max-[480px]:right-auto max-[480px]:items-center max-[480px]:text-center max-[480px]:max-w-[min(80vw,280px)] max-[480px]:-translate-x-1/2"
            >
                <span className="font-sans text-[11px] font-medium uppercase tracking-[0.18em] text-ink/70 leading-tight">
                    {current.material}
                </span>
                <span className="block w-[22px] h-px bg-ink/30" aria-hidden="true" />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55 tabular-nums">
                    {current.gauge} · {current.weight}
                </span>
                <span className="font-mono font-medium tracking-[0.1em] text-accent tabular-nums mt-0.5 text-[clamp(14px,1.3vw,17px)]">
                    {current.price}
                </span>
            </m.div>

            {/* Rolodex picker — right-edge strip with rail (column of dots) + sliding window.
                Wrapper handles absolute positioning + responsive layout; inner m.div
                handles the data-visible reveal animation (opacity + x-translate). */}
            <div
                className="fixed z-[3] w-[240px] -translate-y-1/2 right-[clamp(20px,3vw,56px)] top-1/2
                           max-[880px]:w-[220px]
                           max-[480px]:right-1/2 max-[480px]:top-auto max-[480px]:bottom-[130px] max-[480px]:translate-x-1/2 max-[480px]:translate-y-0"
            >
                <m.div
                    ref={rolodexRef}
                    aria-label="Список украшений"
                    style={{
                        opacity: rolodexOpacity,
                        scale: rolodexScale,
                        pointerEvents: interactivity,
                    }}
                    className="grid grid-cols-[auto_1fr] items-center gap-x-4 pointer-events-auto"
                >
                    {/* Rail — vertical strip of 6 hit-area buttons */}
                    <div className="flex flex-col">
                        {ROSTER.map((item, i) => (
                            <button
                                key={item.id}
                                type="button"
                                data-active={i === activeJewelry ? "true" : "false"}
                                onClick={() => goToIndex(i)}
                                aria-label={item.name}
                                className="group relative flex w-6 h-7 items-center justify-center bg-transparent border-0 p-0 cursor-pointer touch-manipulation
                                           min-[881px]:w-4 min-[881px]:h-6
                                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                            >
                                <span
                                    aria-hidden="true"
                                    className="block w-[3px] h-[14px] rounded-[1px] bg-accent/60 transition-all duration-300 ease-out
                                               group-hover:bg-accent group-hover:h-[20px] group-hover:w-[4px]
                                               group-data-[active=true]:h-[22px] group-data-[active=true]:w-[4px] group-data-[active=true]:bg-accent"
                                />
                                {/* Hover label — outer span owns vertical centering (right-full + -translate-y-1/2),
                                    inner span owns the slide-in transform. Split because Tailwind v4 emits a single
                                    `translate:` declaration per element, so combining -translate-y-1/2 with
                                    translate-x-1 on the same span would break the centering. */}
                                <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-3 z-10"
                                >
                                    <span
                                        className="block whitespace-nowrap font-sans text-[10px] uppercase tracking-[0.14em] text-accent
                                                   opacity-0 translate-x-1
                                                   transition-[opacity,transform] duration-300 ease-out
                                                   group-hover:opacity-100 group-hover:translate-x-0
                                                   group-data-[active=true]:opacity-0"
                                    >
                                        {item.name}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Window — fixed 132px tall (3 rows × 40px + 12px margin), overflow hidden */}
                    <div className="relative flex flex-col justify-center h-[132px] max-[880px]:h-[126px] overflow-hidden">
                        {/* Prev halo */}
                        <button
                            type="button"
                            onClick={() => wrappedTriggerSwap(-1)}
                            aria-label="Предыдущее"
                            className="flex flex-col items-end justify-center h-10 max-[880px]:h-[38px] px-1 bg-transparent border-0 cursor-pointer text-right text-ink/55 hover:text-ink/80 transition-colors
                                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                        >
                            <AnimatePresence mode="popLayout" initial={false}>
                                <m.span
                                    key={`prev-num-${prevIdx}`}
                                    {...haloMotion}
                                    className="font-sans text-[9px] font-medium tracking-[0.18em] text-accent opacity-50"
                                >
                                    {String(prevIdx + 1).padStart(2, "0")}
                                </m.span>
                            </AnimatePresence>
                            <AnimatePresence mode="popLayout" initial={false}>
                                <m.span
                                    key={`prev-name-${prevIdx}`}
                                    {...haloMotion}
                                    className="font-sans text-[11px] tracking-[0.06em] uppercase whitespace-nowrap overflow-hidden text-ellipsis max-w-full"
                                >
                                    {ROSTER[prevIdx].name}
                                </m.span>
                            </AnimatePresence>
                        </button>

                        {/* Active row */}
                        <AnimatePresence initial={false} mode="popLayout" custom={direction}>
                            <m.div
                                key={`active-${activeJewelry}`}
                                custom={direction}
                                variants={activeVariants}
                                initial="enter"
                                animate="rest"
                                exit="exit"
                                transition={transition}
                                className="relative flex flex-col items-end justify-center gap-0.5 h-10 max-[880px]:h-[38px] pr-3 ml-auto text-right will-change-transform"
                            >
                                <span className="font-sans text-[9px] font-semibold tracking-[0.18em] text-accent">
                                    {String(activeJewelry + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
                                </span>
                                <span className="font-sans font-extrabold uppercase tracking-[0.02em] text-ink whitespace-nowrap overflow-hidden text-ellipsis max-w-full text-[clamp(13px,1.2vw,17px)] max-[880px]:text-[12px]">
                                    {current.name}
                                </span>
                                <span
                                    aria-hidden="true"
                                    className="absolute right-[-7px] top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-accent"
                                />
                            </m.div>
                        </AnimatePresence>

                        {/* Next halo */}
                        <button
                            type="button"
                            onClick={() => wrappedTriggerSwap(1)}
                            aria-label="Следующее"
                            className="flex flex-col items-end justify-center h-10 max-[880px]:h-[38px] px-1 bg-transparent border-0 cursor-pointer text-right text-ink/55 hover:text-ink/80 transition-colors
                                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                        >
                            <AnimatePresence mode="popLayout" initial={false}>
                                <m.span
                                    key={`next-num-${nextIdx}`}
                                    {...haloMotion}
                                    className="font-sans text-[9px] font-medium tracking-[0.18em] text-accent opacity-50"
                                >
                                    {String(nextIdx + 1).padStart(2, "0")}
                                </m.span>
                            </AnimatePresence>
                            <AnimatePresence mode="popLayout" initial={false}>
                                <m.span
                                    key={`next-name-${nextIdx}`}
                                    {...haloMotion}
                                    className="font-sans text-[11px] tracking-[0.06em] uppercase whitespace-nowrap overflow-hidden text-ellipsis max-w-full"
                                >
                                    {ROSTER[nextIdx].name}
                                </m.span>
                            </AnimatePresence>
                        </button>
                    </div>
                </m.div>
            </div>
        </div>
    );
}

export { ROSTER as JEWELRY_ITEMS };
