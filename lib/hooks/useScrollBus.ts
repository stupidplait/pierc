"use client";

import { useEffect, useRef } from "react";

/**
 * Single-listener scroll bus — one `window.addEventListener("scroll", ...)`
 * for the whole app, rAF-batched, with a fan-out subscriber registry.
 *
 * Pre-computes derived values once per frame:
 *   - scrollY      raw window.scrollY
 *   - vh           cached viewport height (refreshed on resize)
 *   - scrollPhase  Math.min(1, scrollY / (2 * vh))    // 0 → 1 across first 2 viewports
 *   - velocity     last-frame Δ scrollY (px/frame)
 *
 * Each subscriber callback receives the same snapshot, so N consumers
 * cost one rAF instead of N. Idle (no scroll → no rAF scheduled).
 *
 * USAGE:
 *   useScrollBus((s) => {
 *     setHidden(s.scrollY > 80 && s.velocity > 0);
 *   });
 */

export interface ScrollSnapshot {
    scrollY: number;
    vh: number;
    scrollPhase: number;
    velocity: number;
}

type Subscriber = (snap: ScrollSnapshot) => void;

const subscribers = new Set<Subscriber>();
let rafId = 0;
let lastScrollY = 0;
let cachedVh = 0;
let listenersAttached = false;

function readVh() {
    if (typeof window === "undefined") return 0;
    return window.innerHeight || document.documentElement.clientHeight || 0;
}

function tick() {
    rafId = 0;
    const scrollY = window.scrollY;
    const vh = cachedVh || readVh();
    const scrollPhase = vh > 0 ? Math.min(1, Math.max(0, scrollY / (2 * vh))) : 0;
    const velocity = scrollY - lastScrollY;
    lastScrollY = scrollY;

    const snap: ScrollSnapshot = { scrollY, vh, scrollPhase, velocity };
    for (const cb of subscribers) cb(snap);
}

function onScroll() {
    if (rafId === 0) rafId = requestAnimationFrame(tick);
}

function onResize() {
    cachedVh = readVh();
}

function attach() {
    if (listenersAttached || typeof window === "undefined") return;
    cachedVh = readVh();
    lastScrollY = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    listenersAttached = true;
}

function detach() {
    if (!listenersAttached) return;
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    listenersAttached = false;
}

/**
 * Imperative subscription primitive — for callers that prefer plain
 * useEffect over a hook, or that need to subscribe outside React (rare).
 * Returns an unsubscribe function. Most components should use the
 * `useScrollBus` hook below instead.
 */
export function subscribeScroll(callback: Subscriber): () => void {
    subscribers.add(callback);
    attach();
    if (typeof window !== "undefined") {
        const vh = cachedVh || readVh();
        const scrollY = window.scrollY;
        const scrollPhase =
            vh > 0 ? Math.min(1, Math.max(0, scrollY / (2 * vh))) : 0;
        callback({ scrollY, vh, scrollPhase, velocity: 0 });
    }
    return () => {
        subscribers.delete(callback);
        if (subscribers.size === 0) detach();
    };
}

/**
 * Subscribe to the scroll bus. The callback is stored in a ref so changing
 * its identity between renders does not re-register. The most recent
 * callback is always invoked.
 *
 * The first subscriber attaches the window listeners; the last one to
 * unsubscribe detaches them.
 */
export function useScrollBus(callback: Subscriber) {
    const cbRef = useRef(callback);
    // Sync the latest callback into the ref via an effect (no deps) so we
    // never write to a ref during render. The subscriber registered below
    // forwards calls to whatever is in cbRef at call time.
    useEffect(() => {
        cbRef.current = callback;
    });

    useEffect(() => {
        // The Subscriber stored in the Set must be a stable function for
        // the lifetime of this hook so cleanup removes the same identity
        // we added. We forward calls to the latest callback via cbRef.
        const fn: Subscriber = (snap) => cbRef.current(snap);
        subscribers.add(fn);
        attach();
        // Fire once on mount so consumers get an initial snapshot
        // without waiting for the first scroll event.
        if (typeof window !== "undefined") {
            const vh = cachedVh || readVh();
            const scrollY = window.scrollY;
            const scrollPhase =
                vh > 0 ? Math.min(1, Math.max(0, scrollY / (2 * vh))) : 0;
            fn({ scrollY, vh, scrollPhase, velocity: 0 });
        }
        return () => {
            subscribers.delete(fn);
            if (subscribers.size === 0) detach();
        };
    }, []);
}
