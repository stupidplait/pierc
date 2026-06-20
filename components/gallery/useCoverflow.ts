import { useEffect, useRef, useState, type RefObject } from "react";
import { cardGeom, geomTransform, ringDelta } from "./coverflow-geometry";

/**
 * useCoverflow — the imperative motion engine behind GalleryCoverflow,
 * extracted so the component itself stays small and declarative.
 *
 *   - Drag horizontally (pointer/touch) to move through the ring 1:1-ish
 *     (DRAG_CARD_FRACTION of the viewport width advances one card).
 *   - Releasing hands the strip to a velocity-preserving spring that carries
 *     the flick's energy into the landing card and decelerates smoothly — the
 *     "butter" settle — instead of a fixed-duration tween.
 *   - Arrow / Home / End step through cards (also via the spring).
 *   - Vertical scroll/swipe is never captured (the section is `touch-action:
 *     pan-y`), so the page keeps scrolling and the site's Lenis smooth-scroll
 *     owns the wheel.
 *
 * Returns the `settled` (name-tag) and `focused` (scaled-up) card indices,
 * both `null` during the entrance deal and during any motion.
 */

// --- gesture tuning ------------------------------------------------------
// Fraction of viewport width the pointer must travel to advance one card.
const DRAG_CARD_FRACTION = 0.32;
const DRAG_THRESHOLD_PX = 3;
// Recent-motion window (ms) used to estimate release velocity. Older samples
// are dropped so a slow drag → pause → release reads as 0 velocity.
const VELOCITY_WINDOW_MS = 80;
// Seconds of drift the release velocity projects to pick the landing card: a
// hard flick travels several cards, a gentle release just the nearest one.
const PROJECT_TIME = 0.3;

// --- settle spring -------------------------------------------------------
// A damped spring (mass 1) carries the release velocity into the target card.
// DAMPING sits right at critical (2*sqrt(STIFFNESS) ≈ 26.8) so a hard flick
// decelerates and lands without oscillating or overshooting past the card,
// while still settling briskly (~0.6s) rather than crawling to a stop. This is
// the gesture-appropriate "preserve the input energy" motion, in keeping with
// the site's Lenis momentum scroll, rather than the <300ms budget that governs
// discrete state changes.
const SPRING_STIFFNESS = 180;
const SPRING_DAMPING = 27;
// Stop once both displacement (cards) and velocity (cards/s) are tiny.
const REST_POS = 0.002;
const REST_VEL = 0.02;
// Clamp per-frame dt so a backgrounded/throttled tab can't blow up the
// integrator when it resumes with a huge elapsed time.
const MAX_DT = 0.032;

type CoverflowOptions = {
    sectionRef: RefObject<HTMLElement | null>;
    pinRef: RefObject<HTMLDivElement | null>;
    cardsRef: RefObject<(HTMLDivElement | null)[]>;
    count: number;
    // ms the entrance "deal" runs; the focus/name reveal fires after it.
    enterMs: number;
};

