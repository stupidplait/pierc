"use client";

import { useEffect } from "react";

/**
 * useSectionSnap — wheel-hijacking smooth-scroll loop with snap-to-nearest-section.
 *
 * Adapted from /new-design/page.tsx. Captures wheel events, drives a
 * custom rAF loop that smoothly interpolates `currentScroll` toward
 * `targetScroll`, and after a brief idle period (600 ms with no
 * additional input) snaps the target to the nearest section top.
 *
 * Behavior:
 *   • Touch devices: opt-out entirely (gesture momentum is the OS's
 *     job; hijacking would fight platform physics).
 *   • Wheel: each tick scales by `WHEEL_DAMPING` and moves the
 *     target. Target divergence from current is capped at
 *     `TARGET_CAP_VH` viewports so a fast burst can't shoot the
 *     user past several sections at once.
 *   • Idle (velocity < 5 px/frame for 600 ms): pick the nearest
 *     section top from `sectionRefs`, with a 0.7-vh hysteresis
 *     window that prefers the section the user is currently inside
 *     when targetScroll is close to its top.
 *   • Keyboard: PageUp / PageDown / ArrowUp / ArrowDown / Home /
 *     End all step between section tops.
 *
 * Compose with other wheel listeners by using `stopPropagation()`
 * on listeners bound to inner elements — the rolodex's wheel
 * handler in `JewelryShowcase` does this so the snap loop doesn't
 * interfere with its swap-stepping.
 */
