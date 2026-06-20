/**
 * coverflow-geometry — pure, framework-free geometry for the gallery coverflow
 * ring. Shared by the entrance SSR style (GalleryCoverflow) and the runtime
 * renderer (useCoverflow) so both agree on exactly where every card sits. No
 * React, no DOM — just maths, safe to import anywhere.
 */

export type CardGeom = { x: number; scale: number; opacity: number; zIndex: number };

// vw between adjacent cards at rest.
export const STEP_VW = 46;

// Shortest signed delta from `from` to integer card `i` on a ring of `n`.
// Result is in (-n/2, n/2]. Each card renders at most n/2 steps away — that's
// what makes the strip read as infinite.
export function ringDelta(i: number, from: number, n: number): number {
    const raw = i - from;
    const mod = ((raw % n) + n) % n;
    return mod > n / 2 ? mod - n : mod;
}

// Pure geometry for a card at signed ring-distance `d` from centre.
export function cardGeom(d: number): CardGeom {
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

export const geomTransform = (g: CardGeom) =>
    `translate(-50%, -50%) translateX(${g.x}vw) scale(${g.scale})`;
