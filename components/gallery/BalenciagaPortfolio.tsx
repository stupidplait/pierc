"use client";

/**
 * BalenciagaPortfolio — drag-driven coverflow.
 *
 *   - Drag horizontally (pointer or touch) to move through the cards; the
 *     filmstrip follows the cursor 1:1-ish (DRAG_CARD_FRACTION of the viewport
 *     width advances one card).
 *   - Releasing snaps to the nearest card with an eased tween (never instant).
 *   - The focused card's name reveals once the snap settles; it hides the
 *     moment a drag actually begins.
 *   - No page-scroll hijacking: vertical scroll/swipe passes through to the
 *     page (touch-action: pan-y), only horizontal drag is captured.
 */

import { useEffect, useRef, useState } from "react";
import { WordReveal } from "@/components/about/client/WordReveal";
import styles from "./BalenciagaPortfolio.module.css";

type Tone = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
type Item = { tag: string; meta: string; tone: Tone };

const items: Item[] = [
    { tag: "ХЕЛИКС", meta: "УХО · 2026", tone: "a" },
    { tag: "СЕПТУМ", meta: "НОС · 2026", tone: "b" },
    { tag: "ДЭЙС", meta: "УХО · 2025", tone: "c" },
    { tag: "КОНК", meta: "УХО · 2026", tone: "d" },
    { tag: "ЛАБРЕТ", meta: "ЛИЦО · 2025", tone: "e" },
    { tag: "ИНДАСТРИАЛ", meta: "УХО · 2026", tone: "f" },
    { tag: "РУК", meta: "УХО · 2026", tone: "g" },
    { tag: "ТРАГУС", meta: "УХО · 2025", tone: "h" },
    { tag: "МЕДУЗА", meta: "ЛИЦО · 2026", tone: "a" },
    { tag: "НОЗДРЯ", meta: "НОС · 2025", tone: "c" },
    { tag: "ПУПОК", meta: "ТЕЛО · 2026", tone: "e" },
    { tag: "БРОВЬ", meta: "ЛИЦО · 2026", tone: "g" },
];

const N = items.length;
const STEP_VW = 46;
// Fraction of viewport width the pointer must travel to advance one card.
const DRAG_CARD_FRACTION = 0.32;
// Minimum settle duration for a tiny correction snap.
const SNAP_MIN_MS = 360;
// Extra duration per card travelled (caps growth on long flings).
const SNAP_PER_CARD_MS = 70;
// Hard ceiling on snap duration so a violent flick can't take forever.
const SNAP_MAX_MS = 900;
// How far momentum carries `pos` after release (seconds of "drift" extrapolated
// from the release velocity). Higher = flicks travel further.
const MOMENTUM_TIME = 0.35;
// Recent-motion window (ms) used to estimate release velocity. Older samples
// are dropped so a slow drag → pause → release reads as 0 velocity.
const VELOCITY_WINDOW_MS = 80;
const DRAG_THRESHOLD_PX = 3;

// --- entrance ("deal") ---------------------------------------------------
// Cards fade + scale into a stack behind the centre, then (no stagger) all
// slide to their resting places in unison. The animation is CSS-driven
// (`balDeal`); ENTER_DUR_MS only needs to match that duration so the name
// reveal fires once the entrance finishes.
const ENTER_DUR_MS = 1350;
const ENTER_TOTAL_MS = ENTER_DUR_MS;
// Per-ring peek offset (vw) of the initial stack — small, so cards read as
// stacked behind the centre with just their edges showing on both sides.
const STACK_STEP_VW = 2.6;

function ease(t: number) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

// Shortest signed delta from `from` to integer card `i` on a ring of N.
// Result is in (-N/2, N/2]. Each card renders at most N/2 steps away — that's
// what makes the strip read as infinite.
function ringDelta(i: number, from: number) {
    const raw = i - from;
    const mod = ((raw % N) + N) % N;
    return mod > N / 2 ? mod - N : mod;
}

// Pure geometry for a card at signed ring-distance `d` from centre.
type CardGeom = { x: number; scale: number; opacity: number; zIndex: number };
function cardGeom(d: number): CardGeom {
    const abs = Math.abs(d);
    if (abs > 5.5) {
        return { x: d < 0 ? -260 : 260, scale: 0.2, opacity: 0, zIndex: 0 };
    }
    const scale = Math.max(0.22, 1 - 0.28 * Math.pow(abs, 0.85));
    const edgeFade = abs > 4 ? Math.max(0, 1 - (abs - 4) * 0.9) : 1;
    const dim = abs < 0.5 ? 1 : Math.max(0.42, 1 - abs * 0.18);
    return {
        x: d * STEP_VW,
        scale,
        opacity: Math.min(edgeFade, dim),
        zIndex: Math.round(scale * 100),
    };
}
const geomTransform = (g: CardGeom) =>
    `translate(-50%, -50%) translateX(${g.x}vw) scale(${g.scale})`;