export function useCoverflow({
    sectionRef,
    pinRef,
    cardsRef,
    count,
    enterMs,
}: CoverflowOptions) {
    // The settled card: its name tag is shown AND its portrait is focused
    // (scaled-up + bright). `null` while dragging/settling and on first mount
    // (the reveal timer lights up card 0 shortly after open), so no transient
    // card lights up mid-glide.
    const [settled, setSettled] = useState<number | null>(null);
    const settledRef = useRef<number | null>(null);
    // Bumped every time a card SETTLES (becomes active). The caption keys its
    // WordReveal on this so the reveal replays on each landing — but it never
    // changes on settled → null, so the name keeps its glyphs while it fades out.
    const [revealNonce, setRevealNonce] = useState(0);
    // Whether the next name appearance should snap in (a FRESH landing, where the
    // WordReveal glyph stream is itself the entrance) or ease in (the name
    // RETURNING to a card it already revealed — e.g. a drag away and back). Read
    // by the caption's show transition in GalleryCoverflow. Starts true so the
    // first reveal snaps under its stream.
    const [revealInstant, setRevealInstant] = useState(true);
    // Index exposed to assistive tech as the listbox's active option. Unlike
    // `settled` (which clears during motion), `active` updates the instant a
    // keyboard step begins — so a screen reader announces the destination
    // option immediately, not ~0.6s later when the spring settles. It only ever
    // points at a real card once the gallery has revealed (no clearing), so
    // aria-activedescendant stays valid.
    const [active, setActive] = useState<number | null>(null);

    useEffect(() => {
        const sec = sectionRef.current;
        const pin = pinRef.current;
        const cards = cardsRef.current;
        if (!sec || !pin || !cards) return;
        const N = count;
        // Defensive: the empty gallery renders a placeholder (no refs), so this
        // effect already early-returns for N===0 — but guard the modulo maths
        // explicitly so the engine is self-protecting regardless of the caller.
        if (N < 1) return;

        // Continuous position along the ring. Unbounded during a drag/spring;
        // normalised back into [0, N) once settled so it never drifts off.
        let pos = 0;
        let motionRaf = 0;
        let renderRaf = 0;
        let renderQueued = false;

        const applyTransforms = (t: number) => {
            const focusIdx = settledRef.current;
            for (let i = 0; i < N; i++) {
                const card = cards[i];
                if (!card) continue;
                const g = cardGeom(ringDelta(i, t, N));
                const { opacity, zIndex } = g;
                const transform = geomTransform(g);
                // Focus marker is gated on the *focused* index, not on which
                // card is currently centermost — so during a drag/settle no
                // card gets the scale-up treatment.
                card.dataset.center = focusIdx === i ? "1" : "0";
                // One batched write via Object.assign (NOT `cssText`, which
                // would wipe the per-card --bal-* custom properties the deal
                // keyframe reads). These are compositor-only props written in a
                // loop that never reads layout, so there's no reflow to thrash.
                Object.assign(card.style, {
                    transform,
                    opacity: String(opacity),
                    zIndex: String(zIndex),
                });
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

        // Honoured by the spring: under reduced motion we skip the glide and
        // jump straight to the target. The cards' CSS transitions + deal
        // animation are short-circuited by the global prefers-reduced-motion
        // rule in globals.css, so no per-instance class toggle is needed here.
        const reducedMotionMql = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        );

        // The card the name last REVEALED for. The reveal replays (WordReveal
        // remounts via a new nonce) only when the active card changes to a
        // *different* one — so tapping, or nudging the strip and settling back on
        // the same card, never re-streams the caption that's already on screen.
        let lastRevealedIdx: number | null = null;

        // Settled index. Ref first (synchronous read for guards/renderer, which
        // gates both the focus scale-up via data-center and the name reveal),
        // then React state (drives the JSX name reveal + data-center).
        const commitSettled = (idx: number | null) => {
            settledRef.current = idx;
            setSettled(idx);
            if (idx !== null) {
                // A different card than the one last revealed is a FRESH landing:
                // replay the glyph stream (new nonce) and let the name snap in
                // under it. The SAME card returning (drag away + back) keeps its
                // glyphs and just eases the container back in.
                const fresh = idx !== lastRevealedIdx;
                if (fresh) {
                    lastRevealedIdx = idx;
                    setRevealNonce((n) => n + 1);
                }
                setRevealInstant(fresh);
            }
        };
        // Active-option index for aria-activedescendant. Normalise into [0, N)
        // so it always names a rendered option.
        const commitActive = (raw: number) => {
            setActive(((Math.round(raw) % N) + N) % N);
        };

        // Land on `target` (may be outside [0, N)): normalise pos, light up the
        // card + name, and drop the JS-driven flag so the CSS transition (idle
        // smoothing) is allowed again.
        const settle = (target: number) => {
            sec.dataset.animating = "0";
            pos = ((target % N) + N) % N;
            const idx = ((Math.round(pos) % N) + N) % N;
            commitSettled(idx);
            commitActive(idx);
            render();
        };

        // Velocity-preserving spring glide to `target`, seeded with `v0`
        // (cards/second). While it runs the section is marked data-animating so
        // the cards' CSS transition is dropped — the rAF integrator writes
        // transform/opacity/z-index together every frame, so the transition
        // would only lag transform/opacity behind z-index and break the
        // stacking order (clipping) on a fast settle.
        const springTo = (target: number, v0: number) => {
            cancelAnimationFrame(motionRaf);
            sec.dataset.animating = "1";
            if (reducedMotionMql.matches) {
                settle(target);
                return;
            }
            let vel = v0;
            let last = performance.now();
            const step = () => {
                const now = performance.now();
                const dt = Math.min(
                    MAX_DT,
                    Math.max(0.001, (now - last) / 1000),
                );
                last = now;
                // Semi-implicit Euler on a damped spring toward `target`.
                const accel =
                    -SPRING_STIFFNESS * (pos - target) - SPRING_DAMPING * vel;
                vel += accel * dt;
                pos += vel * dt;
                render();
                if (
                    Math.abs(target - pos) < REST_POS &&
                    Math.abs(vel) < REST_VEL
                ) {
                    settle(target);
                } else {
                    motionRaf = requestAnimationFrame(step);
                }
            };
            motionRaf = requestAnimationFrame(step);
        };

        // Step ±delta cards from the settled (or projected) position. Used by
        // keyboard nav — routed through the spring (with no initial velocity)
        // so every input modality settles with the same feel.
        const stepBy = (delta: number) => {
            sec.dataset.entered = "1"; // cancel the deal so input wins
            const base = settledRef.current ?? Math.round(pos);
            const target = base + delta;
            const targetIdx = ((target % N) + N) % N;
            // Only blink the name out if the step actually lands on a different
            // card (Home/End while already there keeps it on screen).
            if (settledRef.current !== null && targetIdx !== settledRef.current) {
                commitSettled(null);
            }
            commitActive(target); // announce the destination option immediately
            springTo(target, 0);
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
        // The card index the current gesture began on. Used to keep the active
        // name visible for an in-card drag (and skip the reveal replay when the
        // gesture settles back onto it).
        let gestureOrigin = 0;
        // Whether the gesture began on a card that was showing its name. Only then
        // does dragging back home restore the name mid-drag — a drag begun during
        // motion (no settled name) shouldn't fabricate one.
        let gestureHadName = false;
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
            sec.dataset.entered = "1"; // cancel the deal so the drag wins
            cancelAnimationFrame(motionRaf);
            startX = e.clientX;
            startPos = pos;
            // At rest pos is normalised to the settled index, so this is the card
            // under the pointer when the gesture starts.
            gestureOrigin = settledRef.current ?? Math.round(pos);
            gestureHadName = settledRef.current !== null;
            samples.length = 0;
            pushSample(pos);
            sec.dataset.dragging = "1";
            // Drag is rAF-driven too — drop the cards' CSS transition for the
            // same reason the spring does.
            sec.dataset.animating = "1";
            try {
                pin.setPointerCapture(e.pointerId);
            } catch {
                // ignore: pointer capture is best-effort
            }
        };
        const onPointerMove = (e: PointerEvent) => {
            if (!dragging) return;
            const dx = e.clientX - startX;
            // `moved` only flags that the pointer travelled (tap vs drag); it no
            // longer hides the name on its own.
            if (!moved && Math.abs(dx) > DRAG_THRESHOLD_PX) moved = true;
            const cardPx = Math.max(1, window.innerWidth * DRAG_CARD_FRACTION);
            pos = startPos - dx / cardPx;
            pushSample(pos);
            // Keep the active name in step with the drag: it hides the moment the
            // strip scrubs past its starting card and — crucially — comes BACK the
            // instant the card is dragged home again, without waiting for release.
            // The restored index matches the last reveal, so commitSettled fires no
            // new nonce: the caption EASES back in (see GalleryCoverflow's revealDur)
            // rather than re-streaming. A small in-card drag never crosses, so it
            // never blinks at all.
            const onOrigin = Math.round(pos) === gestureOrigin;
            if (onOrigin && gestureHadName) {
                if (settledRef.current === null) commitSettled(gestureOrigin);
            } else if (settledRef.current !== null) {
                commitSettled(null);
            }
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
            // A tap (pointer never crossed the drag threshold) leaves the active
            // card and its name exactly as they were — no settle, no reveal
            // replay. Snap any sub-threshold jitter back onto the origin card.
            if (!moved) {
                sec.dataset.animating = "0";
                pos = ((gestureOrigin % N) + N) % N;
                render();
                return;
            }
            // Project where the release velocity would carry the strip, snap
            // that to the nearest card, then spring there carrying the same
            // velocity — a fast flick travels several cards, a slow release
            // settles to the closest one.
            const v = releaseVelocity();
            const target = Math.round(pos + v * PROJECT_TIME);
            const targetIdx = ((target % N) + N) % N;
            // Hide the name during the fly only when landing on a *different*
            // card (it re-reveals there). A release that stays on the origin card
            // keeps the name up the whole time — no blink, no replay.
            if (settledRef.current !== null && targetIdx !== settledRef.current) {
                commitSettled(null);
            }
            commitActive(target); // reflect the landing option for AT
            springTo(target, v);
        };

        // Safety net for "stuck drag" — if the tab is hidden mid-drag, end it
        // cleanly (instant, no glide) so dragging=true doesn't leak across
        // visibility changes.
        const onVisibilityChange = () => {
            if (document.hidden && dragging) {
                dragging = false;
                sec.dataset.dragging = "0";
                cancelAnimationFrame(motionRaf);
                settle(Math.round(pos));
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
        // and reveal its name together — both animate in via their transitions
        // / WordReveal rather than appearing fully-formed. Guarded so an early
        // drag/spring wins; instant under reduced motion.
        const revealTimer = window.setTimeout(
            () => {
                if (settledRef.current === null && !dragging) {
                    commitSettled(0);
                    commitActive(0);
                }
            },
            reducedMotionMql.matches ? 0 : enterMs,
        );

        return () => {
            window.clearTimeout(revealTimer);
            cancelAnimationFrame(motionRaf);
            cancelAnimationFrame(renderRaf);
            pin.removeEventListener("pointerdown", onPointerDown);
            pin.removeEventListener("pointermove", onPointerMove);
            pin.removeEventListener("pointerup", endDrag);
            pin.removeEventListener("pointercancel", endDrag);
            pin.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("resize", onResize);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [sectionRef, pinRef, cardsRef, count, enterMs]);

    return { settled, active, revealNonce, revealInstant };
}