export function useSectionSnap({
    sectionRefs,
    enabled = true,
}: {
    sectionRefs: React.RefObject<HTMLElement | null>[];
    enabled?: boolean;
}) {
    useEffect(() => {
        if (!enabled || typeof window === "undefined") return;

        const isTouch =
            "ontouchstart" in window || navigator.maxTouchPoints > 0;
        if (isTouch) return;

        const SCROLL_LAMBDA = 9;
        const SNAP_LAMBDA = 12;
        const WHEEL_DAMPING = 0.28;
        const SNAP_VELOCITY_THRESHOLD = 5;
        const SNAP_DELAY = 600;
        const TARGET_CAP_VH = 2;
        const EXTERNAL_RESYNC_PX = 16;
        const EXTERNAL_RESYNC_VELOCITY = 50;
        const HYSTERESIS_PX_RATIO = 0.7;

        let targetScroll = window.scrollY;
        let currentScroll = window.scrollY;
        let lastTime = performance.now();
        let idleStart = 0;
        let snappedTo = -1;
        let rafId = 0;

        // Native-scroll detection. Browser scroll events fire from many
        // sources: wheel (handled by us), scrollbar drag, keyboard
        // (PageDown/Home/End triggered inside an INPUT etc), middle-click
        // pan, programmatic scrollIntoView. Of these, only wheel goes
        // through our smooth-scroll loop. The rest are "native" — the
        // browser is already moving scrollY directly. Trying to also
        // smooth-lerp + snap on top fights the user's input → jitter.
        //
        // We track the timestamp of our last wheel-driven update. When
        // a native scroll fires without a recent wheel, we treat the
        // user as in native-scroll mode and SUSPEND the smooth loop:
        // currentScroll/targetScroll are pinned to window.scrollY each
        // frame, no scrollTo writes, no snap idle countdown. Resumes
        // automatically when wheel input returns or the user has been
        // idle for a beat.
        let lastWheelTime = -Infinity;
        let lastNativeScrollTime = -Infinity;
        const NATIVE_SCROLL_LOCKOUT_MS = 250;

        const onNativeScroll = () => {
            const now = performance.now();
            // If we just dispatched a wheel-driven scrollTo, this scroll
            // event is our own — ignore it.
            if (now - lastWheelTime < 50) return;
            lastNativeScrollTime = now;
        };
        window.addEventListener("scroll", onNativeScroll, { passive: true });

        const getMaxScroll = () =>
            document.documentElement.scrollHeight - window.innerHeight;

        const getSectionTops = (): number[] => {
            const tops: number[] = [0];
            for (const ref of sectionRefs) {
                const el = ref.current;
                if (!el) continue;
                const rect = el.getBoundingClientRect();
                tops.push(rect.top + window.scrollY);
            }
            tops.push(getMaxScroll());
            return Array.from(new Set(tops)).sort((a, b) => a - b);
        };

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            lastWheelTime = performance.now();
            lastNativeScrollTime = -Infinity; // wheel input cancels any active native-scroll lockout
            targetScroll += e.deltaY * WHEEL_DAMPING;
            targetScroll = Math.max(0, Math.min(targetScroll, getMaxScroll()));

            const cap = TARGET_CAP_VH * window.innerHeight;
            if (targetScroll - currentScroll > cap) {
                targetScroll = currentScroll + cap;
            } else if (currentScroll - targetScroll > cap) {
                targetScroll = currentScroll - cap;
            }
            idleStart = 0;
            snappedTo = -1;
        };

        const tick = () => {
            const now = performance.now();
            const dt = Math.min((now - lastTime) / 1000, 0.05);
            lastTime = now;

            // SUSPEND during native scrolling. While the user is dragging
            // the scrollbar or otherwise driving scroll outside our wheel
            // path, we hand full control back to the browser — pin our
            // internal smooth-scroll state to whatever scrollY the
            // browser sets, never call scrollTo, never trigger a snap.
            // Resumes automatically NATIVE_SCROLL_LOCKOUT_MS after the
            // last native scroll event.
            if (now - lastNativeScrollTime < NATIVE_SCROLL_LOCKOUT_MS) {
                currentScroll = window.scrollY;
                targetScroll = window.scrollY;
                snappedTo = -1;
                idleStart = 0;
                rafId = requestAnimationFrame(tick);
                return;
            }

            // External-scroll resync — adopt window.scrollY as authoritative
            // when divergence is meaningful AND we're near rest. Prevents
            // fighting native browser scroll (jump-to-anchor, mousewheel
            // outside our handler, etc).
            const externalScrollY = window.scrollY;
            const divergence = Math.abs(externalScrollY - currentScroll);
            const inflightVelocity = Math.abs(targetScroll - currentScroll);
            if (
                divergence > EXTERNAL_RESYNC_PX &&
                inflightVelocity < EXTERNAL_RESYNC_VELOCITY
            ) {
                currentScroll = externalScrollY;
                targetScroll = externalScrollY;
                snappedTo = -1;
                idleStart = 0;
            }

            const diff = targetScroll - currentScroll;
            const velocity = Math.abs(diff);

            // Idle detection + snap.
            if (velocity < SNAP_VELOCITY_THRESHOLD) {
                if (idleStart === 0) {
                    idleStart = now;
                } else if (now - idleStart > SNAP_DELAY && snappedTo < 0) {
                    const tops = getSectionTops();
                    const vh = window.innerHeight;
                    const HYSTERESIS_PX = HYSTERESIS_PX_RATIO * vh;

                    // Find the section the user is currently INSIDE.
                    let currentSectionTop = tops[0];
                    for (const top of tops) {
                        if (top <= currentScroll + 1) currentSectionTop = top;
                        else break;
                    }

                    // Hysteresis: prefer the current section if
                    // targetScroll is within 0.7vh of its top. Otherwise
                    // pick the nearest top by absolute distance.
                    let chosen: number;
                    if (
                        Math.abs(targetScroll - currentSectionTop) <
                        HYSTERESIS_PX
                    ) {
                        chosen = currentSectionTop;
                    } else {
                        let nearest = currentSectionTop;
                        let nearestDist = Infinity;
                        tops.forEach((top) => {
                            const d = Math.abs(targetScroll - top);
                            if (d < nearestDist) {
                                nearestDist = d;
                                nearest = top;
                            }
                        });
                        chosen = nearest;
                    }
                    snappedTo = chosen;
                    targetScroll = chosen;
                }
            } else {
                idleStart = 0;
                snappedTo = -1;
            }

            // Exponential decay — frame-rate independent.
            const lambda = snappedTo >= 0 ? SNAP_LAMBDA : SCROLL_LAMBDA;
            const t = 1 - Math.exp(-lambda * dt);
            currentScroll += diff * t;

            // Hard-snap when close enough.
            if (Math.abs(targetScroll - currentScroll) < 0.5) {
                currentScroll = targetScroll;
            }

            if (Math.abs(currentScroll - window.scrollY) > 0.5) {
                // Mark this as wheel-driven so the native-scroll listener
                // doesn't treat the resulting scroll event as user input.
                lastWheelTime = performance.now();
                window.scrollTo(0, currentScroll);
            }

            rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
        window.addEventListener("wheel", onWheel, { passive: false });

        const onKeyNav = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA") return;

            const tops = getSectionTops();
            const max = getMaxScroll();

            switch (e.key) {
                case "PageDown":
                case "ArrowDown": {
                    e.preventDefault();
                    const next = tops.find((t) => t > targetScroll + 10);
                    if (next !== undefined) {
                        targetScroll = next;
                        snappedTo = next;
                        idleStart = 0;
                    }
                    break;
                }
                case "PageUp":
                case "ArrowUp": {
                    e.preventDefault();
                    const prev = [...tops]
                        .reverse()
                        .find((t) => t < targetScroll - 10);
                    if (prev !== undefined) {
                        targetScroll = prev;
                        snappedTo = prev;
                        idleStart = 0;
                    }
                    break;
                }
                case "Home": {
                    e.preventDefault();
                    targetScroll = 0;
                    snappedTo = 0;
                    idleStart = 0;
                    break;
                }
                case "End": {
                    e.preventDefault();
                    targetScroll = max;
                    snappedTo = max;
                    idleStart = 0;
                    break;
                }
            }
        };
        window.addEventListener("keydown", onKeyNav);

        return () => {
            window.removeEventListener("wheel", onWheel);
            window.removeEventListener("keydown", onKeyNav);
            window.removeEventListener("scroll", onNativeScroll);
            if (rafId) cancelAnimationFrame(rafId);
        };
        // sectionRefs identity is stable per the caller's component lifetime;
        // the array itself is held by ref so its members can mutate without
        // re-running this effect.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);
}