// SSR / initial inline style for a card at pos=0. Includes the card's final
// transform/opacity (so the first painted frame already equals the resting
// state — no transform-transition slide) PLUS the custom properties the
// `balDeal` entrance keyframe reads to fan each card out from behind the
// centre, staggered by ring distance.
function initialCardStyle(i: number): React.CSSProperties {
    const d = ringDelta(i, 0);
    const abs = Math.abs(d);
    const g = cardGeom(d);
    return {
        transform: geomTransform(g),
        opacity: g.opacity,
        zIndex: g.zIndex,
        // resting (fanned-out) target — read by the balDeal keyframe `to`.
        "--bal-final-x": `${g.x}vw`,
        "--bal-final-scale": g.scale,
        "--bal-final-opacity": g.opacity,
        // initial stacked state — read by the keyframe `0%`/`38%`. Cards bunch
        // behind the centre (small offset, slight shrink) with edges peeking.
        "--bal-stack-x": `${d * STACK_STEP_VW}vw`,
        "--bal-stack-scale": Math.max(0.8, 1 - 0.04 * abs),
        "--bal-stack-opacity": abs > 5.5 ? 0 : 1,
    } as React.CSSProperties;
}

export function BalenciagaPortfolio() {
    const sectionRef = useRef<HTMLElement>(null);
    const pinRef = useRef<HTMLDivElement>(null);
    const cardsRef = useRef<(HTMLLIElement | null)[]>([]);
    // Which card's name tag is shown. `null` while dragging/snapping AND on
    // first mount — the effect reveals card 0's name shortly after open (via a
    // timer, so the setState stays out of the effect body where a synchronous
    // call would be a build-breaking lint error) so the name animates in rather
    // than appearing statically.
    const [settled, setSettled] = useState<number | null>(null);
    const settledRef = useRef<number | null>(null);
    // Which card's portrait is focused (scaled-up + bright). Starts `null` so no
    // card lights up during the entrance deal; card 0 is activated together with
    // its name once the cards finish unstacking (see the reveal timer below).
    // Also goes `null` during a drag/snap so no transient card lights up, then
    // lands on the settled index.
    const [focused, setFocused] = useState<number | null>(null);
    const focusedRef = useRef<number | null>(null);

    useEffect(() => {
        const sec = sectionRef.current;
        const pin = pinRef.current;
        if (!sec || !pin) return;

        // Continuous position along the ring. Unbounded during a drag; normalised
        // back into [0, N) after each snap so the numbers don't grow forever.
        let pos = 0;
        let snapRaf = 0;
        let renderRaf = 0;
        let renderQueued = false;

        const applyTransforms = (t: number) => {
            const focusIdx = focusedRef.current;
            for (let i = 0; i < N; i++) {
                const li = cardsRef.current[i];
                if (!li) continue;
                const g = cardGeom(ringDelta(i, t));
                const { opacity, zIndex } = g;
                const transform = geomTransform(g);
                // Focus marker is gated on the *focused* index, not on which
                // card is currently centermost — so during a drag/snap no card
                // gets the scale-up treatment.
                li.dataset.center = focusIdx === i ? "1" : "0";
                li.style.transform = transform;
                li.style.opacity = String(opacity);
                li.style.zIndex = String(zIndex);
            }
        };

        const render = () => {
            renderQueued = false;
            applyTransforms(pos);
        };
        const scheduleRender = () => {
            if (renderQueued) return;
            renderQueued = true;
            renderRaf = requestAnimationFrame(render);
        };

        // Honoured by the snap tween: if the user prefers reduced motion we
        // skip the eased glide and jump straight to the target index. The
        // filmstrip's CSS transitions are also short-circuited via a class on
        // the section (see .balCss-noMotion in the stylesheet).
        const reducedMotionMql = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        );
        const applyReducedMotion = () => {
            sec.classList.toggle(styles.balNoMotion, reducedMotionMql.matches);
        };
        applyReducedMotion();
        reducedMotionMql.addEventListener("change", applyReducedMotion);

        // Name tag index. Updates the ref first (synchronous read for the
        // renderer/guards) then the React state (drives the JSX name reveal).
        const commitSettled = (idx: number | null) => {
            settledRef.current = idx;
            setSettled(idx);
        };
        // Portrait-focus index. Ref first so the next render() picks up the new
        // focus immediately; state second so the JSX `data-center` matches.
        const commitFocus = (idx: number | null) => {
            focusedRef.current = idx;
            setFocused(idx);
        };

        // Eased glide to `target` over `durationMs`. `target` may be outside
        // [0, N); `pos` is normalised modulo N after settling so it never drifts
        // off to infinity.
        const animateTo = (target: number, durationMs: number) => {
            const from = pos;
            cancelAnimationFrame(snapRaf);
            const settle = () => {
                pos = ((target % N) + N) % N;
                const idx = ((Math.round(pos) % N) + N) % N;
                commitSettled(idx);
                commitFocus(idx);
                render();
            };
            // Reduced-motion or no-op: skip the tween entirely.
            if (
                reducedMotionMql.matches ||
                (Math.abs(target - from) < 0.0005 && durationMs <= 0)
            ) {
                settle();
                return;
            }
            const dur = Math.max(60, durationMs);
            const start = performance.now();
            const step = () => {
                const k = Math.min(1, (performance.now() - start) / dur);
                pos = from + (target - from) * ease(k);
                render();
                if (k < 1) {
                    snapRaf = requestAnimationFrame(step);
                } else {
                    settle();
                }
            };
            snapRaf = requestAnimationFrame(step);
        };

        // Step ±delta cards from the currently-settled (or projected) position.
        // Used by keyboard nav. Distance-scaled snap duration matches the
        // pointer release behaviour so all input modalities feel the same.
        const stepBy = (delta: number) => {
            sec.dataset.entered = "1"; // cancel the deal animation so input wins
            const base = settledRef.current ?? Math.round(pos);
            const target = base + delta;
            const distance = Math.abs(target - pos);
            const dur = Math.min(
                SNAP_MAX_MS,
                SNAP_MIN_MS + Math.min(distance, 6) * SNAP_PER_CARD_MS,
            );
            commitSettled(null);
            commitFocus(null);
            animateTo(target, dur);
        };

        const onKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case "ArrowRight":
                    e.preventDefault();
                    stepBy(1);
                    break;
                case "ArrowLeft":
                    e.preventDefault();
                    stepBy(-1);
                    break;
                case "Home":
                    e.preventDefault();
                    stepBy(-(settledRef.current ?? 0));
                    break;
                case "End":
                    e.preventDefault();
                    stepBy(N - 1 - (settledRef.current ?? 0));
                    break;
            }
        };

        // ---- drag ----
        let dragging = false;
        let startX = 0;
        let startPos = 0;
        let moved = false;
        // Ring buffer of recent (time, pos) samples used to estimate the
        // release velocity. Anything older than VELOCITY_WINDOW_MS is dropped.
        type Sample = { t: number; p: number };
        const samples: Sample[] = [];

        const pushSample = (p: number) => {
            const now = performance.now();
            samples.push({ t: now, p });
            const cutoff = now - VELOCITY_WINDOW_MS;
            while (samples.length > 1 && samples[0].t < cutoff) samples.shift();
        };
        const releaseVelocity = (): number => {
            // cards per second across the retained window.
            if (samples.length < 2) return 0;
            const first = samples[0];
            const last = samples[samples.length - 1];
            const dt = (last.t - first.t) / 1000;
            if (dt <= 0) return 0;
            return (last.p - first.p) / dt;
        };

        const onPointerDown = (e: PointerEvent) => {
            if (e.button !== 0) return;
            dragging = true;
            moved = false;
            sec.dataset.entered = "1"; // cancel the deal animation so the drag wins
            cancelAnimationFrame(snapRaf);
            startX = e.clientX;
            startPos = pos;
            samples.length = 0;
            pushSample(pos);
            sec.dataset.dragging = "1";
            try {
                pin.setPointerCapture(e.pointerId);
            } catch {
                // ignore: pointer capture is best-effort
            }
        };
        const onPointerMove = (e: PointerEvent) => {
            if (!dragging) return;
            const dx = e.clientX - startX;
            if (!moved && Math.abs(dx) > DRAG_THRESHOLD_PX) {
                moved = true;
                commitSettled(null); // hide the name once a real drag starts
                commitFocus(null); // drop the scale-up too
            }
            const cardPx = Math.max(1, window.innerWidth * DRAG_CARD_FRACTION);
            pos = startPos - dx / cardPx;
            pushSample(pos);
            scheduleRender();
        };
        const endDrag = (e: PointerEvent) => {
            if (!dragging) return;
            dragging = false;
            sec.dataset.dragging = "0";
            try {
                pin.releasePointerCapture(e.pointerId);
            } catch {
                // ignore
            }
            // Project where momentum would carry `pos` if we let it drift, then
            // snap that projection to the nearest card. A fast flick travels
            // several cards; a slow release just settles to the closest one.
            const v = releaseVelocity();
            const projected = pos + v * MOMENTUM_TIME;
            const target = Math.round(projected);
            const distance = Math.abs(target - pos);
            const dur = Math.min(
                SNAP_MAX_MS,
                SNAP_MIN_MS + Math.min(distance, 6) * SNAP_PER_CARD_MS,
            );
            animateTo(target, dur);
        };

        // Safety net for "stuck drag" — if the tab is hidden mid-drag, end it
        // cleanly so dragging=true doesn't leak across visibility changes.
        const onVisibilityChange = () => {
            if (document.hidden && dragging) {
                dragging = false;
                sec.dataset.dragging = "0";
                animateTo(Math.round(pos), SNAP_MIN_MS);
            }
        };

        const onResize = () => render();

        pin.addEventListener("pointerdown", onPointerDown);
        pin.addEventListener("pointermove", onPointerMove);
        pin.addEventListener("pointerup", endDrag);
        pin.addEventListener("pointercancel", endDrag);
        pin.addEventListener("keydown", onKeyDown);
        window.addEventListener("resize", onResize);
        document.addEventListener("visibilitychange", onVisibilityChange);

        // Initial positioning — DOM writes only, no state changes.
        render();

        // Once the cards finish unstacking, activate card 0 (scale-up + bright)
        // and reveal its name together — both animate in via their transitions /
        // WordReveal rather than appearing fully-formed, and card 0 deliberately
        // stays un-focused during the deal. Guarded so an early drag/snap wins;
        // instant when the user prefers reduced motion.
        const revealTimer = window.setTimeout(
            () => {
                if (settledRef.current === null && !dragging) {
                    commitSettled(0);
                    commitFocus(0);
                }
            },
            reducedMotionMql.matches ? 0 : ENTER_TOTAL_MS,
        );

        return () => {
            window.clearTimeout(revealTimer);
            cancelAnimationFrame(snapRaf);
            cancelAnimationFrame(renderRaf);
            pin.removeEventListener("pointerdown", onPointerDown);
            pin.removeEventListener("pointermove", onPointerMove);
            pin.removeEventListener("pointerup", endDrag);
            pin.removeEventListener("pointercancel", endDrag);
            pin.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("resize", onResize);
            document.removeEventListener(
                "visibilitychange",
                onVisibilityChange,
            );
            reducedMotionMql.removeEventListener("change", applyReducedMotion);
        };
    }, []);

    const settledItem = settled !== null ? items[settled] : null;

    return (
        <section
            ref={sectionRef}
            className={styles.bal}
            role="region"
            aria-roledescription="карусель"
            aria-label="Галерея работ студии"
        >
            <div
                ref={pinRef}
                className={styles.balPin}
                tabIndex={0}
                aria-label="Перетащите или используйте стрелки для просмотра"
            >
                <div className={styles.balGrid} aria-hidden />
                <ul className={styles.balCards}>
                    {items.map((it, i) => (
                        <li
                            key={it.tag}
                            ref={(el) => {
                                cardsRef.current[i] = el;
                            }}
                            className={styles.balCard}
                            data-tone={it.tone}
                            // `data-center` (focus) is seeded from `focused`,
                            // which starts null — so no card is active during the
                            // entrance deal; card 0 lights up with its name once
                            // the cards unstack. `style` seeds the pos=0 layout
                            // (renderer/SSR agree) and the custom props the
                            // balDeal entrance keyframe fans out from.
                            data-center={focused === i ? "1" : "0"}
                            style={initialCardStyle(i)}
                        >
                            <div className={styles.balPortrait} />
                        </li>
                    ))}
                </ul>
                {/* Centered display name for the settled card. Keyed on the
                 * settled index so it remounts — and so WordReveal replays its
                 * letter-by-letter reveal — each time a new card settles. Absent
                 * while dragging/snapping (settled === null), so the name clears
                 * the moment a drag begins, exactly as before. aria-hidden: the
                 * .balLive region below is the canonical announcement. */}
                {settledItem && (
                    <div className={styles.balNameLayer} aria-hidden="true">
                        <WordReveal
                            key={settled}
                            text={settledItem.tag}
                            as="span"
                            splitBy="char"
                            stagger={0.05}
                            className={styles.balCardName}
                        />
                    </div>
                )}
            </div>
            <div
                className={styles.balLive}
                aria-live="polite"
                aria-atomic="true"
            >
                {settledItem
                    ? `Активная работа: ${settledItem.tag}, ${settledItem.meta}`
                    : ""}
            </div>
        </section>
    );
}
