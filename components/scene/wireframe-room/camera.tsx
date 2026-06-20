// Extracted from WireframeRoom.tsx (mechanical split — no logic changes).
import * as THREE from "three";
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { DOLLY_OFFSET, DOLLY_LAMBDA, FOV_START, FOV_OVERSHOOT, FOV_END, FOV_OVERSHOOT_DURATION, PULLBACK_DISTANCE } from "./constants";
import { flyEasing } from "./easing";

/**
 * Camera dolly — animates camera.position.z from a zoomed-in
 * starting position (closer to the torus) to the resting pull-back
 * position when `revealed` becomes true. Creates a cinematic
 * "emergence" where the viewer starts inside the scene and the
 * camera pulls out to reveal the full corridor.
 * Uses MathUtils.damp for smooth exponential decay (no overshoot).
 */
export function CameraDolly({
    restZ,
    revealed,
    scrollPhase,
    ch2Phase,
    activeChapter,
    reducedMotion = false,
    roomH,
}: {
    restZ: number;
    revealed: boolean;
    scrollPhase?: React.RefObject<number>;
    ch2Phase?: React.RefObject<number>;
    activeChapter?: React.RefObject<number>;
    ch2T?: React.RefObject<number>;
    reducedMotion?: boolean;
    roomH: number;
    scrollVelocity?: React.RefObject<number>;
}) {
    const posZ = useRef(restZ + DOLLY_OFFSET);
    const posY = useRef(0);
    const fov = useRef(FOV_START);
    const revealedTime = useRef<number | null>(null);
    const _lookAt = useMemo(() => new THREE.Vector3(0, 0, 0), []);

    // Smooth lookAt Y for the floor-tilt transition
    const smoothLookAtY = useRef(0);
    const smoothLookAtZ = useRef(-34);

    useFrame(({ camera }, delta) => {
        const dt = Math.min(delta, 0.05);
        const dollyLambda = reducedMotion ? DOLLY_LAMBDA * 20 : DOLLY_LAMBDA;
        const sp = scrollPhase?.current ?? 0;
        const ac = activeChapter?.current ?? 0;
        const ph2 = ch2Phase?.current ?? 0;

        // FOV overshoot then settle to FOV_END across all chapters.
        if (revealed && revealedTime.current === null) {
            revealedTime.current = performance.now();
        }
        const timeSinceReveal =
            revealedTime.current !== null ? (performance.now() - revealedTime.current) / 1000 : 0;
        const fovBase = revealed
            ? timeSinceReveal > FOV_OVERSHOOT_DURATION
                ? FOV_END
                : FOV_OVERSHOOT
            : FOV_START;

        // Hero / Ch1 pull-back baseline — used for stage A (start of
        // Ch2 transition) so the storyboard begins from wherever Ch1
        // settled.
        const pullbackT = Math.min(1, sp * 2);
        const ch1Pullback = ac === 0 ? flyEasing(pullbackT) * PULLBACK_DISTANCE : PULLBACK_DISTANCE;
        const ch1Z = revealed ? restZ + ch1Pullback : restZ + DOLLY_OFFSET;

        // Floor world Y (the camera will tip down to look at this).
        const floorY = -roomH / 2;

        // ───────────────────────────────────────────────────────
        // Ch1 → Ch2 storyboard, locked to scroll (ph2).
        // Single PARALLEL beat: tilt-down + pull-back + FOV zoom-in
        // ALL animate simultaneously across ph2 0 → 1.0.
        // ───────────────────────────────────────────────────────

        // End-state positions.
        const TILT_Z = restZ + PULLBACK_DISTANCE + 2; // ≈ -3 — same back-out as old stage A
        const ZOOM_Y = 0;
        const ZOOM_FOV = 48; // narrowed FOV at end of zoom

        // Single parallel ramp — everything moves together across ph2 0 → 1.
        // Quadratic ease-out: fast at the start, decelerating into the
        // settle. The previous smoothstep eased BOTH ends, so the
        // rotation crawled at the start. ease-out hits the floor view
        // sooner and lands with cinematic deceleration into the snap.
        //   smoothstep(0,1,0.5) = 0.50  (linear feel at midpoint)
        //   easeOutQuad(0.5)    = 0.75  (75% of motion done at midpoint)
        const tParallel = 1 - (1 - ph2) * (1 - ph2);
        const camZ = THREE.MathUtils.lerp(ch1Z, TILT_Z, tParallel);
        // lookAt pitches from forward (Z=-34) to straight-down at the
        // current camera Z. Y goes from 0 to just above floor.
        const lookYTarget = THREE.MathUtils.lerp(0, floorY + 0.2, tParallel);

        // FOV narrows in parallel with the tilt + pullback.
        const camY = THREE.MathUtils.lerp(0, ZOOM_Y, tParallel);
        const targetFov = THREE.MathUtils.lerp(fovBase, ZOOM_FOV, tParallel);

        // gaze stays locked on the floor under the camera.
        const lookY = lookYTarget;

        // Camera idle-bob removed — the slow in/out breath read as a
        // distracting drift after settle. Keeping camY pinned to the
        // computed target value gives a clean held floor shot.

        posZ.current = THREE.MathUtils.damp(posZ.current, camZ, dollyLambda, dt);
        posY.current = THREE.MathUtils.damp(posY.current, camY, 5, dt);
        camera.position.set(0, posY.current, posZ.current);

        // For straight-down gaze, lookAt.z must equal the actual
        // (damped) camera.z, not the target — otherwise during the
        // damping there's a slight angle. Use camera.position.z.
        // Blend amount tracks the parallel storyboard progress.
        const finalLookZ = THREE.MathUtils.lerp(-34, posZ.current, tParallel);
        smoothLookAtY.current = THREE.MathUtils.damp(smoothLookAtY.current, lookY, 5, dt);
        smoothLookAtZ.current = THREE.MathUtils.damp(smoothLookAtZ.current, finalLookZ, 5, dt);
        _lookAt.set(0, smoothLookAtY.current, smoothLookAtZ.current);
        camera.lookAt(_lookAt);

        fov.current = THREE.MathUtils.damp(fov.current, targetFov, dollyLambda * 0.8, dt);
        if ("fov" in camera) {
            (camera as THREE.PerspectiveCamera).fov = fov.current;
            (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
        }
    });
    return null;
}

/**
 * ChapterFade — disabled. Previously faded walls + ceiling out across
 * Ch2 transition; the user prefers the room to remain fully visible
 * during the floor-tilt + zoom-in. Holds ch2T at 0 so consumers
 * (FaceGrid walls, ceiling) keep their full-opacity Ch1 state.
 */
export function ChapterFade({
    ch2Phase: _ch2Phase,
    ch2T,
}: {
    ch2Phase?: React.RefObject<number>;
    ch2T: React.RefObject<number>;
}) {
    useFrame((_, delta) => {
        const dt = Math.min(delta, 0.05);
        // Walls + ceiling stay fully visible. Damp toward 0 in case
        // ch2T was previously left at a non-zero value. `ch2T` is a shared
        // writable ref-as-prop driven from the frame loop (consider renaming
        // to `ch2TRef` to satisfy the convention the rule enforces).
        // eslint-disable-next-line react-hooks/immutability -- writable ref-as-prop mutated in useFrame
        ch2T.current = THREE.MathUtils.damp(ch2T.current, 0, 4, dt);
    });
    return null;
}

/**
 * Ch2FloorVisibility — wraps the 3D floor `FaceGrid` and toggles its
 * `<group>`'s `visible` attribute based on `chapter2Phase`.
 *
 * Why a binary toggle instead of an alpha-fade: `FaceGrid`'s materials
 * don't set `transparent={true}` (and several of them — notably the
 * cross/plus marks — have `depthTest=false`), so multiplying their
 * `.opacity` does nothing. Toggling group `visible` is the only
 * reliable way to make the floor disappear from the render entirely,
 * which we need because those depth-test-disabled cross marks would
 * otherwise punch through the body silhouette during the close-up.
 *
 *   chapter2Phase < 0.05  → visible  (Hero / Ch1 / Ch2Intro orbit — ground reference visible)
 *   chapter2Phase ≥ 0.05  → hidden   (paper has slid up, body close-up reads cleanly)
 *
 * Threshold matches the paper plane's slide-in completion (chapter2Phase
 * = 0.05 per Ch2BackgroundGrid). Reverse-scrolling brings the floor
 * back symmetrically.
 */
export function Ch2FloorVisibility({
    chapter2Phase,
    children,
}: {
    chapter2Phase?: React.RefObject<number>;
    children: React.ReactNode;
}) {
    const groupRef = useRef<THREE.Group>(null);
    useFrame(() => {
        if (!groupRef.current) return;
        const ph = chapter2Phase?.current ?? 0;
        groupRef.current.visible = ph < 0.05;
    });
    return <group ref={groupRef}>{children}</group>;
}
