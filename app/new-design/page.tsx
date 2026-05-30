"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import WireframeRoom from "@/components/scene/WireframeRoom";
import Preloader from "@/components/scene/Preloader";
import HowItWorks from "./HowItWorks";
import ChooseIntro from "./ChooseIntro";
import Ch2GridOverlay from "./Ch2GridOverlay";
import Epilogue from "./Epilogue";
import { SiteFooter } from "@/components/SiteFooter";
import { SITE } from "@/lib/site";
import { SCROLL_EVENT, scrollToSection } from "@/lib/scroll";

export default function NewDesignPage() {
    const heroRef = useRef<HTMLElement | null>(null);
    const stageRef = useRef<HTMLDivElement | null>(null);
    const mouseRef = useRef({ x: 0, y: 0 });
    const pointerActiveRef = useRef(true);
    const [sceneReady, setSceneReady] = useState(false);
    const [revealed, setRevealed] = useState(false);

    /* ── Multi-chapter scroll tracking ── */
    const chooseRef = useRef<HTMLDivElement | null>(null);
    const chapter1Ref = useRef<HTMLDivElement | null>(null);
    const ch2DescentRef = useRef<HTMLDivElement | null>(null);
    const ch2TitleRef = useRef<HTMLDivElement | null>(null);
    const chapter2Ref = useRef<HTMLDivElement | null>(null);
    const chapter3Ref = useRef<HTMLDivElement | null>(null);

    // scrollPhase: 0→1 as chapter 1 scrolls through viewport
    const scrollPhaseRef = useRef(0);
    // ch2DescentPhase: 0→1 across the Ch2Descent section's own 100vh.
    // Drives the multi-stage camera storyboard A→D (extra pull-back
    // → tilt-down → descend → settle). Stages 0.20/0.45/0.75/1.00.
    const ch2DescentPhaseRef = useRef(0);
    // ch2TitlePhase: 0→1 across the Ch2Title section's own 100vh.
    // Drives the floating ПРИМЕРЬ title (slide-in 0→0.20, hold
    // 0.20→0.70, slide-out 0.70→1.00) — mirrors ChooseIntro's role
    // for ВЫБЕРИ. Camera holds at stage-D values throughout.
    const ch2TitlePhaseRef = useRef(0);
    // ch2Phase (derived): combined descent+title phase mapped to
    // 0→1 across both sections so existing scene consumers (CameraDolly,
    // ChapterFade walls fade-out, BodyModel scale ramp, PinkRimLight)
    // keep their existing 0→0.5 storyboard / 0.5→1 held-floor contract.
    // Computed in readLayout as `descent * 0.5 + title * 0.5`.
    const ch2PhaseRef = useRef(0);
    // ch2BodyPhase: 0→1 across Ch2's own viewport (top → bottom of
    // chapter2). Drives the 2D-grid slide-up + Ch2 content reveal
    // (nameplate from left, body model from right with rotation).
    const ch2BodyPhaseRef = useRef(0);
    // Which chapter is most visible (for dot nav highlight)
    // Stays as state because HowItWorks dot nav needs DOM re-renders.
    const [activeChapter, setActiveChapter] = useState(0);
    // Also keep a ref mirror for WireframeRoom's useFrame (avoids re-renders)
    const activeChapterRef = useRef(0);

    // Mobile menu toggle
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Interactive state lifted to page level so WireframeRoom can react
    const [activeJewelry, setActiveJewelry] = useState(0);
    const [activeArea, setActiveArea] = useState("ear_left");
    // Jewelry display name — kept for HowItWorks chapter title
    const [jewelryName, setJewelryName] = useState("Cross Earring");

    // Shared transition progress (0 = idle, peaks at 1, returns to 0)
    const transitionProgress = useRef(0);

    // Swap direction: 1 = forward (right→left), -1 = backward (left→right)
    // Used by GlassPiece for directional slide during jewelry transitions.
    const swapDirection = useRef(1);

    // Scroll velocity (normalized 0-1) for reactive effects
    const scrollVelocityRef = useRef(0);

    // One-shot trigger for the settle bloom pulse — GlassPiece writes
    // a 1 here when the 1080° jewelry reveal completes; ProximityBloom
    // reads + clears it to fire a brief bloom-intensity pulse. Plumbed
    // through WireframeRoom so the two refs (writer + reader) share a
    // single trigger without a parent re-render.
    const settlePulseRef = useRef(0);

    // Smooth scroll refs
    const targetScroll = useRef(0);
    const currentScroll = useRef(0);
    const smoothRafId = useRef<number | undefined>(undefined);

    /**
     * Disable the global `scroll-behavior: smooth` rule (set in
     * `app/globals.css` for hash-anchor smoothness on the rest of
     * the site) for the duration of this page. The non-touch
     * smooth-scroll tick below calls `window.scrollTo()` every frame;
     * with native smooth-behavior enabled, each call would queue a
     * fresh browser animation that interrupts the previous one,
     * making the wheel feel dead. We restore the original value on
     * unmount so other routes keep their hash-anchor smoothness.
     */
    // useEffect(() => {
    //     const html = document.documentElement;
    //     const previous = html.style.scrollBehavior;
    //     html.style.scrollBehavior = "auto";
    //     return () => {
    //         html.style.scrollBehavior = previous;
    //     };
    // }, []);

    useEffect(() => {
        // Touch device detection — touch users get native scroll +
        // the existing swipe gestures, no wheel-hijack loop. Keep
        // their phase updates on a classic scroll-listener-driven
        // rAF readLayout. Non-touch users get the smooth-scroll tick
        // with readLayout called inline so phases update in lock-step
        // with the smoothed currentScroll.
        const isTouch =
            typeof window !== "undefined" &&
            ("ontouchstart" in window || navigator.maxTouchPoints > 0);

        const refs = [chapter1Ref, chapter2Ref, chapter3Ref];

        /* readLayout — derives every chapter phase + activeChapter from
           the current scroll position. Pure layout reads + ref writes;
           no React state set unless the active chapter actually changes.

           sourceScroll is the smoothed scroll position we're showing
           the user this frame (currentScroll on non-touch, window.scrollY
           on touch). It's used for the activeChapter threshold; the
           phase calculations use getBoundingClientRect which is already
           viewport-relative (i.e. relative to whatever scroll position
           the browser currently has). After window.scrollTo is called
           in tick(), the layout boxes are synchronously updated, so
           getBoundingClientRect inside the same frame reflects the new
           position. This is the core of the lock-step fix — phases no
           longer trail currentScroll by one frame. */
        const readLayout = (sourceScroll: number) => {
            const vh = window.innerHeight;

            // scrollPhase ramps 0→1 across the full hero→Chapter-1
            // distance (heroSpacer + ChooseIntro = 2 viewports of scroll).
            const el1 = refs[0].current;
            if (el1) {
                const rect = el1.getBoundingClientRect();
                const raw = 1 - rect.top / (2 * vh);
                scrollPhaseRef.current = Math.max(0, Math.min(1, raw));
            }

            // ch2DescentPhase ramps 0→1 across the Ch2Descent section's
            // own 100vh.
            const descent = ch2DescentRef.current;
            if (descent) {
                const rectD = descent.getBoundingClientRect();
                const rawD = 1 - rectD.top / vh;
                ch2DescentPhaseRef.current = Math.max(0, Math.min(1, rawD));
            }

            // ch2TitlePhase ramps 0→1 across the Ch2Title section's own
            // 100vh.
            const title = ch2TitleRef.current;
            if (title) {
                const rectT = title.getBoundingClientRect();
                const rawT = 1 - rectT.top / vh;
                ch2TitlePhaseRef.current = Math.max(0, Math.min(1, rawT));
            }

            // Derived ch2Phase — combined descent + title.
            //   descent 0→1  ⇒  ch2Phase 0.0→0.5  (storyboard plays)
            //   title   0→1  ⇒  ch2Phase 0.5→1.0  (held floor, ПРИМЕРЬ)
            ch2PhaseRef.current = Math.min(
                1,
                ch2DescentPhaseRef.current * 0.5 + ch2TitlePhaseRef.current * 0.5
            );

            // ch2BodyPhase ramps 0→1 across Ch2's own viewport.
            const c2 = chapter2Ref.current;
            if (c2) {
                const rectC2 = c2.getBoundingClientRect();
                const rawB = -rectC2.top / vh;
                ch2BodyPhaseRef.current = Math.max(0, Math.min(1, rawB));
            }

            // Determine active chapter. Hero + ChooseIntro both stay
            // at ac=0. ac flips to 1 when user is mostly into Chapter 1.
            if (sourceScroll < vh * 1.5) {
                if (activeChapterRef.current !== 0) {
                    activeChapterRef.current = 0;
                    setActiveChapter(0);
                }
            } else {
                let best = 0;
                let bestDist = Infinity;
                refs.forEach((ref, i) => {
                    const el = ref.current;
                    if (!el) return;
                    const rect = el.getBoundingClientRect();
                    const center = rect.top + rect.height / 2;
                    const dist = Math.abs(center - vh / 2);
                    if (dist < bestDist) {
                        bestDist = dist;
                        best = i + 1;
                    }
                });
                if (activeChapterRef.current !== best) {
                    activeChapterRef.current = best;
                    setActiveChapter(best);
                }
            }
        };

        const getMaxScroll = () =>
            document.documentElement.scrollHeight - window.innerHeight;

        const getSectionTops = (): number[] => {
            // Document-relative section tops via getBoundingClientRect
            // + scrollY. Includes ChooseIntro / Ch2Descent / Ch2Title
            // so the user can rest on each transition section, not
            // just the chapter chapters. Ends with max-scroll so the
            // Epilogue + footer can be reached.
            const tops: number[] = [0];
            [
                chooseRef,
                chapter1Ref,
                ch2DescentRef,
                ch2TitleRef,
                chapter2Ref,
                chapter3Ref,
            ].forEach((ref) => {
                const el = ref.current;
                if (el) {
                    const rect = el.getBoundingClientRect();
                    tops.push(rect.top + window.scrollY);
                }
            });
            tops.push(getMaxScroll());
            // Sort numerically — getBoundingClientRect should already
            // return them in document order, but being explicit here
            // means the snap-hysteresis "currently inside" search is
            // robust against any future re-ordering.
            return tops.sort((a, b) => a - b);
        };

        // Custom event handler for programmatic scroll (nav links, hero
        // CTAs, chapter CTAs). Routes through the smooth loop on
        // non-touch; native scrollIntoView on touch.
        const onScrollEvent = (ev: Event) => {
            const detail = (ev as CustomEvent<{ id?: string }>).detail;
            const id = detail?.id;
            if (!id) return;
            const el = document.getElementById(id);
            if (!el) return;
            ev.preventDefault();
            if (isTouch) {
                el.scrollIntoView({ behavior: "smooth", block: "start" });
                return;
            }
            const max = getMaxScroll();
            const target = Math.max(0, Math.min(el.offsetTop, max));
            targetScroll.current = target;
            // Mark as snapped so the smooth loop uses SNAP_LAMBDA (faster
            // decay) for programmatic targets — feels confident, not
            // mushy on click.
            snappedTo = target;
            idleStart = 0;
        };
        window.addEventListener(SCROLL_EVENT, onScrollEvent);

        // Touch devices: native scroll + scroll-listener-driven readLayout.
        // Phases trail by 1 frame here, but native momentum is the
        // smoothing system on touch — adding our wheel-hijack on top
        // would fight gesture physics. The 1-frame trail is invisible
        // when the platform is doing the smoothing.
        if (isTouch) {
            let rafId: number | undefined;
            let scheduled = false;
            const onScroll = () => {
                if (scheduled) return;
                scheduled = true;
                rafId = requestAnimationFrame(() => {
                    scheduled = false;
                    readLayout(window.scrollY);
                });
            };
            window.addEventListener("scroll", onScroll, { passive: true });
            readLayout(window.scrollY);
            return () => {
                window.removeEventListener("scroll", onScroll);
                window.removeEventListener(SCROLL_EVENT, onScrollEvent);
                if (rafId !== undefined) cancelAnimationFrame(rafId);
            };
        }

        /* Non-touch path: smooth scroll tick.

           Tuning history. Original constants caused visible stepping
           under fast wheel input because:
             • WHEEL_DAMPING 0.4 + uncapped target meant a 20-event
               burst could push targetScroll hundreds of px ahead in
               <100ms, then SCROLL_LAMBDA 6 chased with dt-capped
               exp decay — uneven catch-up = staggered feel.
             • readLayout ran from a separate scroll listener,
               trailing currentScroll by 1 frame.
             • External-resync at 4px tripped mid-flight on every
               fast scroll, fighting the smooth loop.
             • Several useFrame consumers chained THREE.MathUtils.damp
               on top of phases that already lagged → double-smoothing
               surfaced as discrete steps.

           Fixes applied here:
             • SCROLL_LAMBDA 6 → 9, WHEEL_DAMPING 0.4 → 0.28.
             • Cap |targetScroll - currentScroll| ≤ TARGET_CAP_VH * vh
               so a fast burst can't push the target multiple chapters
               ahead.
             • External-resync threshold 4 → 16 px AND only when
               velocity < EXTERNAL_RESYNC_VELOCITY (i.e. smooth loop
               is near rest). Fast scrolling no longer trips it.
             • readLayout(currentScroll) called at the end of tick()
               so phases update in lock-step with the smoothed value.
             • Per-frame damp lambdas in WireframeRoom were bumped at
               the consumer side (CameraDolly, GlassPiece,
               AnimatedChooseText, AnimatedPrimerText) so any residual
               smoothing on top of phases is minimal.

           Snap hysteresis (Step 3 fix): the snap target picker now
           prefers the section the user is currently inside if their
           targetScroll is within HYSTERESIS_PX of it, falling back
           to absolute-nearest only when the user has clearly moved
           past that section's territory. This lets users rest on
           Ch2Descent / Ch2Title / Chapter 2 individually (the
           previous nearest-only logic ripped past whichever was
           closer to a midpoint between two adjacent 100vh sections).
        */
        const SCROLL_LAMBDA = 9;
        const SNAP_LAMBDA = 12;
        const WHEEL_DAMPING = 0.28;
        const SNAP_VELOCITY_THRESHOLD = 5;
        const SNAP_DELAY = 600;
        const TARGET_CAP_VH = 2;
        const EXTERNAL_RESYNC_PX = 16;
        const EXTERNAL_RESYNC_VELOCITY = 50;

        // Sync from current position
        targetScroll.current = window.scrollY;
        currentScroll.current = window.scrollY;
        let lastTime = performance.now();

        let idleStart = 0;
        let snappedTo = -1;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            targetScroll.current += e.deltaY * WHEEL_DAMPING;
            targetScroll.current = Math.max(0, Math.min(targetScroll.current, getMaxScroll()));

            // Cap target divergence — if a fast burst would push the
            // target more than TARGET_CAP_VH * vh ahead of where the
            // user's eye currently is, clamp it to that distance.
            // Prevents the smooth loop from having to traverse multiple
            // chapters in one settle (which is what produced the
            // "blow past Ch2Title and Chapter 2" feel).
            const cap = TARGET_CAP_VH * window.innerHeight;
            if (targetScroll.current - currentScroll.current > cap) {
                targetScroll.current = currentScroll.current + cap;
            } else if (currentScroll.current - targetScroll.current > cap) {
                targetScroll.current = currentScroll.current - cap;
            }
            idleStart = 0;
            snappedTo = -1;
        };

        const tick = () => {
            const now = performance.now();
            const dt = Math.min((now - lastTime) / 1000, 0.05);
            lastTime = now;

            // External-scroll resync. Only adopt window.scrollY as
            // authoritative when divergence is meaningful (≥ 16px,
            // not 4px) AND the smooth loop is near rest (velocity
            // < 50). The previous tight threshold tripped on every
            // fast scroll and fought the smooth loop.
            const externalScrollY = window.scrollY;
            const divergence = Math.abs(externalScrollY - currentScroll.current);
            const inflightVelocity = Math.abs(targetScroll.current - currentScroll.current);
            if (
                divergence > EXTERNAL_RESYNC_PX &&
                inflightVelocity < EXTERNAL_RESYNC_VELOCITY
            ) {
                currentScroll.current = externalScrollY;
                targetScroll.current = externalScrollY;
                snappedTo = -1;
                idleStart = 0;
            }

            const diff = targetScroll.current - currentScroll.current;
            const velocity = Math.abs(diff);

            // Idle + snap with hysteresis.
            if (velocity < SNAP_VELOCITY_THRESHOLD) {
                if (idleStart === 0) {
                    idleStart = now;
                } else if (now - idleStart > SNAP_DELAY && snappedTo < 0) {
                    const tops = getSectionTops();
                    const vh = window.innerHeight;

                    // Find the section the user is currently INSIDE —
                    // the largest top that's at or just above
                    // currentScroll. Tops are sorted ascending.
                    let currentSectionTop = tops[0];
                    for (const top of tops) {
                        if (top <= currentScroll.current + 1) currentSectionTop = top;
                        else break;
                    }

                    // Hysteresis: prefer the current section if
                    // targetScroll is within 0.7 viewport of its top.
                    // Otherwise pick the nearest top by absolute
                    // distance (the previous behaviour). The 0.7 vh
                    // threshold is wider than half of a 100vh section,
                    // so the user's natural "approximately at this
                    // section" position still snaps to it instead of
                    // ripping past to the next one.
                    const HYSTERESIS_PX = 0.7 * vh;
                    let chosen: number;
                    if (
                        Math.abs(targetScroll.current - currentSectionTop) < HYSTERESIS_PX
                    ) {
                        chosen = currentSectionTop;
                    } else {
                        let nearest = currentSectionTop;
                        let nearestDist = Infinity;
                        tops.forEach((top) => {
                            const d = Math.abs(targetScroll.current - top);
                            if (d < nearestDist) {
                                nearestDist = d;
                                nearest = top;
                            }
                        });
                        chosen = nearest;
                    }
                    snappedTo = chosen;
                    targetScroll.current = chosen;
                }
            } else {
                idleStart = 0;
                snappedTo = -1;
            }

            // Exponential decay — frame-rate independent.
            const lambda = snappedTo >= 0 ? SNAP_LAMBDA : SCROLL_LAMBDA;
            const t = 1 - Math.exp(-lambda * dt);
            currentScroll.current += diff * t;

            // Expose normalized scroll velocity (0-1, clamped).
            scrollVelocityRef.current = Math.min(1, velocity / 500);

            // Hard-snap when close enough.
            if (Math.abs(targetScroll.current - currentScroll.current) < 0.5) {
                currentScroll.current = targetScroll.current;
            }

            if (Math.abs(currentScroll.current - window.scrollY) > 0.5) {
                window.scrollTo(0, currentScroll.current);
            }

            // Read phases AFTER window.scrollTo so getBoundingClientRect
            // reflects the new position. This is the lock-step fix:
            // phases evolve frame-by-frame with currentScroll instead
            // of trailing through a separate scroll listener.
            readLayout(currentScroll.current);

            smoothRafId.current = requestAnimationFrame(tick);
        };

        smoothRafId.current = requestAnimationFrame(tick);
        window.addEventListener("wheel", onWheel, { passive: false });

        // Keyboard navigation: PageDown/Up, Home/End, Arrow keys.
        const onKeyNav = (e: KeyboardEvent) => {
            if (
                (e.target as HTMLElement)?.tagName === "INPUT" ||
                (e.target as HTMLElement)?.tagName === "TEXTAREA"
            )
                return;

            const tops = getSectionTops();
            const current = targetScroll.current;
            const max = getMaxScroll();

            switch (e.key) {
                case "PageDown":
                case "ArrowDown": {
                    e.preventDefault();
                    const next = tops.find((t) => t > current + 10);
                    if (next !== undefined) {
                        targetScroll.current = next;
                        snappedTo = next;
                        idleStart = 0;
                    }
                    break;
                }
                case "PageUp":
                case "ArrowUp": {
                    e.preventDefault();
                    const prev = [...tops].reverse().find((t) => t < current - 10);
                    if (prev !== undefined) {
                        targetScroll.current = prev;
                        snappedTo = prev;
                        idleStart = 0;
                    }
                    break;
                }
                case "Home": {
                    e.preventDefault();
                    targetScroll.current = 0;
                    snappedTo = 0;
                    idleStart = 0;
                    break;
                }
                case "End": {
                    e.preventDefault();
                    targetScroll.current = max;
                    snappedTo = max;
                    idleStart = 0;
                    break;
                }
            }
        };
        window.addEventListener("keydown", onKeyNav);

        // Initial readLayout so phases are populated on mount before
        // the user has scrolled.
        readLayout(currentScroll.current);

        return () => {
            window.removeEventListener("wheel", onWheel);
            window.removeEventListener("keydown", onKeyNav);
            window.removeEventListener(SCROLL_EVENT, onScrollEvent);
            if (smoothRafId.current) cancelAnimationFrame(smoothRafId.current);
        };
    }, []);

    /* ── Window-level mouse tracking ──
       Normalized to viewport (the fixed canvas always fills it).
       Works everywhere — hero, steps, future sections. */
    useEffect(() => {
        const onMove = (e: PointerEvent) => {
            pointerActiveRef.current = true;
            const w = window.innerWidth;
            const h = window.innerHeight;
            mouseRef.current.x = (e.clientX / w) * 2 - 1;
            mouseRef.current.y = -((e.clientY / h) * 2 - 1);
        };

        const onLeave = () => {
            pointerActiveRef.current = false;
        };

        window.addEventListener("pointermove", onMove, { passive: true });
        document.addEventListener("pointerleave", onLeave);
        return () => {
            window.removeEventListener("pointermove", onMove);
            document.removeEventListener("pointerleave", onLeave);
        };
    }, []);

    const handleDismissStart = useCallback(() => {
        setRevealed(true);
    }, []);

    return (
        <div className={styles.siteShell}>
            {/* ── Floating chrome header ── */}
            <nav className={styles.nav}>
                <Link href="/" className={styles.navBrand} aria-label="PiercerKZN">
                    <span>PIERCER</span>
                    <span className={styles.navBrandDot} aria-hidden="true" />
                    <span>KZN</span>
                </Link>
                <ul className={styles.navLinks} data-hero={activeChapter === 0 ? "1" : "0"}>
                    <li>
                        <a
                            href="#showcase"
                            onClick={(e) => {
                                e.preventDefault();
                                scrollToSection("showcase");
                            }}
                        >
                            Визуализатор
                        </a>
                    </li>
                    <li>
                        <Link href="/auth/login">Войти</Link>
                    </li>
                    <li>
                        <a
                            href="#try-on"
                            onClick={(e) => {
                                e.preventDefault();
                                scrollToSection("try-on");
                            }}
                        >
                            Каталог
                        </a>
                    </li>
                    {/* Chapter 3 (Бронь / #reserve) hidden alongside Ch3 in HowItWorks. */}
                    {/*
                    <li>
                        <a
                            href="#reserve"
                            onClick={(e) => {
                                e.preventDefault();
                                scrollToSection("reserve");
                            }}
                        >
                            Бронь
                        </a>
                    </li>
                    */}
                </ul>
                <div className={styles.navActions}>
                    <button
                        type="button"
                        className={styles.navBurger}
                        aria-label={mobileMenuOpen ? "Закрыть меню" : "Открыть меню"}
                        aria-expanded={mobileMenuOpen ? "true" : "false"}
                        onClick={() => setMobileMenuOpen((v) => !v)}
                    >
                        <span
                            className={styles.navBurgerLine}
                            data-open={mobileMenuOpen ? "1" : "0"}
                        />
                        <span
                            className={styles.navBurgerLine}
                            data-open={mobileMenuOpen ? "1" : "0"}
                        />
                    </button>
                    <a
                        className={styles.navCta}
                        href={SITE.telegram}
                        target="_blank"
                        rel="noreferrer noopener"
                    >
                        <span className={styles.navCtaDot} aria-hidden="true" />
                        Записаться
                    </a>
                </div>
            </nav>

            {/* Mobile overlay menu */}
            {mobileMenuOpen && (
                <div className={styles.mobileMenu} role="dialog" aria-label="Навигация">
                    <a
                        href="#showcase"
                        className={styles.mobileMenuLink}
                        onClick={(e) => {
                            e.preventDefault();
                            setMobileMenuOpen(false);
                            scrollToSection("showcase");
                        }}
                    >
                        Визуализатор
                    </a>
                    <Link
                        href="/auth/login"
                        className={styles.mobileMenuLink}
                        onClick={() => setMobileMenuOpen(false)}
                    >
                        Войти
                    </Link>
                    {/* Chapters 2 & 3 mobile links hidden — see desktop
                        nav above for restore notes. */}
                    {/*
                    <a
                        href="#try-on"
                        className={styles.mobileMenuLink}
                        onClick={(e) => {
                            e.preventDefault();
                            setMobileMenuOpen(false);
                            scrollToSection("try-on");
                        }}
                    >
                        Каталог
                    </a>
                    <a
                        href="#reserve"
                        className={styles.mobileMenuLink}
                        onClick={(e) => {
                            e.preventDefault();
                            setMobileMenuOpen(false);
                            scrollToSection("reserve");
                        }}
                    >
                        Бронь
                    </a>
                    */}
                </div>
            )}

            {/* ── Sticky 3D backdrop ── */}
            <div className={styles.stickyCanvas}>
                <section ref={heroRef} className={styles.hero} aria-label="PiercerKZN — hero">
                    {/* 3D canvas layer */}
                    <div
                        ref={stageRef}
                        className={styles.stage}
                        // Marked dynamic so the visual-regression spec
                        // masks this region — the R3F canvas drives via
                        // `requestAnimationFrame` and never reaches a
                        // stable pixel state, which trips
                        // `toHaveScreenshot`'s "Failed to take two
                        // consecutive stable screenshots" timeout.
                        data-dynamic="canvas"
                        data-revealed={revealed ? "1" : "0"}
                    >
                        <WireframeRoom
                            scopeRef={heroRef}
                            fontUrl="/fonts/Montserrat-ExtraBold.ttf"
                            mouseRef={mouseRef}
                            pointerActiveRef={pointerActiveRef}
                            onReady={() => setSceneReady(true)}
                            revealed={revealed}
                            scrollPhase={scrollPhaseRef}
                            ch2Phase={ch2PhaseRef}
                            ch2TitlePhase={ch2TitlePhaseRef}
                            ch2BodyPhase={ch2BodyPhaseRef}
                            activeChapter={activeChapterRef}
                            activeJewelry={activeJewelry}
                            activeArea={activeArea}
                            transitionProgress={transitionProgress}
                            swapDirection={swapDirection}
                            scrollVelocity={scrollVelocityRef}
                            settlePulseRef={settlePulseRef}
                        />
                        <div className={styles.vignette} />
                    </div>

                    {/* Preloader overlay */}
                    <Preloader ready={sceneReady} onDismissStart={handleDismissStart} />
                </section>
            </div>

            {/* 2D grid overlay — slides up from the bottom as the
                user scrolls into Ch2 proper, settling under the body
                overlay (which sits on top of the grid as the figure
                on the examination plate). */}
            <Ch2GridOverlay ch2BodyPhase={ch2BodyPhaseRef} />
            {/* ── Scrollable content layers ── */}
            {/* Spacer: first 100vh is "occupied" by the hero (which is fixed) */}
            <div className={styles.heroSpacer} />

            {/* Visually hidden h1 for SEO + screen readers */}
            <h1 className={styles.srOnly}>
                PiercerKZN — студия пирсинга в Казани с 3D‑примеркой украшений
            </h1>

            {/* ВЫБЕРИ intro — discrete section between hero and Chapter 1.
                Provides 100vh of scroll space for the camera/ring/rotation
                transition, plus a big text overlay that slides in/out. */}
            <ChooseIntro sectionRef={chooseRef} />

            {/* How It Works — 3 chapters + Ch2 Descent + Ch2 Title intros */}
            <HowItWorks
                chapter1Ref={chapter1Ref}
                ch2DescentRef={ch2DescentRef}
                ch2TitleRef={ch2TitleRef}
                chapter2Ref={chapter2Ref}
                chapter3Ref={chapter3Ref}
                ch2BodyPhase={ch2BodyPhaseRef}
                activeJewelry={activeJewelry}
                onJewelryChange={setActiveJewelry}
                onNameChange={setJewelryName}
                activeArea={activeArea}
                onAreaChange={setActiveArea}
                transitionProgress={transitionProgress}
                swapDirection={swapDirection}
            />

            {/* Epilogue — quiet afterimage between climax and footer */}
            <Epilogue />

            <SiteFooter
                classes={{
                    siteFooter: styles.siteFooter,
                    footerCols: styles.footerCols,
                    footerDesc: styles.footerDesc,
                    footerLinks: styles.footerLinks,
                    footerH: styles.footerH,
                    footerWordmark: styles.footerWordmark,
                    footerBase: styles.footerBase,
                }}
            />
        </div>
    );
}
