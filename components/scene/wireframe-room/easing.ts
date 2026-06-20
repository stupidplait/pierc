// Extracted from WireframeRoom.tsx (mechanical split — no logic changes).
export function flyEasing(sp: number): number {
    const t = Math.max(0, Math.min(1, sp));
    return 1 - Math.pow(1 - t, 3);
}

/* Smoothstep — eases the start and end of every keyframe segment so
   the multi-stage camera move flows instead of stepping. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}
