"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Edges, Environment, Html, Lightformer, Line, MeshTransmissionMaterial, Text, useGLTF } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import FluidTrailEffect from "./FluidTrailEffect";
import { ANCHORS_LOCAL, MODEL_SCALE, MODEL_Y_OFFSET } from "./BodyModel";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/**
 * Detects prefers-reduced-motion at mount. Returns true if the user
 * has requested reduced motion (accessibility / vestibular disorders).
 */
function useReducedMotion(): boolean {
    // Use ref to avoid re-rendering the entire Canvas subtree when
    // prefers-reduced-motion changes at runtime (very rare event).
    const ref = useRef(false);
    const [, forceUpdate] = useState(0);
    useEffect(() => {
        const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
        ref.current = mql.matches;
        forceUpdate((n) => n + 1);
        const onChange = (e: MediaQueryListEvent) => {
            ref.current = e.matches;
            forceUpdate((n) => n + 1);
        };
        mql.addEventListener("change", onChange);
        return () => mql.removeEventListener("change", onChange);
    }, []);
    return ref.current;
}

/**
 * Fires onReady after N rendered frames. Must be placed INSIDE a
 * Suspense boundary so it only mounts once suspended assets (fonts)
 * have loaded — this way it naturally combines "assets loaded" with
 * "GPU warmed up" into a single signal.
 */
function ReadinessSignal({ onReady, frames = 5 }: { onReady: () => void; frames?: number }) {
    const count = useRef(0);
    const fired = useRef(false);
    useFrame(() => {
        if (fired.current) return;
        count.current++;
        if (count.current >= frames) {
            fired.current = true;
            onReady();
        }
    });
    return null;
}

/**
 * Camera dolly — animates camera.position.z from a zoomed-in
 * starting position (closer to the torus) to the resting pull-back
 * position when `revealed` becomes true. Creates a cinematic
 * "emergence" where the viewer starts inside the scene and the
 * camera pulls out to reveal the full corridor.
 * Uses MathUtils.damp for smooth exponential decay (no overshoot).
 */
const DOLLY_OFFSET = -6; // units CLOSER at start (negative = toward back wall)
const DOLLY_LAMBDA = 4; // damp rate for camera-Z + jewelry-Z tracking.
// Bumped from the historical 1.5 once readLayout was moved into the
// smooth-scroll tick(): phases now arrive in lock-step with the
// smoothed currentScroll, so this damper only needs to soak out
// single-frame jitter, not provide the cinematic glide. The previous
// 1.5 produced visible camera-Z stepping during fast wheel input
// because it double-smoothed an already-smoothed scroll input.
const FOV_START = 50; // narrow FOV at start (zoomed in)
const FOV_OVERSHOOT = 62; // briefly wider than rest (cinematic breathing)
const FOV_END = 60; // normal FOV at rest
const FOV_OVERSHOOT_DURATION = 0.5; // seconds to hold overshoot before settling

/* Chapter-1 pull-back — the camera dollies BACK away from the exhibit
   as the user scrolls hero→Chapter 1, revealing the full room around
   the fixed exhibit at the back. Hero is the intimate close-up of the
   exhibit; Chapter 1 is the wide gallery shot that contextualises it. */
const PULLBACK_DISTANCE = 16; // chapter 1 pullback — camera Z increases by this
const PULLBACK_CHAPTER_2 = 22; // chapter 2 pullback — bit further back than chapter 1
// so the zoom-out continues across chapters rather than
// lurching forward when leaving Chapter 1
const PULLBACK_CHAPTER_3 = 26; // chapter 3 pullback — final dolly back so the entire
// room frames the climax. Visitor sees the corridor
// they came through, the podium, the dossier in front.
/* EXHIBIT_Z sits *behind* the hero camera (-21) and *in front of* the
   chapter-1 camera (-5). In hero it's behind the lens (invisible);
   as the camera pulls back past z=-12 the podium organically comes
   into view in the lower half of frame. Tuned close to the chapter-1
   camera (distance 7) so the exhibit reads prominently without the
   need for a fade animation. */
const EXHIBIT_Z = -12;
const HERO_RING_Z = -27; // hero floating-ring position — close to camera for original size

/* Ring drifts back from HERO_RING_Z to EXHIBIT_Z as user scrolls hero→Ch1
   so it lands on the podium when the camera arrives at the wide gallery
   shot. Hero ring stays at original close-up size; chapter 1 ring sits
   on the exhibit. */

/* Ease-out cubic — fast initial burst, decelerating finish. Combined with
   the dolly damping below this gives a snappy, "very fast" feel at the
   start of the motion that settles cleanly into the final composition. */
function flyEasing(sp: number): number {
    const t = Math.max(0, Math.min(1, sp));
    return 1 - Math.pow(1 - t, 3);
}

/* Ch2 close-up framing constants. The head-Y derivation that lived
   here was used by the (now-retired) 3D body materialisation; only
   the orbital framing constants are still consumed by CameraDolly's
   stage-D held-floor view. */
const CH2_ORBIT_RADIUS = 3.2;
const CH2_ORBIT_SPEED = 0.18; // rad/s — ~10°/s, post-storyboard
const CH2_FOV = 28; // narrow → portrait compression, walls outside cone

/* Smoothstep — eases the start and end of every keyframe segment so
   the multi-stage camera move flows instead of stepping. */
function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

function CameraDolly({
    restZ,
    revealed,
    scrollPhase,
    ch2Phase,
    activeChapter,
    ch2T,
    reducedMotion = false,
    roomH,
    scrollVelocity,
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

    useFrame(({ camera, clock }, delta) => {
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
        const lookZTarget = THREE.MathUtils.lerp(-34, camZ, tParallel);

        // FOV narrows in parallel with the tilt + pullback.
        let camY = THREE.MathUtils.lerp(0, ZOOM_Y, tParallel);
        let targetFov = THREE.MathUtils.lerp(fovBase, ZOOM_FOV, tParallel);

        // gaze stays locked on the floor under the camera.
        let lookY = lookYTarget;
        let lookZ = lookZTarget;

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
function ChapterFade({
    ch2Phase: _ch2Phase,
    ch2T,
}: {
    ch2Phase?: React.RefObject<number>;
    ch2T: React.RefObject<number>;
}) {
    useFrame((_, delta) => {
        const dt = Math.min(delta, 0.05);
        // Walls + ceiling stay fully visible. Damp toward 0 in case
        // ch2T was previously left at a non-zero value.
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
function Ch2FloorVisibility({
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

/**
 * PinkRimLight — directional light gated by ch2Phase stage D. Reads
 * as a magenta catchlight on cheekbone + jewelry during the Ch2
 * close-up. Intensity ramps in only after the body has materialized
 * so the rim sweep coincides with the body becoming visible.
 */
function PinkRimLight({ ch2Phase }: { ch2Phase?: React.RefObject<number> }) {
    const ref = useRef<THREE.DirectionalLight>(null);
    useFrame(() => {
        if (!ref.current) return;
        const ph2 = ch2Phase?.current ?? 0;
        const t = Math.max(0, Math.min(1, (ph2 - 0.72) / (1.0 - 0.72)));
        const eased = t * t * (3 - 2 * t);
        ref.current.intensity = eased * 0.8;
    });
    return (
        <directionalLight
            ref={ref}
            position={[3, 16, EXHIBIT_Z + 4]}
            color="#f06ba0"
            intensity={0}
        />
    );
}

/* RoomRotation removed — walls are now static, no scroll-driven rotation */

/**
 * Ch2BackgroundGrid — fullscreen camera-relative plane rendered inside
 * the R3F canvas as part of Chapter 2's drafting-paper background.
 *
 * Lives in the 3D scene so the FluidTrailEffect post-process pass
 * (cursor-following fluid distortion) affects it on hover, the same
 * way it affects the dark room. A standalone HTML overlay would sit
 * outside the canvas → no fluid trail.
 *
 * The plane is positioned in front of the camera each frame and
 * scaled to fill the viewport. The shader works in SCREEN-SPACE
 * PIXEL COORDINATES (via gl_FragCoord) — not plane UVs — so cells
 * are square regardless of viewport aspect ratio and lines stay
 * pixel-perfect crisp. Two layers:
 *
 *   1. Minor grid lines — 80 CSS-pixel cells, 1-pixel wide hairlines
 *   2. Plus marks at every intersection — 5-px arm length, 1-px wide
 *
 * Both layers are scroll-translated by `chapter2Phase`. Plus marks
 * scroll at 1.10 × the grid speed (10 % parallax). With viewport-
 * height-based scroll distance, by the end of Chapter 2 the pluses
 * have drifted ~1.35 cells off the line intersections — visibly
 * detached but still legible.
 *
 * Opacity ramps in across `chapter2Phase` 0.00 → 0.10 so the plane
 * fades up as the user starts scrolling into Chapter 2.
 */
function Ch2BackgroundGrid({
    chapter2Phase,
}: {
    chapter2Phase?: React.RefObject<number>;
}) {
    const meshRef = useRef<THREE.Mesh>(null);
    const matRef = useRef<THREE.ShaderMaterial>(null);
    // Smoothed phase — damps the raw chapter2Phase to absorb scroll-
    // bar jumps. Same time constant as Ch2BodyModel so the grid + body
    // animate in lockstep.
    const smoothPh = useRef(0);

    const uniforms = useMemo(
        () => ({
            uGridOffset: { value: 0 },
            uPlusOffset: { value: 0 },
            // Warm light beige — softer than #fafafa, kills the
            // "flash" when transitioning from the dark Ch2Intro room
            // into the Chapter 2 paper, while still reading as a
            // light surface.
            uPaperColor: { value: new THREE.Color("#e8e5dd") },
            uLineColor: { value: new THREE.Color("#000000") },
            uLineAlpha: { value: 0.12 },
            uPlusAlpha: { value: 0.24 },
            uCellSize: { value: 80 }, // minor cell, CSS pixels
            // Tile = 5 × 5 minor cells. Plus marks land at tile corners
            // only — i.e., at every 5-cell major intersection, mirroring
            // the 3D floor's subsPerCell = 5 layout.
            uTileCells: { value: 5 },
            uPxRatio: { value: 1 },
        }),
        []
    );

    useFrame(({ camera, gl, size }, delta) => {
        if (!meshRef.current || !matRef.current) return;
        const dt = Math.min(delta, 0.05);
        const targetPh = chapter2Phase?.current ?? 0;
        smoothPh.current = THREE.MathUtils.damp(smoothPh.current, targetPh, 12, dt);
        const ph = smoothPh.current;

        // Plane is invisible until the user starts crossing into
        // Chapter 2. Once visible, it slides up from below the viewport
        // — no opacity transition, just plain translation.
        meshRef.current.visible = ph > 0.001;
        if (!meshRef.current.visible) return;

        const distance = 4;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

        // Anchor plane in front of camera.
        meshRef.current.position
            .copy(camera.position)
            .add(forward.multiplyScalar(distance));
        meshRef.current.quaternion.copy(camera.quaternion);

        // Size to viewport at the chosen distance, with a 5% overscale.
        let planeHeight = 1;
        if ("fov" in camera && "aspect" in camera) {
            const persp = camera as THREE.PerspectiveCamera;
            planeHeight = 2 * Math.tan((persp.fov * Math.PI) / 360) * distance;
            const planeWidth = planeHeight * persp.aspect;
            meshRef.current.scale.set(planeWidth * 1.05, planeHeight * 1.05, 1);
        }

        // Slide-in: plane starts ~1.05 viewport-heights below the
        // viewport (entirely off-screen at the bottom) and slides up
        // until it fills the viewport. Slide completes by phase = 0.05
        // — extremely brisk, so even a tiny amount of scroll past
        // Ch2Intro brings the paper almost all the way up. Avoids the
        // "limbo" look at the Chapter 2 top snap target where the paper
        // would otherwise still be entirely below the viewport.
        const slideProgress = Math.min(1, ph / 0.05);
        const slideOffset = -(1 - slideProgress) * planeHeight * 1.05;
        meshRef.current.position.add(up.multiplyScalar(slideOffset));

        // Drive shader uniforms. Both offsets in CSS pixels. NEGATIVE
        // sign so the pattern translates UPWARD as the user scrolls
        // down. Slow ambient drift — 0.20 × vh of grid travel per
        // full chapter scroll-through. Plus marks lead at 1.45 ×.
        const u = matRef.current.uniforms;
        const vh = size.height;
        const baseTravel = vh * 0.20;
        const targetGrid = -ph * baseTravel;
        const targetPlus = -ph * baseTravel * 1.45;
        u.uGridOffset.value = THREE.MathUtils.damp(
            u.uGridOffset.value,
            targetGrid,
            12,
            dt
        );
        u.uPlusOffset.value = THREE.MathUtils.damp(
            u.uPlusOffset.value,
            targetPlus,
            12,
            dt
        );
        u.uPxRatio.value = gl.getPixelRatio();
    });

    const vertexShader = /* glsl */ `
        void main() {
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    // Pixel-space shader. Uses gl_FragCoord for true viewport-pixel
    // coordinates, so line widths and plus dimensions are exact at
    // any plane scale, any FOV, any aspect ratio. Antialiasing via
    // a 0.5-px smoothstep band gives sharp-but-not-aliased edges.
    const fragmentShader = /* glsl */ `
        precision highp float;
        uniform float uGridOffset;
        uniform float uPlusOffset;
        uniform vec3 uPaperColor;
        uniform vec3 uLineColor;
        uniform float uLineAlpha;
        uniform float uPlusAlpha;
        uniform float uCellSize;
        uniform float uTileCells;
        uniform float uPxRatio;

        // Mask for a hairline grid: 1 inside the line, 0 elsewhere,
        // with a 0.5-px AA band. lineHalf is the line's half-width.
        float gridMask(vec2 p, float cell, float lineHalf, float aa) {
            vec2 g = mod(p, cell);
            vec2 d = min(g, cell - g);
            // Distance to nearest grid line on each axis.
            float lx = 1.0 - smoothstep(lineHalf, lineHalf + aa, d.x);
            float ly = 1.0 - smoothstep(lineHalf, lineHalf + aa, d.y);
            return max(lx, ly);
        }

        // Plus mark: cross-shaped stamp at every TILE corner (a tile
        // is uTileCells × uTileCells minor cells). Mirrors the 3D
        // floor's plus-marks-at-major-intersections layout.
        float plusMask(vec2 p, float tile, float armLength, float armHalf, float aa) {
            vec2 g = mod(p, tile);
            vec2 d = min(g, tile - g);
            // Horizontal arm: within armLength on x AND within armHalf on y.
            float hx = 1.0 - smoothstep(armLength, armLength + aa, d.x);
            float hy = 1.0 - smoothstep(armHalf, armHalf + aa, d.y);
            float horiz = hx * hy;
            // Vertical arm: swap roles.
            float vx = 1.0 - smoothstep(armHalf, armHalf + aa, d.x);
            float vy = 1.0 - smoothstep(armLength, armLength + aa, d.y);
            float vert = vx * vy;
            return max(horiz, vert);
        }

        void main() {
            // Convert framebuffer pixels → CSS pixels by dividing out
            // device pixel ratio. Keeps line widths device-independent.
            vec2 fragPx = gl_FragCoord.xy / uPxRatio;

            float cell = uCellSize;
            float tile = cell * uTileCells;     // 80 × 5 = 400 CSS px
            float aa = 0.6;                     // AA band width (CSS px)
            float lineHalf = 0.5;               // 1-px line ⇒ half-width 0.5
            float armLength = 7.0;              // 14-px total arm
            float armHalf = 0.7;                // 1.4-px thick arm

            // Grid layer — scroll-translated.
            vec2 gridPx = fragPx + vec2(0.0, uGridOffset);
            float lineMask = gridMask(gridPx, cell, lineHalf, aa);

            // Plus layer — tile-corner only, scrolls 1.45 × grid speed.
            vec2 plusPx = fragPx + vec2(0.0, uPlusOffset);
            float plus = plusMask(plusPx, tile, armLength, armHalf, aa);

            vec3 col = uPaperColor;
            col = mix(col, uLineColor, lineMask * uLineAlpha);
            col = mix(col, uLineColor, plus * uPlusAlpha);

            gl_FragColor = vec4(col, 1.0);
        }
    `;

    return (
        <mesh ref={meshRef} frustumCulled={false}>
            <planeGeometry args={[1, 1]} />
            <shaderMaterial
                ref={matRef}
                uniforms={uniforms}
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
            />
        </mesh>
    );
}

/**
 * Ch2BodyModel — Chapter 2 mannequin reveal.
 *
 * Body lies flat on the drafting paper (Option A). Camera at Ch2Intro
 * end-state is gazing straight down, so the body's local-Y axis is
 * remapped to the camera-up direction. Result: from the user's POV
 * the body appears upright on screen, lying on the paper plane.
 *
 * Choreography keyed to chapter2Phase:
 *   • 0.00 → 0.05  hidden (grid is sliding up from below)
 *   • 0.05 → 0.40  body slides in from far-right while spinning
 *                  clockwise (from above) for 2 full rotations.
 *                  Cubic ease-out: fast initial movement,
 *                  decelerating into the settle. Spin and slide use
 *                  the same eased curve so they finish together.
 *   • 0.40 → 1.00  body holds at off-center-right (1/3 from right).
 *
 * Position is camera-relative (parent group tracks camera basis each
 * frame). Body is offset y=-0.85 inside an inner group so the spin
 * axis runs through its centre of mass instead of the floor.
 */

/**
 * Static anchor data for Chapter 2's left-profile dots. Subset of
 * `prisma/seed-data/anchors.json` — only the anchors that face the
 * camera in the left-profile pose. Positions + rotations are in the
 * GLB's body-local coordinate system, so they slot directly into
 * the inner-offset group as JSX <mesh> position props.
 */
type Ch2Anchor = {
    slug: string;
    name: string; // Russian display name shown on hover
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
};

const CH2_VISIBLE_ANCHORS: Ch2Anchor[] = [
    // Ear anchors — kept in sync with prisma/seed-data/anchors.json.
    // The ear cartilage on body.glb sits at glTF Y 1.555..1.605, Z -0.020..-0.045
    // (i.e. behind the cheek plane). See scripts/anchors/fix-ear-positions.mjs.
    { slug: "left-ear-lobe",   name: "Левая мочка",    position: { x: 0.0711, y: 1.5479, z: -0.0164 }, rotation: { x: 0, y: 1.5708, z: 0 } },
    { slug: "left-helix",      name: "Хеликс",         position: { x: 0.0848, y: 1.5883, z: -0.0364 }, rotation: { x: 0, y: 1.5708, z: 0 } },
    { slug: "left-tragus",     name: "Трагус",         position: { x: 0.0718, y: 1.5677, z: -0.0135 }, rotation: { x: 0, y: 1.5708, z: 0 } },
    { slug: "left-conch",      name: "Конха",          position: { x: 0.0774, y: 1.5711, z: -0.0317 }, rotation: { x: 0, y: 1.5708, z: 0 } },
    { slug: "left-rook",       name: "Рок",            position: { x: 0.0769, y: 1.5852, z: -0.0248 }, rotation: { x: 0, y: 1.5708, z: 0 } },
    { slug: "left-daith",      name: "Дайт",           position: { x: 0.0707, y: 1.5731, z: -0.0217 }, rotation: { x: 0, y: 1.5708, z: 0 } },
    { slug: "left-industrial", name: "Индастриал",     position: { x: 0.0768, y: 1.5936, z: -0.0223 }, rotation: { x: 0, y: 1.5708, z: 0 } },
    { slug: "septum",          name: "Септум",         position: { x: 0, y: 1.53, z: 0.0822 },        rotation: { x: 0, y: 0, z: 0 } },
    { slug: "left-nostril",    name: "Ноздря",         position: { x: 0.011, y: 1.557, z: 0.08 },    rotation: { x: 0, y: 0, z: 0 } },
    { slug: "left-eyebrow",    name: "Бровь",          position: { x: 0.03, y: 1.598, z: 0.071 },      rotation: { x: 0, y: 0, z: 0 } },
    { slug: "lip-medusa",      name: "Медуза",         position: { x: 0, y: 1.536, z: 0.08 },        rotation: { x: 0, y: 0, z: 0 } },
    { slug: "lip-labret",      name: "Лабрет",         position: { x: 0, y: 1.512, z: 0.072 },        rotation: { x: 0, y: 0, z: 0 } },
];

const CH2_DEFAULT_LOBE: Ch2Anchor | null =
    CH2_VISIBLE_ANCHORS.find((a) => a.slug === "left-ear-lobe") ?? null;

/* ── Anchor marker ─────────────────────────────────────────────
   Combined "surgical target + labeled" design:
     - tiny filled core (~3 mm world after body scale)
     - thin outer ring (~9 mm world) — magenta accent on hover/select
     - hover-only Russian label as drei <Html> overlay

   State (selected, hovered) lives in Ch2BodyModel; this component
   just renders + attaches pointer handlers.
   ─────────────────────────────────────────────────────────────── */
function Ch2AnchorMarker({
    name,
    position,
    rotation,
    selected,
    hovered,
    onSelect,
    onHover,
}: {
    name: string;
    position: [number, number, number];
    rotation: [number, number, number];
    selected: boolean;
    hovered: boolean;
    onSelect: () => void;
    onHover: (entered: boolean) => void;
}) {
    const groupRef = useRef<THREE.Group>(null);

    const handlers = {
        onPointerDown: (e: { stopPropagation: () => void }) => {
            e.stopPropagation();
            onSelect();
        },
        onPointerOver: (e: { stopPropagation: () => void }) => {
            e.stopPropagation();
            onHover(true);
            if (typeof document !== "undefined") {
                document.body.style.cursor = "pointer";
            }
        },
        onPointerOut: () => {
            onHover(false);
            if (typeof document !== "undefined") {
                document.body.style.cursor = "";
            }
        },
    };

    const accent = "#ff5e9c";

    // Sizes are in body-LOCAL units; bodyRef.scale ≈9.5 maps these
    // to world units roughly 1 body-local unit ≈ 9.5 world units.
    //   core radius   0.0008  → ~7.6 mm world
    //   ring inner    0.0022  → ~21 mm world
    //   ring outer    0.0025  → ~23.75 mm world (2.85 mm stroke)
    const coreRadius = 0.0008;
    const ringInner = 0.0022;
    const ringOuter = 0.0025;

    useFrame(() => {
        if (!groupRef.current) return;
        // Hover scales the group up so the dot reads as actionable.
        // Selected — no special scale animation (the jewelry at that
        // anchor is the visual indicator; we hide the marker entirely
        // below so it doesn't overlap the ring).
        if (hovered) {
            groupRef.current.scale.setScalar(1.3);
        } else {
            groupRef.current.scale.setScalar(1);
        }
    });

    return (
        <group
            ref={groupRef}
            position={position}
            rotation={rotation}
            {...handlers}
            userData={{ ch2Marker: true }}
        >
            {/* Marker visuals — hidden when this anchor is selected
                because the jewelry mounted at that anchor is already
                the visual indicator. Showing the marker on top would
                overlap and obscure the jewelry. */}
            {!selected && (
                <>
                    {/* Filled core dot */}
                    <mesh renderOrder={1000}>
                        <sphereGeometry args={[coreRadius, 14, 14]} />
                        <meshBasicMaterial
                            color={hovered ? "#ffffff" : accent}
                            toneMapped={false}
                            depthTest={false}
                            transparent
                            opacity={1}
                        />
                    </mesh>

                    {/* Outer ring (hairline outline) */}
                    <mesh renderOrder={1000}>
                        <ringGeometry args={[ringInner, ringOuter, 40]} />
                        <meshBasicMaterial
                            color={hovered ? accent : "#888888"}
                            toneMapped={false}
                            depthTest={false}
                            transparent
                            opacity={hovered ? 1 : 0.6}
                            side={THREE.DoubleSide}
                        />
                    </mesh>
                </>
            )}

            {/* Hit volume — invisible, larger than visible marker so
                pointer events have an easy target. Also kept on
                selected anchors so the user can click them to keep
                them selected (idempotent). */}
            <mesh visible={false}>
                <sphereGeometry args={[ringOuter * 1.8, 8, 8]} />
                <meshBasicMaterial transparent opacity={0} />
            </mesh>

            {/* Hover-only label — close to the dot. */}
            {hovered && (
                <Html
                    position={[ringOuter * 1.3, 0, 0]}
                    center
                    style={{
                        pointerEvents: "none",
                        fontFamily:
                            "var(--font-mono), ui-monospace, monospace",
                        fontSize: "11px",
                        letterSpacing: "0.10em",
                        color: accent,
                        whiteSpace: "nowrap",
                        transformOrigin: "left center",
                        textTransform: "uppercase",
                        textShadow: "0 1px 6px rgba(0, 0, 0, 0.55)",
                    }}
                >
                    {name}
                </Html>
            )}
        </group>
    );
}

function Ch2BodyModel({
    chapter2Phase,
}: {
    chapter2Phase?: React.RefObject<number>;
}) {
    const parentRef = useRef<THREE.Group>(null);
    const bodyRef = useRef<THREE.Group>(null);
    // Smoothed phase — damped each frame toward the raw target. Hides
    // discontinuities when the user drags the scrollbar (which jumps
    // window.scrollY without going through the wheel-hijack loop).
    // Time constant ~83 ms — invisible on smooth wheel scroll, smooth
    // on fast scrollbar drags.
    const smoothPh = useRef(0);

    // Anchor selection state — selectedSlug persists across hover;
    // hoveredSlug is the live mouse-over target.
    const [selectedSlug, setSelectedSlug] = useState<string | null>(
        "left-ear-lobe",
    );
    const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);

    useFrame(({ camera }, delta) => {
        if (!parentRef.current || !bodyRef.current) return;
        const dt = Math.min(delta, 0.05);
        const targetPh = chapter2Phase?.current ?? 0;
        smoothPh.current = THREE.MathUtils.damp(smoothPh.current, targetPh, 12, dt);
        const ph = smoothPh.current;

        // Hard-toggle visible — no opacity animation.
        parentRef.current.visible = ph > 0.05;
        if (!parentRef.current.visible) return;

        // ── Slide-in already zoomed + opacity fade ───────────────
        // Body is at FINAL scale + Y position from frame one. X
        // slide-in + opacity fade animate concurrently — body enters
        // from off-screen-right at full ear-zoom scale and fades up
        // over the same window.
        //
        //   0.05 → 0.10   silent — empty paper, beat before reveal
        //   0.10 → 0.30   opacity 0 → 1 (fade in)
        //   0.10 → 0.65   cubic-eased X slide from off-screen right
        //                 to final anchor (no overshoot)
        //   0.65 → 1.00   held in final pose
        const slideRaw = (ph - 0.10) / (0.65 - 0.10);
        const slideClamped = Math.min(1, Math.max(0, slideRaw));
        const slideEased = 1 - Math.pow(1 - slideClamped, 3);

        const fadeRaw = (ph - 0.10) / (0.30 - 0.10);
        const fadeClamped = Math.min(1, Math.max(0, fadeRaw));
        const fadeEased = fadeClamped * fadeClamped * (3 - 2 * fadeClamped); // smoothstep
        const opacity = fadeEased;

        // Camera basis vectors in world space.
        const camFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

        // Plane distance from camera (closer than the grid plane at 4
        // so the body renders in front of it via standard depth test).
        const distance = 3.5;

        // Compute the visible viewport width in world units.
        let viewWidth = 6;
        if ("fov" in camera && "aspect" in camera) {
            const persp = camera as THREE.PerspectiveCamera;
            const viewHeight = 2 * Math.tan((persp.fov * Math.PI) / 360) * distance;
            viewWidth = viewHeight * persp.aspect;
        }

        // X positions: initial = far off-screen right (1.5× viewWidth
        // past final), final = off-centre-right (+viewWidth/6).
        const finalX = viewWidth / 6;
        const initialX = finalX + viewWidth * 1.5;
        const xOffset = THREE.MathUtils.lerp(initialX, finalX, slideEased);

        // Y offset: CONSTANT. Multiplier 0.85 — ear sits slightly
        // above viewport centre. Scale 9.5 — tighter zoom into the
        // ear region. Hair crops at top; that's the close-up trade-off.
        const earLocalY = 0.85;
        const targetScale = 9.5;
        const yOffset = -earLocalY * targetScale * 0.85;

        parentRef.current.position
            .copy(camera.position)
            .add(camFwd.clone().multiplyScalar(distance))
            .add(camRight.clone().multiplyScalar(xOffset))
            .add(camUp.clone().multiplyScalar(yOffset));

        // Parent orientation: align local Y with camera-up, then flip
        // 180° around Y.
        parentRef.current.quaternion.copy(camera.quaternion);
        const flipY = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            Math.PI
        );
        parentRef.current.quaternion.multiply(flipY);

        // Body rotation: profile pose from frame one (left ear toward camera).
        bodyRef.current.rotation.y = Math.PI / 2;

        // Scale: CONSTANT at full ear-zoom from frame one.
        bodyRef.current.scale.setScalar(targetScale);

        // Per-material fade. Each material caches its ORIGINAL `transparent`
        // + `opacity` on first visit (lazy, free after first frame). During
        // fade-in (opacity < 1) we force transparent rendering and multiply
        // the cached origOpacity by the fade factor — Cornea_*_Hidden has
        // origOpacity = 0 so it stays invisible throughout. Once fade-in
        // completes (opacity === 1) we RESTORE the original values, which
        // re-enables:
        //   • OPAQUE skin / eye iris materials (depth-sort behaves)
        //   • MASK cornea (invisible — was getting forced opaque before)
        //   • BLEND eyelash (alpha texture renders correctly)
        bodyRef.current.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (!mesh.isMesh) return;
            // Skip the anchor markers + jewelry — they stay at fixed
            // opacity (1) regardless of the body's slide-in fade.
            if (mesh.userData?.ch2Marker) return;
            const mats = (Array.isArray(mesh.material)
                ? mesh.material
                : [mesh.material]) as THREE.Material[];
            for (const mat of mats) {
                if (!mat) continue;
                type Cached = THREE.Material & {
                    __origTransparent?: boolean;
                    __origOpacity?: number;
                    opacity: number;
                    transparent: boolean;
                };
                const m = mat as Cached;
                if (m.__origTransparent === undefined) {
                    m.__origTransparent = m.transparent;
                    m.__origOpacity = m.opacity;
                }
                if (opacity < 1) {
                    m.transparent = true;
                    m.opacity = opacity * (m.__origOpacity ?? 1);
                } else {
                    m.transparent = m.__origTransparent;
                    m.opacity = m.__origOpacity ?? 1;
                }
            }
        });
    });

    return (
        <group ref={parentRef} visible={false}>
            {/* Three-point lighting that follows the body. Positions
                are local to the parent — which is camera-aligned with
                a 180° flip around Y, so:
                  +X = screen-left, -X = screen-right
                  +Y = screen-up
                  +Z = camera-forward (into the screen)
                  -Z = toward the viewer
                The directional lights aim toward the parent's origin
                (the body's centre of mass). */}
            <ambientLight intensity={0.55} />
            {/* Key light — front-right of body, slightly above */}
            <directionalLight
                position={[-2.5, 2.0, -2.0]}
                intensity={1.6}
                color="#ffffff"
            />
            {/* Fill light — front-left, warmer + softer */}
            <directionalLight
                position={[2.0, 1.0, -1.5]}
                intensity={0.7}
                color="#fff0e0"
            />
            {/* Rim light — behind the body, accents the silhouette */}
            <directionalLight
                position={[0.0, 1.5, 2.5]}
                intensity={0.85}
                color="#ffd5e6"
            />

            <group ref={bodyRef}>
                {/* Inner offset: shift the body down by half its height
                    so the spin axis runs through its centre of mass
                    rather than the floor between the feet. The offset
                    is in unscaled units; the parent's scale (driven
                    imperatively per-frame, ramping 1.8 → 3.5 during
                    the ear zoom) maps -0.85 → -1.53 → -2.97 in
                    rendered space, keeping the body's centre of mass
                    aligned with the parent origin throughout. */}
                <group position={[0, -0.85, 0]}>
                    <Suspense fallback={null}>
                        <Ch2BodyMesh />
                    </Suspense>

                    {/* Anchor markers as siblings of the body model.
                        Same coordinate space as the GLB scene root,
                        so positions from anchors.json work directly.
                        Inherits bodyRef.scale + parentRef camera-
                        relative transforms naturally. */}
                    {CH2_VISIBLE_ANCHORS.map((a) => (
                        <Ch2AnchorMarker
                            key={a.slug}
                            name={a.name}
                            position={[a.position.x, a.position.y, a.position.z]}
                            rotation={[a.rotation.x, a.rotation.y, a.rotation.z]}
                            selected={selectedSlug === a.slug}
                            hovered={hoveredSlug === a.slug}
                            onSelect={() => setSelectedSlug(a.slug)}
                            onHover={(h) => setHoveredSlug(h ? a.slug : null)}
                        />
                    ))}

                    {/* Default jewelry: small steel hoop. Follows the
                        currently-selected anchor (clicking a marker
                        moves the ring to that location). Position +
                        rotation come from anchors.json so the ring
                        naturally orients to the surface normal. */}
                    {(() => {
                        const target =
                            CH2_VISIBLE_ANCHORS.find(
                                (a) => a.slug === selectedSlug,
                            ) ?? CH2_DEFAULT_LOBE;
                        if (!target) return null;
                        return (
                            <mesh
                                key={target.slug}
                                position={[
                                    target.position.x,
                                    target.position.y,
                                    target.position.z,
                                ]}
                                rotation={[
                                    target.rotation.x,
                                    target.rotation.y,
                                    target.rotation.z,
                                ]}
                                userData={{ ch2Marker: true }}
                            >
                                <torusGeometry args={[0.0035, 0.0006, 12, 32]} />
                                <meshStandardMaterial
                                    color={0xeeeeee}
                                    metalness={1}
                                    roughness={0.22}
                                />
                            </mesh>
                        );
                    })()}
                </group>
            </group>
        </group>
    );
}

/**
 * Ch2BodyMesh — loads body.glb and mutates the cached scene to:
 *   1. Hide all anchor:* empties (same as catalog/BodyModel)
 *   2. Aggressively flatten the Hair_30629 material's specular response
 *      by mutating IN PLACE (preserves all textures: diffuse, alpha,
 *      normal, etc.). The previous approach of swapping in MeshBasic
 *      lost the diffuse texture in some GLTF configurations because
 *      different exporters put the colour map on different slots.
 *
 *      The CC3 hair material catches specular from every directional
 *      light and the Environment HDRI. We disable each contribution:
 *        - roughness = 1, metalness = 0 (matte PBR base)
 *        - envMapIntensity = 0 (no HDRI reflection at all)
 *        - normalScale = (0, 0) (kill normal-map-driven highlights)
 *        - clearcoat / sheen / transmission = 0 (kill MeshPhysical extras)
 *        - emissive = black (no self-glow)
 *
 *      Result: hair receives only diffuse light from the three keys,
 *      no specular sheen, no flash regardless of light angle.
 *
 * The cache is shared with /catalog so this also affects the catalog's
 * body. Acceptable trade — the original CC studio-HDRI specular only
 * made sense in that context.
 */
function Ch2BodyMesh({
    onAnchorFound,
}: {
    onAnchorFound?: (anchor: THREE.Object3D) => void;
}) {
    const gltf = useGLTF("/models/body/body.glb") as unknown as {
        scene: THREE.Group;
    };

    useEffect(() => {
        const created: THREE.Object3D[] = [];

        gltf.scene.traverse((obj: THREE.Object3D) => {
            if (obj.name?.startsWith("anchor:")) {
                // Anchor empties stay invisible — we render dots as
                // plain JSX siblings of the body using the catalog's
                // static anchor positions (see Ch2BodyModel). Attaching
                // children to GLB anchor empties parented to skeleton
                // bones doesn't render reliably across exporters.
                obj.visible = false;
                return;
            }
            const mesh = obj as THREE.Mesh;
            if (!mesh.isMesh || !mesh.name?.startsWith("Hair_")) return;

            const mats = (Array.isArray(mesh.material)
                ? mesh.material
                : [mesh.material]) as THREE.Material[];

            mats.forEach((raw) => {
                if (!raw) return;

                // Mutate IN PLACE — preserves baseColorTexture (the
                // actual blonde hair color from body.glb), normal map,
                // alpha, etc. Only the lighting response is flattened
                // so the WireframeRoom HDRI + 3-key rig don't blow out
                // specular highlights on the strands.
                //
                // CC3 hair imports as MeshStandardMaterial. We narrow
                // defensively to handle MeshPhysical extras too.
                const m = raw as THREE.MeshStandardMaterial &
                    Partial<THREE.MeshPhysicalMaterial>;

                m.roughness = 1;
                m.metalness = 0;
                if ("envMapIntensity" in m) {
                    m.envMapIntensity = 0;
                }
                if (m.normalScale) {
                    m.normalScale.set(0, 0);
                }
                if ("clearcoat" in m && typeof m.clearcoat === "number") {
                    m.clearcoat = 0;
                }
                if ("sheen" in m && typeof m.sheen === "number") {
                    m.sheen = 0;
                }
                if (
                    "transmission" in m &&
                    typeof m.transmission === "number"
                ) {
                    m.transmission = 0;
                }
                if (m.emissive) {
                    m.emissive.set(0, 0, 0);
                }
                m.needsUpdate = true;
            });
        });

        // Insert default jewelry: a small steel hoop at the left-ear
        // The default lobe ring is also rendered as a JSX <mesh> in
        // Ch2BodyModel using catalog anchor data, not attached here.

        // Expose the left-ear-lobe anchor empty for the marker overlay
        // to track each frame.
        if (onAnchorFound) {
            const a = gltf.scene.getObjectByName("anchor:left-ear-lobe");
            if (a) onAnchorFound(a);
        }

        return () => {
            for (const obj of created) {
                obj.parent?.remove(obj);
                const m = obj as THREE.Mesh;
                m.geometry?.dispose?.();
                const mat = m.material as THREE.Material | THREE.Material[];
                if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
                else mat?.dispose?.();
            }
        };
    }, [gltf.scene, onAnchorFound]);

    return <primitive object={gltf.scene} />;
}

/**
 * Parses a CSS color string (hex, rgb, rgba) into a THREE.Color
 * plus an alpha channel. THREE.Color itself ignores rgba alpha.
 */
function parseCssColor(
    input: string,
    fallback: { hex: string; alpha: number }
): { color: THREE.Color; alpha: number } {
    if (!input) {
        return {
            color: new THREE.Color(fallback.hex),
            alpha: fallback.alpha,
        };
    }

    const trimmed = input.trim();

    // 8-digit hex: #RRGGBBAA (some browsers return CSS rgba() vars in this form)
    const hex8 = trimmed.match(/^#([0-9a-f]{8})$/i);
    if (hex8) {
        const r = parseInt(hex8[1].slice(0, 2), 16) / 255;
        const g = parseInt(hex8[1].slice(2, 4), 16) / 255;
        const b = parseInt(hex8[1].slice(4, 6), 16) / 255;
        const a = parseInt(hex8[1].slice(6, 8), 16) / 255;
        return { color: new THREE.Color(r, g, b), alpha: a };
    }

    const rgbaMatch = trimmed.match(
        /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i
    );
    if (rgbaMatch) {
        const r = Number(rgbaMatch[1]) / 255;
        const g = Number(rgbaMatch[2]) / 255;
        const b = Number(rgbaMatch[3]) / 255;
        const a = rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1;
        return { color: new THREE.Color(r, g, b), alpha: a };
    }

    try {
        return { color: new THREE.Color(trimmed), alpha: 1 };
    } catch {
        return {
            color: new THREE.Color(fallback.hex),
            alpha: fallback.alpha,
        };
    }
}

function FaceGrid({
    width,
    height,
    cellSize = 2,
    minorColor,
    minorAlpha,
    majorColor,
    majorAlpha,
    crossColor,
    crossAlpha,
    position,
    rotation,
    fadeOutRef,
}: {
    width: number;
    height: number;
    cellSize?: number;
    minorColor: THREE.Color;
    minorAlpha: number;
    majorColor: THREE.Color;
    majorAlpha: number;
    crossColor: THREE.Color;
    crossAlpha: number;
    position: [number, number, number];
    rotation?: [number, number, number];
    /* When set, multiplies all alphas by (1 - fadeOutRef.current) each
       frame. Used to fade walls out in Ch2 while leaving the floor
       (which doesn't pass this ref) at full alpha. */
    fadeOutRef?: React.RefObject<number>;
}) {
    const subsPerCell = 5;
    const divX = Math.round(width / cellSize) * subsPerCell;
    const divY = Math.round(height / cellSize) * subsPerCell;

    const { minorGeom, majorGeom, edgeMajorGeom, crossGeom } = useMemo(() => {
        const minor: number[] = [];
        const majorVerts: number[] = [];
        const edgeMajorVerts: number[] = [];
        const crossLines: number[] = [];
        const hw = width / 2;
        const hh = height / 2;
        const subSize = width / divX;
        const arm = subSize * 0.18;
        // Major line half-thickness for mesh quads
        const majorThick = subSize * 0.07;

        // Minor lines (thin lineSegments)
        for (let i = 0; i <= divX; i++) {
            const isEdge = i === 0 || i === divX;
            if (i % subsPerCell === 0 && !isEdge) continue; // skip interior majors, keep edges
            const x = -hw + (i / divX) * width;
            minor.push(x, -hh, 0, x, hh, 0);
        }
        for (let j = 0; j <= divY; j++) {
            const isEdge = j === 0 || j === divY;
            if (j % subsPerCell === 0 && !isEdge) continue;
            const y = -hh + (j / divY) * height;
            minor.push(-hw, y, 0, hw, y, 0);
        }

        // Major lines — split into interior and edge
        for (let i = 0; i <= divX; i += subsPerCell) {
            const x = -hw + (i / divX) * width;
            const isEdge = i === 0 || i === divX;
            const target = isEdge ? edgeMajorVerts : majorVerts;
            target.push(
                x - majorThick,
                -hh,
                0.001,
                x + majorThick,
                -hh,
                0.001,
                x + majorThick,
                hh,
                0.001,
                x - majorThick,
                -hh,
                0.001,
                x + majorThick,
                hh,
                0.001,
                x - majorThick,
                hh,
                0.001
            );
        }
        for (let j = 0; j <= divY; j += subsPerCell) {
            const y = -hh + (j / divY) * height;
            const isEdge = j === 0 || j === divY;
            const target = isEdge ? edgeMajorVerts : majorVerts;
            target.push(
                -hw,
                y - majorThick,
                0.001,
                hw,
                y - majorThick,
                0.001,
                hw,
                y + majorThick,
                0.001,
                -hw,
                y - majorThick,
                0.001,
                hw,
                y + majorThick,
                0.001,
                -hw,
                y + majorThick,
                0.001
            );
        }

        // + marks at interior intersections only (skip edges to avoid arms extending past walls)
        for (let i = subsPerCell; i < divX; i += subsPerCell) {
            for (let j = subsPerCell; j < divY; j += subsPerCell) {
                const cx = -hw + (i / divX) * width;
                const cy = -hh + (j / divY) * height;
                const z = 0.005;
                // Horizontal arm
                crossLines.push(cx - arm, cy, z, cx + arm, cy, z);
                // Vertical arm
                crossLines.push(cx, cy - arm, z, cx, cy + arm, z);
            }
        }

        const minG = new THREE.BufferGeometry();
        minG.setAttribute("position", new THREE.Float32BufferAttribute(minor, 3));
        const majG = new THREE.BufferGeometry();
        majG.setAttribute("position", new THREE.Float32BufferAttribute(majorVerts, 3));
        const edgG = new THREE.BufferGeometry();
        edgG.setAttribute("position", new THREE.Float32BufferAttribute(edgeMajorVerts, 3));
        const crsG = new THREE.BufferGeometry();
        crsG.setAttribute("position", new THREE.Float32BufferAttribute(crossLines, 3));
        return { minorGeom: minG, majorGeom: majG, edgeMajorGeom: edgG, crossGeom: crsG };
    }, [width, height, divX, divY]);

    useEffect(() => {
        return () => {
            minorGeom.dispose();
            majorGeom.dispose();
            edgeMajorGeom.dispose();
            crossGeom.dispose();
        };
    }, [minorGeom, majorGeom, edgeMajorGeom, crossGeom]);

    const minorMatRef = useRef<THREE.LineBasicMaterial>(null);
    const majorMatRef = useRef<THREE.MeshBasicMaterial>(null);
    const edgeMatRef = useRef<THREE.MeshBasicMaterial>(null);
    const crossMatRef = useRef<THREE.LineBasicMaterial>(null);

    useFrame(() => {
        if (!fadeOutRef) return;
        const mult = 1 - fadeOutRef.current;
        if (minorMatRef.current) minorMatRef.current.opacity = minorAlpha * mult;
        if (majorMatRef.current) majorMatRef.current.opacity = majorAlpha * mult;
        if (edgeMatRef.current) edgeMatRef.current.opacity = majorAlpha * 0.25 * mult;
        if (crossMatRef.current) crossMatRef.current.opacity = crossAlpha * mult;
    });

    return (
        <group position={position} rotation={rotation}>
            <lineSegments geometry={minorGeom}>
                <lineBasicMaterial
                    ref={minorMatRef}
                    color={minorColor}
                    fog
                />
            </lineSegments>
            <mesh geometry={majorGeom}>
                <meshBasicMaterial
                    ref={majorMatRef}
                    color={majorColor}
                    side={THREE.DoubleSide}
                    fog
                />
            </mesh>
            <mesh geometry={edgeMajorGeom}>
                <meshBasicMaterial
                    ref={edgeMatRef}
                    color={majorColor}
                    side={THREE.DoubleSide}
                    fog
                />
            </mesh>
            <lineSegments geometry={crossGeom}>
                <lineBasicMaterial
                    ref={crossMatRef}
                    color={crossColor}
                    depthTest={false}
                    depthWrite={false}
                    fog
                />
            </lineSegments>
        </group>
    );
}

type ParsedColors = {
    bg: THREE.Color;
    minor: THREE.Color;
    minorAlpha: number;
    major: THREE.Color;
    majorAlpha: number;
    crossColor: THREE.Color;
    crossAlpha: number;
    luminous: THREE.Color;
};

function useThemeColors(scopeRef: React.RefObject<HTMLElement | null>): ParsedColors {
    const [raw, setRaw] = useState({
        bg: "#080808",
        minor: "rgba(255,255,255,0.55)",
        major: "rgba(255,255,255,0.95)",
    });

    useEffect(() => {
        const el = scopeRef.current;
        if (!el) return;

        const read = () => {
            const styles = getComputedStyle(el);
            setRaw({
                bg: styles.getPropertyValue("--bg").trim() || "#080808",
                minor: styles.getPropertyValue("--grid-minor").trim() || "rgba(255,255,255,0.55)",
                major: styles.getPropertyValue("--grid-major").trim() || "rgba(255,255,255,0.95)",
            });
        };

        read();
        const observer = new MutationObserver(read);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });
        return () => observer.disconnect();
    }, [scopeRef]);

    return useMemo(() => {
        const bg = parseCssColor(raw.bg, { hex: "#080808", alpha: 1 }).color;
        // Tokens are now solid hex (pre-baked alpha over --bg) so we
        // use opacity 1.0 across the board. Materials render opaque
        // and skip the transparent render queue, fixing the alpha-bleed
        // where minor lines used to show through the major mesh.
        const m = parseCssColor(raw.minor, {
            hex: "#171717",
            alpha: 1,
        });
        const M = parseCssColor(raw.major, {
            hex: "#3e3e3e",
            alpha: 1,
        });
        // Separate "luminous" colour for HDR-pushed text (PIERCERKZN,
        // ВЫБЕРИ, ПРИМЕРЬ). The grid greys above are pre-baked over the
        // dark surface — multiplying them by 1.6 stays dark grey, which
        // killed the bloom-driven glow. Text needs pure white; the
        // bloom pass + toneMapped=false handle the rest.
        const luminous = new THREE.Color("#ffffff");
        return {
            bg,
            minor: m.color,
            minorAlpha: 1,
            major: M.color,
            majorAlpha: 1,
            // Cross marks pre-baked over --bg = #080808. Computed
            // equivalent of the old "white at opacity 0.39" formula:
            //   255 × 0.39 + 8 × 0.61 ≈ 104  → #686868
            // Brighter than the major lines (#3e3e3e) so the
            // intersections register as accents, not just thicker
            // wireframe joints.
            crossColor: new THREE.Color("#686868"),
            crossAlpha: 1,
            luminous,
        };
    }, [raw]);
}

/**
 * GlassPiece — unified glass mesh for ring (index 0) and jewelry (1-6).
 * Uses MeshTransmissionMaterial with Bayer dither dissolve.
 * Scroll-driven quaternion slerp + mouse-follow rotation for all pieces.
 * activeJewelry=0 → ring torus, 1-6 → jewelry piece.
 * Dither transition swaps geometry at midpoint (tp > 0.5).
 *
 * Cinematic enhancements:
 * - Scroll-triggered breathing (±3% scale oscillation synced to scroll velocity)
 * - Entry stagger on first Chapter 1 visit (elastic scale-in)
 * - Static chromatic aberration at 0.4 (velocity reactivity removed — read as demo, not exhibit)
 * - Idle auto-rotation after 8s of no input (0.5°/s gentle spin + breathe)
 */
function GlassPiece({
    z,
    mouseRef,
    pointerActiveRef,
    scrollPhase,
    ch2Phase,
    activeChapter,
    activeJewelry = 0,
    activeArea = "ear_left",
    transitionProgress,
    swapDirection,
    scrollVelocity,
    settlePulseRef,
    reducedMotion = false,
}: {
    z: number;
    mouseRef: React.RefObject<{ x: number; y: number }>;
    pointerActiveRef: React.RefObject<boolean>;
    scrollPhase?: React.RefObject<number>;
    ch2Phase?: React.RefObject<number>;
    activeChapter?: React.RefObject<number>;
    activeJewelry?: number;
    activeArea?: string;
    transitionProgress?: React.RefObject<number>;
    swapDirection?: React.RefObject<number>;
    scrollVelocity?: React.RefObject<number>;
    /* One-shot trigger: GlassPiece writes 1 here the moment the 1080°
       reveal completes; ProximityBloom reads + clears it to fire a
       brief bloom-intensity pulse. Set up this way (rather than as a
       sibling state) so the two refs can communicate without a
       parent re-render. */
    settlePulseRef?: React.RefObject<number>;
    reducedMotion?: boolean;
}) {
    const ref = useRef<THREE.Mesh>(null);

    // Mouse-follow rotation
    const smoothMouse = useRef({ x: 0, y: 0 });
    const prevSmooth = useRef({ x: 0, y: 0 });
    const accEuler = useRef({ x: 0, y: 0 });
    const _mouseQ = useMemo(() => new THREE.Quaternion(), []);
    const _euler = useMemo(() => new THREE.Euler(), []);
    const _scrollQ = useMemo(() => new THREE.Quaternion(), []);
    const _scrollEuler = useMemo(() => new THREE.Euler(), []);

    // All geometries: index 0 = torus ring, 1-6 = jewelry
    const geometries = useMemo(() => PIECE_GEOMETRIES.map((fn) => fn()), []);
    useEffect(() => () => geometries.forEach((g) => g?.dispose()), [geometries]);

    // Dither uniform for Bayer dissolve
    const ditherProgress = useRef({ value: 0.0 });
    const matRef = useRef<any>(null);
    const obcChained = useRef(false);

    // Chain Bayer dither onto MeshTransmissionMaterial's onBeforeCompile
    useEffect(() => {
        const mat = matRef.current;
        if (!mat || obcChained.current) return;
        const orig = mat.onBeforeCompile?.bind(mat);
        mat.onBeforeCompile = (shader: any, renderer: any) => {
            if (orig) orig(shader, renderer);
            shader.uniforms.uDither = ditherProgress.current;
            shader.fragmentShader = "uniform float uDither;\n" + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace(
                "#include <dithering_fragment>",
                /* glsl */ `
                if (uDither > 0.001) {
                    vec2 px = mod(gl_FragCoord.xy, 4.0);
                    vec2 q4 = step(2.0, px);
                    float b4 = (1.0 - q4.y) * q4.x * 2.0 + q4.y * (3.0 - q4.x * 2.0);
                    vec2 q2 = step(1.0, mod(px, 2.0));
                    float b2 = (1.0 - q2.y) * q2.x * 2.0 + q2.y * (3.0 - q2.x * 2.0);
                    float threshold = (b4 * 4.0 + b2) / 16.0;
                    if (uDither > threshold) discard;
                }
                #include <dithering_fragment>
                `
            );
        };
        const origKey = mat.customProgramCacheKey?.bind(mat);
        mat.customProgramCacheKey = () => (origKey ? origKey() : "") + "-piece-dither";
        mat.needsUpdate = true;
        obcChained.current = true;
    }, []);

    // Track piece index for geometry swapping
    const prevJewelry = useRef(activeJewelry);
    const swappedThisCycle = useRef(false);
    useEffect(() => {
        if (activeJewelry !== prevJewelry.current) {
            swappedThisCycle.current = false;
            prevJewelry.current = activeJewelry;
        }
    }, [activeJewelry]);

    // Smooth state
    const smoothScale = useRef(2);
    const smoothOpacity = useRef(1);
    const smoothScrollRotX = useRef(0);
    const smoothScrollRotY = useRef(0);

    // One-shot 1080° reveal — tracks the maximum scrollPhase the user
    // has reached. Only ratchets forward; scroll-back does not unwind
    // the reveal. Combined with an easeOutCubic ramp this gives the
    // jewelry a deliberate dramatic entrance (3 full turns over the
    // hero→Chapter-1 drift) that resolves to its rest pose by sp=0.85
    // and stays there for the rest of the session.
    const maxSpReached = useRef(0);
    // Latches true the moment the reveal first completes; used to
    // trigger a one-shot bloom pulse via settlePulseRef.
    const hasSettled = useRef(false);

    // C1: Entry stagger — first Chapter 1 visit gets elastic scale-in
    const hasEnteredChapter1 = useRef(false);
    const entryScale = useRef(0); // 0→1 elastic ease on first visit

    // D3: Idle auto-rotation
    const lastInputTime = useRef(performance.now());
    const idleAngle = useRef(0);
    const smoothIdleStrength = useRef(0);

    // A1: Breathing — smooth scroll velocity for breathing pulse
    const smoothBreathVel = useRef(0);

    // Directional slide removed — the arc motion during jewelry
    // swaps looked wacky. Using only Bayer dither dissolve now.
    // Hero→exhibit z drift — ring travels back onto the podium as the
    // user scrolls into Chapter 1. Initialised at HERO_RING_Z so the
    // first frame shows the ring at hero size.
    const smoothZ = useRef(HERO_RING_Z);

    // Ch2 boost mirror, alignment quaternion, alignment-normal vector,
    // and post-axis vector were retired alongside the 3D BodyModel.
    // The jewelry no longer rides onto a body anchor in Ch2 — it
    // stays on the podium across all chapters and the 2D
    // Ch2BodyOverlay carries the anatomy story instead.

    useFrame((state, delta) => {
        if (!ref.current) return;
        const dt = Math.min(delta, 0.05);
        const tp = transitionProgress?.current ?? 0;
        const sv = scrollVelocity?.current ?? 0;
        const elapsed = state.clock.elapsedTime;
        const ac = activeChapter?.current ?? 0;
        const sp = scrollPhase?.current ?? 0;
        const ph2 = ch2Phase?.current ?? 0;

        // Swap geometry at transition midpoint
        if (!swappedThisCycle.current && tp > 0.5) {
            const idx = Math.max(0, Math.min(activeJewelry, geometries.length - 1));
            ref.current.geometry = geometries[idx];
            swappedThisCycle.current = true;
            // Reset idle rotation to prevent slerp fight after swap
            idleAngle.current = 0;
            smoothIdleStrength.current = 0;
            lastInputTime.current = performance.now();
        }

        // ── Dither ──
        ditherProgress.current.value = tp;

        // ── C1: Entry stagger on first Chapter 1 visit ──
        // Only animate scale-in if ring was actually hidden (from ch2+).
        // Coming from hero (ch0) the ring is already visible — skip stagger.
        if (ac === 1 && !hasEnteredChapter1.current) {
            hasEnteredChapter1.current = true;
            entryScale.current = smoothScale.current > 0.1 ? 1 : 0;
        }
        if (hasEnteredChapter1.current && entryScale.current < 1) {
            // Elastic ease-out: overshoot then settle
            entryScale.current = Math.min(1, entryScale.current + dt * 2.5);
        }
        const entryFactor = hasEnteredChapter1.current
            ? entryScale.current < 1
                ? (1 - Math.pow(1 - entryScale.current, 3)) *
                  (1 + 0.08 * Math.sin(entryScale.current * Math.PI * 2))
                : 1
            : 1;

        // ── A1: Scroll-triggered breathing ──
        smoothBreathVel.current = THREE.MathUtils.damp(smoothBreathVel.current, sv, 4, dt);
        // Breathing: gentle sine oscillation, amplitude scales with scroll velocity
        // Skip when reduced-motion is active
        const idleBreath = reducedMotion ? 0 : Math.sin(elapsed * 1.5) * 0.015;
        const scrollBreath = reducedMotion
            ? 0
            : Math.sin(elapsed * 3) * smoothBreathVel.current * 0.03;
        const breathFactor = 1 + idleBreath + scrollBreath;

        // ── Body materialization mirror (RETIRED) ──
        // Previously this mirrored BodyModel's scale ramp so the
        // jewelry could ride onto the body anchor during Ch2's stage D.
        // The 3D BodyModel mount has been retired (Ch2's visible body
        // is now the 2D Ch2BodyOverlay), so the jewelry stays on its
        // podium trajectory across all chapters. No "in Ch2 close-up"
        // gating remains in this component; the Ch2 anchor positions,
        // alignment quaternion, and post-axis vector were all dropped.

        // ── Scale ──
        // Ch0/1: 2× hero/exhibit size — the ring stays at its natural
        // drift position (HERO_RING_Z → EXHIBIT_Z) throughout Ch1 and
        // the Ch1→Ch2 storyboard. As the camera tilts down to look at
        // the floor, the ring sits visibly on the podium below — part
        // of the world, not faded out.
        // Ch3+: hidden (the chapter handles its own composition).
        const visible = ac <= 2;
        const scalePulse = 1 - tp * 0.25;
        const targetScale = !visible ? 0 : 2 * scalePulse;
        const lambda = !visible ? 3 : 8;
        smoothScale.current = THREE.MathUtils.damp(smoothScale.current, targetScale, lambda, dt);
        const s = smoothScale.current * breathFactor * entryFactor;
        ref.current.scale.set(s, s, s);

        // ── Visibility (skip FBO when fully hidden) ──
        ref.current.visible = s > 0.01 && ditherProgress.current.value < 0.99;

        // ── Position ──
        // Across all chapters: drift z hero→exhibit synchronised with
        // camera pull-back; x stays 0; y baseline lifts above podium
        // top tier + bob. The Ch2 anchor-following branch was retired
        // alongside the 3D body — the jewelry no longer "lands" on a
        // body in the canonical scene; it stays on its podium and the
        // 2D Ch2BodyOverlay carries the anatomy story.
        const transitT = Math.min(1, sp * 2);
        const driftT = flyEasing(transitT);
        const ch01TargetZ = HERO_RING_Z + driftT * (EXHIBIT_Z - HERO_RING_Z);
        const ch01BaseY = driftT * 0.45;
        const bobY = reducedMotion ? 0 : Math.sin(elapsed * 0.9) * 0.06;

        const targetPosX = 0;
        const targetPosY = ch01BaseY + bobY;
        const targetPosZ = ch01TargetZ;

        smoothZ.current = THREE.MathUtils.damp(smoothZ.current, targetPosZ, DOLLY_LAMBDA, dt);
        ref.current.position.z = smoothZ.current;
        ref.current.position.x = THREE.MathUtils.damp(ref.current.position.x, targetPosX, 5, dt);
        ref.current.position.y = THREE.MathUtils.damp(ref.current.position.y, targetPosY, 5, dt);

        // ── Opacity ──
        const targetOpacity = visible ? 1 : 0;
        smoothOpacity.current = THREE.MathUtils.damp(smoothOpacity.current, targetOpacity, 8, dt);
        const mat = ref.current.material as any;
        if (mat && "opacity" in mat) {
            mat.opacity = smoothOpacity.current;
            mat.transparent = smoothOpacity.current < 0.99;
        }

        // Chromatic aberration is held at the static 0.4 value declared
        // on MeshTransmissionMaterial — the previous scroll-velocity-reactive
        // spike was cut as it read as WebGL-demo flair rather than exhibit.

        // ── Scroll-driven rotation (two-phase + reveal) ──
        // X rotates linearly across the entire hero→Chapter-1 scroll —
        // 180° by sp=0.5 (at ВЫБЕРИ), another 180° by sp=1 (at Ch 1),
        // total 360°. Y stays still during the first half, then rotates
        // a full 360° during the second half (ВЫБЕРИ → Chapter 1).
        const targetRotX = sp * Math.PI * 2; // 0 → 360°
        const baseTargetRotY = Math.max(0, (sp - 0.5) * 2) * Math.PI * 2; // 0 → 360° (sp 0.5→1)

        // One-shot 1080° (3-turn) reveal on Y, layered on top of the
        // existing scroll-driven rotation. Drives off maxSpReached so
        // scroll-back doesn't unwind it; eased with easeOutCubic so the
        // piece spins fast at the start of the hero→Ch1 drift and
        // decelerates into its rest pose by sp ≈ 0.85, well before the
        // user reaches Chapter 1's centre. Reduced-motion users get a
        // single revolution (360°) instead of three.
        maxSpReached.current = Math.max(maxSpReached.current, sp);
        const revealT = Math.min(1, maxSpReached.current / 0.85);
        const revealEased = 1 - Math.pow(1 - revealT, 3);
        const revealTurns = reducedMotion ? 1 : 3;
        const revealRotY = revealEased * revealTurns * Math.PI * 2;

        // Fire a one-shot bloom pulse the moment the reveal completes.
        // hasSettled ratchets to true on first crossing of revealT >= 1
        // and stays true; the settlePulseRef is set to 1 once for the
        // bloom pass to consume. The pulse itself is shaped (sine over
        // ~250ms) inside ProximityBloom — this just fires the trigger.
        if (revealT >= 1 && !hasSettled.current) {
            hasSettled.current = true;
            if (settlePulseRef) settlePulseRef.current = 1;
        }

        const targetRotY = baseTargetRotY + revealRotY;
        smoothScrollRotX.current = THREE.MathUtils.damp(
            smoothScrollRotX.current,
            targetRotX,
            9,
            dt
        );
        smoothScrollRotY.current = THREE.MathUtils.damp(
            smoothScrollRotY.current,
            targetRotY,
            9,
            dt
        );

        // Idle auto-rotation removed — read as WebGL-demo flair
        // rather than exhibit. Confident exhibits don't fidget when
        // the viewer pauses. Refs (idleAngle, smoothIdleStrength,
        // lastInputTime) are kept zero/idle so the slerp expression
        // below stays a no-op without changing its shape.
        const active = pointerActiveRef.current;

        // ── Mouse-follow rotation ──
        const targetX = active ? mouseRef.current.x : 0;
        const targetY = active ? mouseRef.current.y : 0;
        const lerpRate = active ? 8 : 2;
        const t = 1 - Math.exp(-lerpRate * dt);
        smoothMouse.current.x += (targetX - smoothMouse.current.x) * t;
        smoothMouse.current.y += (targetY - smoothMouse.current.y) * t;
        const vx = smoothMouse.current.x - prevSmooth.current.x;
        const vy = smoothMouse.current.y - prevSmooth.current.y;
        prevSmooth.current.x = smoothMouse.current.x;
        prevSmooth.current.y = smoothMouse.current.y;
        const sx = smoothMouse.current.x;
        const sy = smoothMouse.current.y;
        const dist = Math.sqrt(sx * sx + sy * sy);
        const distFactor = Math.max(0, 1 - dist * 1.5);
        const rotMag = 0.04 * distFactor;
        accEuler.current.x -= vy * rotMag;
        accEuler.current.y += vx * rotMag;
        const decay = 1 - dt;
        accEuler.current.x *= decay;
        accEuler.current.y *= decay;

        _euler.set(accEuler.current.x, accEuler.current.y, 0);
        _mouseQ.setFromEuler(_euler);
        ref.current.quaternion.premultiply(_mouseQ);

        // Slerp toward scroll-driven rotation target (+ idle rotation Y offset)
        _scrollEuler.set(
            smoothScrollRotX.current,
            smoothScrollRotY.current + idleAngle.current * smoothIdleStrength.current,
            0
        );
        _scrollQ.setFromEuler(_scrollEuler);
        // Gentle slerp — lower factor prevents snapping/fighting
        ref.current.quaternion.slerp(_scrollQ, dt * 2.0);
        ref.current.quaternion.normalize();

        // ── Normal alignment in Ch2 (RETIRED) ──
        // Previously the jewelry slerped its rotation toward the
        // active body anchor's outward normal so the post pointed
        // out from the skin. With the 3D body retired, the jewelry
        // stays on the podium with its scroll-driven rotation only.
        // ch2T is held at 0 above, so this branch is dead — kept as
        // a comment marker so future readers know why the rotation
        // chain stops at the scroll/idle/mouse trio.
    });

    return (
        <mesh ref={ref} geometry={geometries[0]} position={[0, 0, z]} scale={2}>
            <MeshTransmissionMaterial
                ref={matRef}
                thickness={0.02}
                roughness={0}
                transmission={1}
                ior={1.25}
                chromaticAberration={0}
                envMapIntensity={0.15}
                backside
                backsideThickness={0.1}
                resolution={
                    typeof window !== "undefined" && window.devicePixelRatio > 1.5 ? 2048 : 1024
                }
                samples={10}
            />
        </mesh>
    );
}

/**
 * B2: Floating dust motes / glass shards that catch the spotlight.
 * Simple Points geometry with slow drift, parallax-aware.
 */
const MOTE_COUNT = 40;
function DustMotes({
    z,
    activeChapter,
    scrollVelocity,
}: {
    z: number;
    activeChapter?: React.RefObject<number>;
    scrollVelocity?: React.RefObject<number>;
}) {
    const pointsRef = useRef<THREE.Points>(null);
    const smoothOpacity = useRef(0);

    const { positions, speeds } = useMemo(() => {
        const pos = new Float32Array(MOTE_COUNT * 3);
        const spd = new Float32Array(MOTE_COUNT);
        for (let i = 0; i < MOTE_COUNT; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 8;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 6;
            pos[i * 3 + 2] = z + (Math.random() - 0.5) * 4;
            spd[i] = 0.1 + Math.random() * 0.3;
        }
        return { positions: pos, speeds: spd };
    }, [z]);

    const geometry = useMemo(() => {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        return g;
    }, [positions]);

    useFrame((state, delta) => {
        if (!pointsRef.current) return;
        const dt = Math.min(delta, 0.05);
        const elapsed = state.clock.elapsedTime;

        const visible = (activeChapter?.current ?? 0) <= 1;
        smoothOpacity.current = THREE.MathUtils.damp(smoothOpacity.current, visible ? 1 : 0, 3, dt);

        // Scroll velocity makes particles scatter more and glow brighter
        const sv = scrollVelocity?.current ?? 0;
        const baseOpacity = 0.35 + sv * 0.2; // 0.35 → 0.55 at max scroll
        (pointsRef.current.material as THREE.PointsMaterial).opacity =
            smoothOpacity.current * baseOpacity;

        // Amplify position offset with scroll energy
        const energyMul = 1 + sv * 3; // 1× idle → 4× at max scroll

        const pos = geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < MOTE_COUNT; i++) {
            const s = speeds[i];
            pos.array[i * 3 + 1] += Math.sin(elapsed * s + i) * dt * 0.08 * energyMul;
            pos.array[i * 3] += Math.cos(elapsed * s * 0.7 + i * 2) * dt * 0.04 * energyMul;
            // Wraparound: reset motes that drift out of view
            if (pos.array[i * 3 + 1] > 4) pos.array[i * 3 + 1] = -4 + Math.random();
            if (pos.array[i * 3 + 1] < -4) pos.array[i * 3 + 1] = 4 - Math.random();
            if (pos.array[i * 3] > 5) pos.array[i * 3] = -5 + Math.random();
            if (pos.array[i * 3] < -5) pos.array[i * 3] = 5 - Math.random();
        }
        pos.needsUpdate = true;
    });

    return (
        <points ref={pointsRef} geometry={geometry}>
            <pointsMaterial
                color="#fffdf5"
                size={0.03}
                transparent
                opacity={0}
                sizeAttenuation
                depthWrite={false}
            />
        </points>
    );
}

/**
 * B3: Exhibition spotlight that shifts color temperature based on scroll.
 * Cool white (#fff8ee) on hero → warm gold (#e1b24a) in Chapter 1.
 */
function ExhibitionLight({ z, scrollPhase }: { z: number; scrollPhase?: React.RefObject<number> }) {
    const spotRef = useRef<THREE.SpotLight>(null);
    const pointRef = useRef<THREE.PointLight>(null);
    const coolColor = useMemo(() => new THREE.Color("#fff8ee"), []);
    const warmColor = useMemo(() => new THREE.Color("#f06ba0"), []);
    const _color = useMemo(() => new THREE.Color(), []);

    useFrame(() => {
        // Blend 0→1 based on scroll phase (0 = hero, 1 = deep in chapter 1)
        const sp = scrollPhase?.current ?? 0;
        const blend = Math.min(1, sp * 2); // fully warm by scrollPhase=0.5
        _color.copy(coolColor).lerp(warmColor, blend * 0.4); // max 40% warm shift
        if (spotRef.current) spotRef.current.color.copy(_color);
        if (pointRef.current) pointRef.current.color.copy(_color);
    });

    return (
        <>
            <spotLight
                ref={spotRef}
                position={[0, 8, z]}
                angle={0.35}
                penumbra={0.8}
                intensity={4}
                distance={20}
                color="#fff8ee"
                castShadow={false}
            />
            <pointLight
                ref={pointRef}
                position={[0, 5, z - 4]}
                intensity={0.6}
                color="#ffe4c4"
                distance={18}
            />
        </>
    );
}

/**
 * C3: Mouse proximity bloom — dynamically adjusts bloom intensity
 * based on cursor proximity to center. Closer cursor = stronger bloom.
 * Must be used inside EffectComposer.
 */
function ProximityBloom({
    mouseRef,
    baseIntensity = 0.4,
    maxIntensity = 0.8,
    transitionProgress,
    settlePulseRef,
}: {
    mouseRef: React.RefObject<{ x: number; y: number }>;
    baseIntensity?: number;
    maxIntensity?: number;
    transitionProgress?: React.RefObject<number>;
    /* One-shot trigger from GlassPiece: when set to 1, fires a brief
       bloom-intensity pulse (sin shape, ~250 ms). Reset to 0
       immediately on consume so the same fire is never replayed. */
    settlePulseRef?: React.RefObject<number>;
}) {
    const bloomRef = useRef<any>(null);
    const smoothIntensity = useRef(baseIntensity);
    // Trigger time of the most-recent settle pulse. -Infinity means
    // no pulse has fired yet (so the elapsed-since computation gives
    // a huge number and the pulse adds 0).
    const lastPulseAt = useRef(-Infinity);

    useFrame((_, delta) => {
        if (!bloomRef.current) return;
        const dt = Math.min(delta, 0.05);
        const mx = mouseRef.current.x;
        const my = mouseRef.current.y;
        const dist = Math.sqrt(mx * mx + my * my);
        // Proximity: 0 at center, 1 at edges
        const proximity = Math.max(0, 1 - dist * 1.5); // strong at center, fades past 66%
        // P2: Bloom spike during jewelry swap transitions
        const tp = transitionProgress?.current ?? 0;
        const swapBoost = tp * 0.5; // up to +0.5 intensity during swap peak

        // One-shot settle pulse — fires when GlassPiece's 1080° reveal
        // completes. Consumes the ref's `1` flag to record now() and
        // resets it back to 0 so the same fire doesn't replay.
        if (settlePulseRef && settlePulseRef.current === 1) {
            lastPulseAt.current = performance.now();
            settlePulseRef.current = 0;
        }
        const PULSE_DURATION_MS = 250;
        const pulseElapsed = (performance.now() - lastPulseAt.current) / PULSE_DURATION_MS;
        const settleBoost = pulseElapsed >= 0 && pulseElapsed < 1
            ? Math.sin(pulseElapsed * Math.PI) * 0.6
            : 0;

        const target =
            baseIntensity + proximity * (maxIntensity - baseIntensity) + swapBoost + settleBoost;
        smoothIntensity.current = THREE.MathUtils.damp(smoothIntensity.current, target, 5, dt);
        bloomRef.current.intensity = smoothIntensity.current;
    });

    return (
        <Bloom
            ref={bloomRef}
            luminanceThreshold={0.85}
            luminanceSmoothing={0.3}
            intensity={baseIntensity}
            mipmapBlur
            levels={3}
        />
    );
}

/* BackdropText removed — ВЫБЕРИ section no longer exists */

/* JewelryNameText removed — was permanently invisible (baseOpacity=0)
   and wasting GPU resources (font atlas + useFrame every tick). */

/**
 * CylinderGrid — wraps a cylinder of the given radius/height with the
 * same major + minor + cross pattern the room walls use (`FaceGrid`).
 *
 * Mirrors FaceGrid's approach precisely:
 *   • minor lines  → 1px lineSegments at every subSize
 *   • major lines  → triangle-mesh strips of `majorThick` width
 *                    (so they actually look thicker than minors, the
 *                    way the wall majors do)
 *   • cross marks  → small lineSegment + shapes at major intersections
 *
 * Vertical major strips are oriented along the cylinder's tangent at
 * each radial; horizontal major rings are 2D bands around the cylinder
 * at each major height.
 */
function CylinderGrid({
    radius,
    height,
    cellSize = 2,
    subsPerCell = 5,
    ringSegments = 64,
    minorColor,
    minorAlpha,
    majorColor,
    majorAlpha,
    crossColor,
    crossAlpha,
}: {
    radius: number;
    height: number;
    cellSize?: number;
    subsPerCell?: number;
    ringSegments?: number;
    minorColor: THREE.Color;
    minorAlpha: number;
    majorColor: THREE.Color;
    majorAlpha: number;
    crossColor: THREE.Color;
    crossAlpha: number;
}) {
    const { minorGeom, majorGeom, crossGeom } = useMemo(() => {
        const minor: number[] = [];
        const major: number[] = [];
        const cross: number[] = [];
        const halfH = height / 2;

        const subSize = cellSize / subsPerCell;
        // FaceGrid uses majorThick = subSize * 0.07; mirror that exactly
        // so major-line thickness matches the corridor walls' look.
        const majorThick = subSize * 0.07;
        const armLength = subSize * 0.18;

        const circumference = Math.PI * 2 * radius;
        // Round divX to a multiple of subsPerCell so major lines land
        // cleanly on cellSize boundaries without alignment drift.
        const rawDivX = Math.max(subsPerCell, Math.round(circumference / subSize));
        const divX = Math.round(rawDivX / subsPerCell) * subsPerCell;
        const divY = Math.max(1, Math.round(height / subSize));

        // Helper: push two triangles forming a quad with the given 4 verts.
        const pushQuad = (
            target: number[],
            ax: number,
            ay: number,
            az: number,
            bx: number,
            by: number,
            bz: number,
            cx: number,
            cy: number,
            cz: number,
            dx: number,
            dy: number,
            dz: number
        ) => {
            target.push(ax, ay, az, bx, by, bz, cx, cy, cz);
            target.push(ax, ay, az, cx, cy, cz, dx, dy, dz);
        };

        // ── Minor lines ──
        // Verticals: every minor index that isn't a major.
        for (let i = 0; i < divX; i++) {
            if (i % subsPerCell === 0) continue;
            const a = (i / divX) * Math.PI * 2;
            const x = Math.cos(a) * radius;
            const z = Math.sin(a) * radius;
            minor.push(x, -halfH, z, x, halfH, z);
        }
        // Horizontal rings: every minor row that isn't an edge or major.
        for (let j = 0; j <= divY; j++) {
            const isEdge = j === 0 || j === divY;
            if (isEdge || j % subsPerCell === 0) continue;
            const y = -halfH + (j / divY) * height;
            for (let i = 0; i < ringSegments; i++) {
                const a1 = (i / ringSegments) * Math.PI * 2;
                const a2 = ((i + 1) / ringSegments) * Math.PI * 2;
                minor.push(
                    Math.cos(a1) * radius,
                    y,
                    Math.sin(a1) * radius,
                    Math.cos(a2) * radius,
                    y,
                    Math.sin(a2) * radius
                );
            }
        }

        // ── Major mesh strips ──
        // Vertical majors: thin rectangular strips on the cylinder
        // surface, oriented along the tangent direction.
        for (let i = 0; i < divX; i += subsPerCell) {
            const a = (i / divX) * Math.PI * 2;
            const cx0 = Math.cos(a) * radius;
            const cz0 = Math.sin(a) * radius;
            // Tangent vector × majorThick = perpendicular offset along
            // the cylinder surface for line thickness.
            const tx = -Math.sin(a) * majorThick;
            const tz = Math.cos(a) * majorThick;
            pushQuad(
                major,
                cx0 - tx,
                -halfH,
                cz0 - tz, // lower-left
                cx0 + tx,
                -halfH,
                cz0 + tz, // lower-right
                cx0 + tx,
                halfH,
                cz0 + tz, // upper-right
                cx0 - tx,
                halfH,
                cz0 - tz // upper-left
            );
        }
        // Horizontal major rings: bands of quads around the cylinder
        // at each major height, including top + bottom rims.
        for (let j = 0; j <= divY; j++) {
            const isEdge = j === 0 || j === divY;
            const isMajor = isEdge || j % subsPerCell === 0;
            if (!isMajor) continue;
            const yC = -halfH + (j / divY) * height;
            const yLow = yC - majorThick;
            const yHigh = yC + majorThick;
            for (let i = 0; i < ringSegments; i++) {
                const a1 = (i / ringSegments) * Math.PI * 2;
                const a2 = ((i + 1) / ringSegments) * Math.PI * 2;
                const x1 = Math.cos(a1) * radius,
                    z1 = Math.sin(a1) * radius;
                const x2 = Math.cos(a2) * radius,
                    z2 = Math.sin(a2) * radius;
                pushQuad(
                    major,
                    x1,
                    yLow,
                    z1, // lower a1
                    x2,
                    yLow,
                    z2, // lower a2
                    x2,
                    yHigh,
                    z2, // upper a2
                    x1,
                    yHigh,
                    z1 // upper a1
                );
            }
        }

        // ── Cross marks at interior major intersections ──
        for (let i = 0; i < divX; i += subsPerCell) {
            const a = (i / divX) * Math.PI * 2;
            const ccx = Math.cos(a) * radius;
            const ccz = Math.sin(a) * radius;
            const tx = -Math.sin(a) * armLength;
            const tz = Math.cos(a) * armLength;
            for (let j = subsPerCell; j < divY; j += subsPerCell) {
                const cy = -halfH + (j / divY) * height;
                // Horizontal (tangential) arm.
                cross.push(ccx - tx, cy, ccz - tz, ccx + tx, cy, ccz + tz);
                // Vertical arm.
                cross.push(ccx, cy - armLength, ccz, ccx, cy + armLength, ccz);
            }
        }

        const makeBuffer = (verts: number[]) => {
            const geom = new THREE.BufferGeometry();
            geom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
            return geom;
        };

        return {
            minorGeom: makeBuffer(minor),
            majorGeom: makeBuffer(major),
            crossGeom: makeBuffer(cross),
        };
    }, [radius, height, cellSize, subsPerCell, ringSegments]);

    useEffect(
        () => () => {
            minorGeom.dispose();
            majorGeom.dispose();
            crossGeom.dispose();
        },
        [minorGeom, majorGeom, crossGeom]
    );

    return (
        <>
            <lineSegments geometry={minorGeom}>
                <lineBasicMaterial
                    color={minorColor}
                    transparent
                    opacity={minorAlpha}
                    depthWrite={false}
                />
            </lineSegments>
            {/* Major as triangle mesh — visibly thicker than the
                minor lineSegments, matching FaceGrid's wall pattern. */}
            <mesh geometry={majorGeom}>
                <meshBasicMaterial
                    color={majorColor}
                    transparent
                    opacity={majorAlpha}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                />
            </mesh>
            <lineSegments geometry={crossGeom}>
                <lineBasicMaterial
                    color={crossColor}
                    transparent
                    opacity={crossAlpha}
                    depthWrite={false}
                />
            </lineSegments>
        </>
    );
}

/**
 * Podium — pedestal anchored to the room floor at EXHIBIT_Z. Solid
 * dark cylinders matching the scene background, with `<CylinderGrid>`
 * overlays drawing the *same* major + minor + cross pattern the
 * corridor walls use. cellSize matches the walls (2) so the podium's
 * grid character is consistent with the rest of the room.
 *
 * Single column (merging the old column + bottom tier into one
 * piece) plus a smaller top-tier display surface. Group origin at
 * world y=-3.0; column extends from world y=-6 (floor) to y=-2.6,
 * top tier from y=-2.6 to y=-2.25.
 */
function Podium({
    z,
    bgColor,
    minorColor,
    minorAlpha,
    majorColor,
    majorAlpha,
    crossColor,
    crossAlpha,
}: {
    z: number;
    bgColor: THREE.Color;
    minorColor: THREE.Color;
    minorAlpha: number;
    majorColor: THREE.Color;
    majorAlpha: number;
    crossColor: THREE.Color;
    crossAlpha: number;
}) {
    /* cellSize=1 (vs the walls' 2): the podium cylinder is much smaller
       than the wall planes, so halving the cell size keeps the *visible
       pattern density* in line with what the walls show — more cells,
       more cross marks, more legible grid character. Major thickness
       and cross-arm length scale with cellSize automatically. */
    const gridProps = {
        cellSize: 1,
        minorColor,
        minorAlpha,
        majorColor,
        majorAlpha,
        crossColor,
        crossAlpha,
    };
    return (
        <group position={[0, -3.0, z]}>
            {/* Column — merged column + bottom tier, 2.0 radius × 3.4
                tall, sits on the floor. */}
            <mesh position={[0, -1.3, 0]}>
                <cylinderGeometry args={[2.0, 2.0, 3.4, 64, 1]} />
                <meshBasicMaterial color={bgColor} />
            </mesh>
            <group position={[0, -1.3, 0]}>
                <CylinderGrid radius={2.0} height={3.4} {...gridProps} />
            </group>

            {/* Top tier — 1.5 radius × 0.35 tall, display surface. */}
            <mesh position={[0, 0.575, 0]}>
                <cylinderGeometry args={[1.5, 1.5, 0.35, 64, 1]} />
                <meshBasicMaterial color={bgColor} />
            </mesh>
            <group position={[0, 0.575, 0]}>
                <CylinderGrid radius={1.5} height={0.35} {...gridProps} />
            </group>
        </group>
    );
}

/**
 * Wordmark "PIERCERKZN" — fades in place and recedes into depth as the
 * user scrolls into chapter 1. No horizontal slide — the brand dissolves
 * where it stood, with a subtle Z push-back so it reads as receding rather
 * than fading flat.
 */
function AnimatedWordmark({
    baseZ,
    color,
    fontUrl,
    scrollPhase,
}: {
    baseZ: number;
    color: THREE.Color;
    fontUrl: string;
    scrollPhase?: React.RefObject<number>;
}) {
    const ref = useRef<any>(null);
    const smoothOpacity = useRef(1);
    const smoothX = useRef(0);

    useFrame((_, delta) => {
        if (!ref.current) return;
        const dt = Math.min(delta, 0.05);

        const p = scrollPhase?.current ?? 0;
        // Smoothstep-fade in the first ~10vh of scroll. scrollPhase
        // now ramps 0→1 across hero+ChooseIntro→Chapter-1 (2 viewports
        // of scroll), so 10vh = 0.05 phase units. The brand exits
        // before the user has barely begun scrolling.
        const t = Math.max(0, Math.min(1, p / 0.05));
        const smoothT = t * t * (3 - 2 * t);
        const targetOpacity = 1 - smoothT;
        const targetX = 0;

        smoothOpacity.current = THREE.MathUtils.damp(smoothOpacity.current, targetOpacity, 9, dt);
        smoothX.current = THREE.MathUtils.damp(smoothX.current, targetX, 7, dt);

        ref.current.position.x = smoothX.current;
        // Z push-back: wordmark dissolves "into depth" rather than just fading flat
        ref.current.position.z = baseZ - p * 0.6;
        if (ref.current.material) {
            ref.current.material.opacity = Math.max(0, smoothOpacity.current);
        }
        ref.current.visible = smoothOpacity.current > 0.01;
    });

    return (
        <Text
            ref={ref}
            position={[0, 0, baseZ]}
            fontSize={3.0}
            letterSpacing={0.02}
            color={color}
            anchorX="center"
            anchorY="middle"
            font={fontUrl}
            sdfGlyphSize={128}
            fillOpacity={1}
            renderOrder={100}
        >
            PIERCERKZN
            <meshBasicMaterial
                color={color}
                transparent
                opacity={1}
                depthTest={false}
                depthWrite={false}
            />
        </Text>
    );
}

/**
 * AnimatedChooseText — "ВЫБЕРИ" rendered as a 3D Text mesh between
 * the camera and the exhibit ring. Reads as a floating chapter-divider
 * title sitting *in front of* the ring rather than behind it, framing
 * the exhibit beneath. Glows via toneMapped=false + HDR-pushed colour
 * (the existing bloom pass picks it up).
 *
 * Visibility is a wide beat centred on the ChooseIntro apex (sp=0.5):
 *   • fade-in:   sp 0.25 → 0.42  (smoothstep ramp-up)
 *   • full vis:  sp 0.42 → 0.58  (solid hold)
 *   • fade-out:  sp 0.58 → 0.75  (smoothstep ramp-down + z push-back)
 *
 * Fade vocabulary matches AnimatedWordmark (PIERCERKZN): pure opacity
 * + z push-back into depth on exit. No X slide, no transparent toggle,
 * no ref mutation of fillOpacity. The only reactively-driven property
 * is the meshBasicMaterial's opacity (transparent: true always).
 */
function AnimatedChooseText({
    z,
    color,
    fontUrl,
    scrollPhase,
}: {
    z: number;
    color: THREE.Color;
    fontUrl: string;
    scrollPhase?: React.RefObject<number>;
}) {
    const ref = useRef<any>(null);
    const smoothOpacity = useRef(0);
    const smoothX = useRef(-12);

    // HDR-pushed colour so toneMapped=false + bloom yields a glowing
    // luminous look without changing the hue from PIERCERKZN's tone.
    const brightColor = useMemo(() => color.clone().multiplyScalar(1.6), [color]);

    useFrame((_, delta) => {
        if (!ref.current) return;
        const dt = Math.min(delta, 0.05);
        const p = scrollPhase?.current ?? 0;

        // Wide visibility band centred on sp=0.5 (ChooseIntro apex).
        // Smoothstep on both ramps so entry/exit have the same gentle
        // shape as PIERCERKZN's fade.
        const inT = Math.max(0, Math.min(1, (p - 0.25) / 0.17));
        const outT = Math.max(0, Math.min(1, (p - 0.58) / 0.17));
        const fadeIn = inT * inT * (3 - 2 * inT);
        const fadeOut = outT * outT * (3 - 2 * outT);
        const targetOpacity = fadeIn * (1 - fadeOut);

        // Horizontal slide: enter from left (-12 → 0) during fade-in,
        // exit to right (0 → +12) during fade-out. fadeIn and fadeOut
        // never overlap (their windows are sp 0.25-0.42 and 0.58-0.75),
        // so the lerp pieces compose cleanly.
        const targetX = THREE.MathUtils.lerp(-12, 0, fadeIn) + fadeOut * 12;

        smoothOpacity.current = THREE.MathUtils.damp(smoothOpacity.current, targetOpacity, 10, dt);
        smoothX.current = THREE.MathUtils.damp(smoothX.current, targetX, 9, dt);

        ref.current.position.x = smoothX.current;
        const op = Math.max(0, smoothOpacity.current);
        // Drive opacity through the meshBasicMaterial only. Material is
        // `transparent: true` from initial render so toggling it never
        // recompiles — the fade is continuous, not flickery.
        if (ref.current.material) {
            ref.current.material.opacity = op;
        }
        ref.current.visible = op > 0.001;
    });

    return (
        <Text
            ref={ref}
            position={[-12, 0.0, z]}
            // Sits in front of the ring's exhibit position (z=-12) at
            // z=-10, with y=+1.0 lifting it above the ring as a chapter
            // title floating over the exhibit. fontSize 1.4 is sized to
            // fit the frame at ~5 units distance from the Ch1 camera.
            fontSize={1.4}
            letterSpacing={0.04}
            color={brightColor}
            anchorX="center"
            anchorY="middle"
            font={fontUrl}
            sdfGlyphSize={128}
            fillOpacity={1}
            renderOrder={100}
        >
            ВЫБЕРИ
            <meshBasicMaterial
                color={brightColor}
                transparent
                opacity={0}
                toneMapped={false}
                depthTest={false}
                depthWrite={false}
            />
        </Text>
    );
}

/**
 * AnimatedPrimerText — "ПРИМЕРЬ" rendered FLAT on the floor, directly
 * under the Ch2-storyboard camera. The camera at end-state looks
 * straight down at the floor so the title must be laid horizontally;
 * a vertical mesh would render edge-on and be invisible.
 *
 * Same slide-in / hold / slide-out vocabulary as ВЫБЕРИ, same HDR-pushed
 * bloom treatment so the two read as siblings in the bloom pass.
 *
 *   fade-in:   ch2TitlePhase 0.25 → 0.42
 *   full vis:  ch2TitlePhase 0.42 → 0.58
 *   fade-out:  ch2TitlePhase 0.58 → 0.75
 */
function AnimatedPrimerText({
    floorY,
    z,
    color,
    fontUrl,
    ch2TitlePhase,
}: {
    floorY: number;
    z: number;
    color: THREE.Color;
    fontUrl: string;
    ch2TitlePhase?: React.RefObject<number>;
}) {
    const ref = useRef<any>(null);
    const smoothOpacity = useRef(0);
    const smoothX = useRef(-12);

    // HDR-pushed colour — matches AnimatedChooseText's ВЫБЕРИ treatment.
    const brightColor = useMemo(() => color.clone().multiplyScalar(1.6), [color]);

    useFrame((_, delta) => {
        if (!ref.current) return;
        const dt = Math.min(delta, 0.05);
        const p = ch2TitlePhase?.current ?? 0;

        // Wide visibility band centred on phase=0.5 — same shape as
        // AnimatedChooseText so the two titles read as siblings.
        const inT = Math.max(0, Math.min(1, (p - 0.25) / 0.17));
        const outT = Math.max(0, Math.min(1, (p - 0.58) / 0.17));
        const fadeIn = inT * inT * (3 - 2 * inT);
        const fadeOut = outT * outT * (3 - 2 * outT);
        const targetOpacity = fadeIn * (1 - fadeOut);

        // Slide left → center → right (mirrors ВЫБЕРИ's choreography).
        // X moves along the floor's local X axis (since the text mesh
        // is rotated -π/2 around X, the world-X axis still maps to a
        // horizontal slide on the floor).
        const targetX = THREE.MathUtils.lerp(-12, 0, fadeIn) + fadeOut * 12;

        smoothOpacity.current = THREE.MathUtils.damp(smoothOpacity.current, targetOpacity, 10, dt);
        smoothX.current = THREE.MathUtils.damp(smoothX.current, targetX, 9, dt);

        ref.current.position.x = smoothX.current;
        const op = Math.max(0, smoothOpacity.current);
        if (ref.current.material) {
            ref.current.material.opacity = op;
        }
        ref.current.visible = op > 0.001;
    });

    return (
        <Text
            ref={ref}
            position={[-12, floorY + 0.02, z]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={1.2}
            letterSpacing={0.04}
            color={brightColor}
            anchorX="center"
            anchorY="middle"
            font={fontUrl}
            sdfGlyphSize={128}
            fillOpacity={1}
            renderOrder={100}
        >
            ПРИМЕРЬ
            <meshBasicMaterial
                color={brightColor}
                transparent
                opacity={0}
                toneMapped={false}
                depthTest={false}
                depthWrite={false}
            />
        </Text>
    );
}

/**
 * AnimatedReserveText — "ЗАБРОНИРУЙ" rendered FLAT on the floor, the
 * closing chapter beat. Same vocabulary as AnimatedPrimerText (slide-
 * in / hold / slide-out, HDR-pushed bloom-friendly material) so the
 * three chapter dividers ВЫБЕРИ → ПРИМЕРЬ → ЗАБРОНИРУЙ read as a
 * matched set of siblings.
 *
 * Z is offset slightly forward of ПРИМЕРЬ (z=-2 vs -3) so that during
 * a fast scroll where both phases briefly overlap, ЗАБРОНИРУЙ renders
 * in front rather than z-fighting. In practice section-snap pacing
 * keeps the two visibility windows separated by the full Chapter 2
 * scroll-through (200svh) so they're never simultaneously visible.
 *
 *   fade-in:   ch3TitlePhase 0.25 → 0.42
 *   full vis:  ch3TitlePhase 0.42 → 0.58
 *   fade-out:  ch3TitlePhase 0.58 → 0.75
 */
function AnimatedReserveText({
    floorY,
    z,
    color,
    fontUrl,
    ch3TitlePhase,
}: {
    floorY: number;
    z: number;
    color: THREE.Color;
    fontUrl: string;
    ch3TitlePhase?: React.RefObject<number>;
}) {
    const ref = useRef<any>(null);
    const smoothOpacity = useRef(0);
    const smoothX = useRef(-12);

    // HDR-pushed colour — matches the ВЫБЕРИ/ПРИМЕРЬ treatment so the
    // three titles bloom identically.
    const brightColor = useMemo(() => color.clone().multiplyScalar(1.6), [color]);

    useFrame((_, delta) => {
        if (!ref.current) return;
        const dt = Math.min(delta, 0.05);
        const p = ch3TitlePhase?.current ?? 0;

        const inT = Math.max(0, Math.min(1, (p - 0.25) / 0.17));
        const outT = Math.max(0, Math.min(1, (p - 0.58) / 0.17));
        const fadeIn = inT * inT * (3 - 2 * inT);
        const fadeOut = outT * outT * (3 - 2 * outT);
        const targetOpacity = fadeIn * (1 - fadeOut);

        // ЗАБРОНИРУЙ slides in from the right (mirror of ПРИМЕРЬ which
        // came from the left) so the two siblings have a small visual
        // counterpoint — ВЫБЕРИ rises, ПРИМЕРЬ enters from left,
        // ЗАБРОНИРУЙ enters from right. Three different attack
        // directions read as three distinct chapter punctuations.
        const targetX = THREE.MathUtils.lerp(12, 0, fadeIn) + fadeOut * -12;

        smoothOpacity.current = THREE.MathUtils.damp(smoothOpacity.current, targetOpacity, 10, dt);
        smoothX.current = THREE.MathUtils.damp(smoothX.current, targetX, 9, dt);

        ref.current.position.x = smoothX.current;
        const op = Math.max(0, smoothOpacity.current);
        if (ref.current.material) {
            ref.current.material.opacity = op;
        }
        ref.current.visible = op > 0.001;
    });

    return (
        <Text
            ref={ref}
            position={[12, floorY + 0.02, z]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={1.05}
            letterSpacing={0.04}
            color={brightColor}
            anchorX="center"
            anchorY="middle"
            font={fontUrl}
            sdfGlyphSize={128}
            fillOpacity={1}
            renderOrder={100}
        >
            ЗАБРОНИРУЙ
            <meshBasicMaterial
                color={brightColor}
                transparent
                opacity={0}
                toneMapped={false}
                depthTest={false}
                depthWrite={false}
            />
        </Text>
    );
}

/**
 * SceneBackgroundTransition — keeps the scene background damped toward
 * the dark Steel Atelier room color across all chapters. The previous
 * Ch2 light-theme flip was retired so the studio reads as one continuous
 * dark space; the bust on the podium is the new exhibit, not a new world.
 */
function SceneBackgroundTransition({
    darkBg,
}: {
    darkBg: THREE.Color;
    activeChapter?: React.RefObject<number>;
}) {
    const smoothR = useRef(darkBg.r);
    const smoothG = useRef(darkBg.g);
    const smoothB = useRef(darkBg.b);

    useFrame(({ scene }, delta) => {
        const dt = Math.min(delta, 0.05);

        smoothR.current = THREE.MathUtils.damp(smoothR.current, darkBg.r, 2.5, dt);
        smoothG.current = THREE.MathUtils.damp(smoothG.current, darkBg.g, 2.5, dt);
        smoothB.current = THREE.MathUtils.damp(smoothB.current, darkBg.b, 2.5, dt);

        if (scene.background instanceof THREE.Color) {
            scene.background.setRGB(smoothR.current, smoothG.current, smoothB.current);
        }
    });

    return null;
}

function ParallaxGroup({
    mouseRef,
    pointerActiveRef,
    ch2Phase,
    children,
}: {
    mouseRef: React.RefObject<{ x: number; y: number }>;
    pointerActiveRef: React.RefObject<boolean>;
    ch2Phase?: React.RefObject<number>;
    children: React.ReactNode;
}) {
    const groupRef = useRef<THREE.Group>(null);
    const pos = useRef({ x: 0, y: 0 });
    const vel = useRef({ x: 0, y: 0 });
    // Smoothed target — prevents spring jolts when pointer leaves.
    const smoothTarget = useRef({ x: 0, y: 0 });

    useFrame((_, delta) => {
        if (!groupRef.current) return;
        const dt = Math.min(delta, 0.05);
        const m = mouseRef.current;

        // Parallax fades out across Ch2 entry — by ph2 = 0.4 (just
        // before stage D / floor close-up) the camera is fully static.
        // The clinical "single careful piercer" voice doesn't react
        // to mouse jitter once the viewer has settled into the floor.
        const ph2 = ch2Phase?.current ?? 0;
        const parallaxStrength = 1 - smoothstep(0.0, 0.4, ph2);

        // Raw target: follow mouse when active, return to center when outside
        const active = pointerActiveRef.current;
        const rawTx = active ? m.x * 0.55 * parallaxStrength : 0;
        const rawTy = active ? m.y * 0.3 * parallaxStrength : 0;

        // Smooth the target itself to prevent spring jolts
        const tLerp = 1 - Math.exp(-(active ? 6 : 2) * dt);
        smoothTarget.current.x += (rawTx - smoothTarget.current.x) * tLerp;
        smoothTarget.current.y += (rawTy - smoothTarget.current.y) * tLerp;

        const tx = smoothTarget.current.x;
        const ty = smoothTarget.current.y;

        // Damped spring: F = -k*(pos - target) - c*vel
        // Underdamped (ratio ~0.63) for subtle overshoot → organic feel
        const k = 18;
        const c = 6;

        const ax = -k * (pos.current.x - tx) - c * vel.current.x;
        const ay = -k * (pos.current.y - ty) - c * vel.current.y;

        vel.current.x += ax * dt;
        vel.current.y += ay * dt;
        pos.current.x += vel.current.x * dt;
        pos.current.y += vel.current.y * dt;

        groupRef.current.position.x = pos.current.x;
        groupRef.current.position.y = pos.current.y;
    });

    return <group ref={groupRef}>{children}</group>;
}

/**
 * Procedural jewelry piece that materializes inside the glass ring.
 * Uses different geometries per index to represent different jewelry types.
 * Transitions: old piece slides out with fade, new piece slides in.
 */
/** Stylized procedural jewelry geometries — recognisable piercing types. */

/** Merge sub-geometries after normalising to non-indexed so attributes are compatible. */
function mergeNonIndexed(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const ni = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    const merged = mergeGeometries(ni);
    // Dispose temporaries that toNonIndexed created
    ni.forEach((g, i) => {
        if (g !== geos[i]) g.dispose();
    });
    return merged!;
}

function makeCrossEarring(): THREE.BufferGeometry {
    // Substantial hoop ring at top (ear hook)
    const hoop = new THREE.TorusGeometry(0.09, 0.018, 24, 48);
    hoop.translate(0, 0.32, 0);
    // Small bail loop connecting hoop to cross
    const bail = new THREE.TorusGeometry(0.025, 0.01, 12, 16, Math.PI);
    bail.rotateZ(Math.PI);
    bail.translate(0, 0.22, 0);
    // Rectangular cross pendant — flat bars, slightly tapered
    const armW = 0.038; // bar width
    const armD = 0.016; // bar depth (flat)
    const vBar = new THREE.BoxGeometry(armW, 0.32, armD);
    vBar.translate(0, 0.0, 0);
    const hBar = new THREE.BoxGeometry(0.2, armW, armD);
    hBar.translate(0, 0.08, 0);
    const g = mergeNonIndexed([hoop, bail, vBar, hBar]);
    g.scale(3.5, 3.5, 3.5);
    return g;
}

function makeLabret(): THREE.BufferGeometry {
    const shaft = new THREE.CylinderGeometry(0.025, 0.025, 0.35, 16);
    const ball = new THREE.SphereGeometry(0.065, 24, 24);
    ball.translate(0, 0.175 + 0.06, 0);
    const disc = new THREE.CylinderGeometry(0.06, 0.06, 0.015, 24);
    disc.translate(0, -0.175, 0);
    const g = mergeNonIndexed([shaft, ball, disc]);
    // Lay sideways (like septum ring)
    g.rotateX(Math.PI / 2);
    g.scale(3.4, 3.4, 3.4);
    return g;
}

function makeHoopEarring(): THREE.BufferGeometry {
    const hoop = new THREE.TorusGeometry(0.22, 0.025, 24, 64);
    // Small clasp ball
    const clasp = new THREE.SphereGeometry(0.04, 16, 16);
    clasp.translate(0.22, 0, 0);
    const g = mergeNonIndexed([hoop, clasp]);
    g.scale(4.0, 4.0, 4.0);
    return g;
}

function makeStudEarring(): THREE.BufferGeometry {
    // Faceted gem (octahedron = diamond-like)
    const gem = new THREE.OctahedronGeometry(0.1, 0);
    gem.translate(0, 0.06, 0);
    // Decorative bezel ring around gem
    const bezel = new THREE.TorusGeometry(0.11, 0.015, 8, 24);
    bezel.rotateX(Math.PI / 2);
    bezel.translate(0, 0.06, 0);
    // Post
    const post = new THREE.CylinderGeometry(0.02, 0.02, 0.22, 12);
    post.translate(0, -0.11, 0);
    // Butterfly back
    const backDisc = new THREE.CylinderGeometry(0.055, 0.055, 0.012, 16);
    backDisc.translate(0, -0.22, 0);
    const g = mergeNonIndexed([gem, bezel, post, backDisc]);
    // Lay sideways (like septum ring)
    g.rotateX(Math.PI / 2);
    g.scale(4.5, 4.5, 4.5);
    return g;
}

function makeBarbell(): THREE.BufferGeometry {
    const bar = new THREE.CylinderGeometry(0.022, 0.022, 0.45, 16);
    bar.rotateZ(Math.PI / 2); // horizontal
    const ballL = new THREE.SphereGeometry(0.06, 20, 20);
    ballL.translate(-0.225, 0, 0);
    const ballR = new THREE.SphereGeometry(0.06, 20, 20);
    ballR.translate(0.225, 0, 0);
    const g = mergeNonIndexed([bar, ballL, ballR]);
    g.scale(3.9, 3.9, 3.9);
    return g;
}

function makeSeptumRing(): THREE.BufferGeometry {
    // Horseshoe / circular barbell — half-torus with ball ends
    const curve = new THREE.TorusGeometry(0.18, 0.025, 20, 32, Math.PI);
    // Ball ends at each tip of the half-torus
    const ballA = new THREE.SphereGeometry(0.05, 16, 16);
    ballA.translate(-0.18, 0, 0);
    const ballB = new THREE.SphereGeometry(0.05, 16, 16);
    ballB.translate(0.18, 0, 0);
    const g = mergeNonIndexed([curve, ballA, ballB]);
    g.scale(4.9, 4.9, 4.9);
    return g;
}

function makeRingTorus(): THREE.BufferGeometry {
    return new THREE.TorusGeometry(1, 0.12, 128, 384);
}

/* Aligned 1:1 with ROSTER in JewelryShowcase.tsx so activeJewelry=N
   shows the same piece in 3D as the rolodex names. The hero floating
   torus IS the first carousel item ("Кольцо"). makeHoopEarring is
   no longer used (the hoop entry was dropped from the roster). */
const PIECE_GEOMETRIES = [
    makeRingTorus, // 0: Кольцо (hero ring)
    makeCrossEarring, // 1: Крест-серьга
    makeLabret, // 2: Лабрет
    makeStudEarring, // 3: Пусета
    makeBarbell, // 4: Штанга
    makeSeptumRing, // 5: Септум
];

/**
 * Anchor positions + normals for the chapter-2 exhibit, in body-local
 * coordinates. GlassPiece computes the world target each frame by
 * scaling these by the current effective body scale (MODEL_SCALE ×
 * boost) and adding BUST_POSITION + MODEL_Y_OFFSET. This matches
 * BodyModel's transform exactly so the jewelry tracks the body when
 * the Ch2 boost ramps in/out.
 */
const BUST_ANCHORS_LOCAL = ANCHORS_LOCAL;

const BUST_POSITION: [number, number, number] = [0, 0, EXHIBIT_Z];

/* Legacy positions-only world map — only consumed by the dead
   WireframeBust component (BodyModel replaced it). Kept so the file
   typechecks; all live code paths read BUST_ANCHORS_LOCAL. */
const BUST_ANCHORS: Record<string, [number, number, number]> = Object.fromEntries(
    Object.entries(ANCHORS_LOCAL).map(([key, a]) => [
        key,
        [
            a.position[0] * MODEL_SCALE,
            MODEL_Y_OFFSET + a.position[1] * MODEL_SCALE,
            a.position[2] * MODEL_SCALE,
        ] as [number, number, number],
    ])
);

/**
 * Wireframe head-and-shoulders bust with anchor dots at the six body
 * piercing zones. Sits centered on the same exhibit pedestal that
 * carried the jewelry in Chapter 1 — a literal museum bust on its
 * stand, signalling continuity rather than a scene change.
 *
 * Visible when Chapter 2 is active; scales 0→1 with damped lerp.
 */
function WireframeBust({
    activeChapter,
    activeArea,
    color,
    opacity,
}: {
    activeChapter?: React.RefObject<number>;
    activeArea: string;
    color: THREE.Color;
    opacity: number;
}) {
    const groupRef = useRef<THREE.Group>(null);
    const smoothScale = useRef(0);

    // Profile silhouette — frontal head + neck + shoulders + chest taper.
    const bustGeom = useMemo(() => {
        // Head: oval, top at y=+1.5, sides at y=+0.6, bottom at y=-0.2
        const head: [number, number, number][] = [];
        const segs = 28;
        for (let i = 0; i <= segs; i++) {
            const t = (i / segs) * Math.PI * 2;
            const x = Math.sin(t) * 0.62;
            const y = 0.7 + Math.cos(t) * 0.85;
            head.push([x, y, 0]);
        }

        // Neck: two parallel verticals from head bottom (y=-0.15) to
        // shoulder line (y=-1.0).
        const neckLeft: [number, number, number][] = [
            [-0.32, -0.15, 0],
            [-0.32, -1.0, 0],
        ];
        const neckRight: [number, number, number][] = [
            [0.32, -0.15, 0],
            [0.32, -1.0, 0],
        ];

        // Shoulders + chest taper: from shoulder ends out to ~±2.0 then
        // sloping down to chest taper at (±0.4, -2.5).
        const shoulders: [number, number, number][] = [
            [-0.32, -1.0, 0],
            [-1.4, -1.2, 0],
            [-2.0, -1.5, 0],
            [-1.5, -2.1, 0],
            [-0.6, -2.4, 0],
            [0.6, -2.4, 0],
            [1.5, -2.1, 0],
            [2.0, -1.5, 0],
            [1.4, -1.2, 0],
            [0.32, -1.0, 0],
        ];

        const verts: number[] = [];
        const pushLine = (a: [number, number, number], b: [number, number, number]) => {
            verts.push(...a, ...b);
        };

        for (let i = 0; i < head.length - 1; i++) pushLine(head[i], head[i + 1]);
        pushLine(neckLeft[0], neckLeft[1]);
        pushLine(neckRight[0], neckRight[1]);
        for (let i = 0; i < shoulders.length - 1; i++) pushLine(shoulders[i], shoulders[i + 1]);

        const geom = new THREE.BufferGeometry();
        geom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
        return geom;
    }, []);

    useEffect(() => () => bustGeom.dispose(), [bustGeom]);

    useFrame((state, delta) => {
        if (!groupRef.current) return;
        const dt = Math.min(delta, 0.05);

        const visible = (activeChapter?.current ?? 0) === 2;
        const targetScale = visible ? 1 : 0;
        smoothScale.current = THREE.MathUtils.damp(smoothScale.current, targetScale, 3, dt);

        const s = smoothScale.current;
        groupRef.current.scale.set(s, s, s);

        // Gentle lateral sway — clinical, not lifelike. Half the amplitude
        // of the previous ear sway so the bust reads as a still exhibit.
        groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.05;
    });

    return (
        <group ref={groupRef} position={BUST_POSITION} scale={0}>
            <lineSegments geometry={bustGeom}>
                <lineBasicMaterial color={color} transparent opacity={opacity} />
            </lineSegments>
            {Object.entries(BUST_ANCHORS).map(([key, pos], i) => (
                <AnchorDot
                    key={key}
                    position={pos}
                    delay={i * 0.15}
                    activeChapter={activeChapter}
                    isActive={key === activeArea}
                />
            ))}
        </group>
    );
}

/**
 * Pulsing accent anchor dot. The active anchor is rendered larger and
 * fully saturated; inactive anchors stay small and dim, marking the
 * available zones without competing with the active one.
 */
function AnchorDot({
    position,
    delay,
    activeChapter,
    isActive,
}: {
    position: [number, number, number];
    delay: number;
    activeChapter?: React.RefObject<number>;
    isActive: boolean;
}) {
    const ref = useRef<THREE.Mesh>(null);
    const smoothScale = useRef(0);
    const smoothActive = useRef(0);

    useFrame((state, delta) => {
        if (!ref.current) return;
        const dt = Math.min(delta, 0.05);

        const visible = (activeChapter?.current ?? 0) === 2;
        const targetScale = visible ? 1 : 0;
        smoothScale.current = THREE.MathUtils.damp(smoothScale.current, targetScale, 2, dt);

        const targetActive = isActive ? 1 : 0;
        smoothActive.current = THREE.MathUtils.damp(smoothActive.current, targetActive, 4, dt);

        // Active anchor is 1.6× the inactive size with stronger pulse.
        const sizeMul = 1 + smoothActive.current * 0.6;
        const pulseAmp = 0.08 + smoothActive.current * 0.18;
        const pulse = 1 + Math.sin(state.clock.elapsedTime * 2 + delay * 10) * pulseAmp;
        const s = smoothScale.current * pulse * sizeMul;
        ref.current.scale.set(s, s, s);
    });

    return (
        <mesh ref={ref} position={position} scale={0}>
            <sphereGeometry args={[0.04, 16, 16]} />
            <meshStandardMaterial
                color="#f06ba0"
                emissive="#f06ba0"
                emissiveIntensity={2}
                toneMapped={false}
            />
        </mesh>
    );
}

export default function WireframeRoom({
    scopeRef,
    fontUrl,
    mouseRef,
    pointerActiveRef,
    onReady,
    revealed = false,
    scrollPhase,
    ch2Phase,
    ch2TitlePhase,
    ch2BodyPhase,
    activeChapter,
    activeJewelry = 0,
    activeArea = "ear_left",
    transitionProgress,
    swapDirection,
    scrollVelocity,
    settlePulseRef,
    chapter2Phase,
    ch3TitlePhase,
}: {
    scopeRef: React.RefObject<HTMLElement | null>;
    fontUrl: string;
    mouseRef: React.RefObject<{ x: number; y: number }>;
    pointerActiveRef: React.RefObject<boolean>;
    onReady?: () => void;
    revealed?: boolean;
    scrollPhase?: React.RefObject<number>;
    /* Scroll-driven Ch1→Ch2 transition phase (0 outside, 1 once Ch2
       fills viewport). Drives the multi-stage camera storyboard +
       body materialization. Now derived from ch2DescentPhase * 0.5 +
       ch2TitlePhase * 0.5 so the storyboard plays in 0→0.5 (Ch2Descent)
       and the held floor view occupies 0.5→1.0 (Ch2Title). */
    ch2Phase?: React.RefObject<number>;
    /* Scroll-driven progress through the Ch2Title section's own 100vh
       (0 at section top, 1 at section bottom). Drives the ПРИМЕРЬ
       floating title animation independently from ch2Phase so the
       title's slide-in/hold/slide-out beats land precisely against
       the Ch2Title section regardless of how the combined ch2Phase
       evolves. */
    ch2TitlePhase?: React.RefObject<number>;
    /* Same shape as ch2TitlePhase but for the Ch3Intro section.
       Drives the floating ЗАБРОНИРУЙ title (slide-in/hold/slide-out
       on the floor stage, mutually exclusive with ПРИМЕРЬ thanks to
       section-snap pacing). */
    ch3TitlePhase?: React.RefObject<number>;
    /* Scroll-driven progress through Ch2 itself (0 at top, 1 at
       bottom). Drives the 3D-canvas→2D-grid hand-off. */
    ch2BodyPhase?: React.RefObject<number>;
    activeChapter?: React.RefObject<number>;
    activeJewelry?: number;
    activeArea?: string;
    transitionProgress?: React.RefObject<number>;
    swapDirection?: React.RefObject<number>;
    scrollVelocity?: React.RefObject<number>;
    /* One-shot trigger ref for the settle bloom pulse. GlassPiece writes
       a 1 here when the 1080° reveal completes; ProximityBloom reads
       and clears it to fire a brief intensity pulse. Optional — when
       not provided, the bloom pass behaves as before. */
    settlePulseRef?: React.RefObject<number>;
    /* Scroll-driven progress through Chapter 2's own scroll-through
       (0 when Chapter 2 enters viewport top, 1 when user has scrolled
       1 viewport into it). Drives the Ch2BackgroundGrid plane:
       fade-in opacity, scroll-translation of the grid-line layer, and
       a 10-% faster parallax translation of the plus-mark layer. */
    chapter2Phase?: React.RefObject<number>;
}) {
    const colors = useThemeColors(scopeRef);
    const reducedMotion = useReducedMotion();

    // Dark ink stamp colour for ЗАБРОНИРУЙ — the title appears once
    // the Ch2 paper plane (#e8e5dd) has fully covered the camera view,
    // where the white-luminous treatment used by ВЫБЕРИ / ПРИМЕРЬ
    // would render invisible. Memoised so AnimatedReserveText's
    // useMemo dependency stays stable. The component still applies
    // its HDR multiply (×1.6) inside, but on a near-black input the
    // multiply just clamps to a slightly lighter very-dark grey —
    // visually still reads as ink on paper.
    const paperInk = useMemo(() => new THREE.Color("#0a0a0a"), []);

    // Shared Ch2 transition ramp (0 outside, 1 inside Ch2). Updated
    // by <ChapterFade/> each frame; consumed by CameraDolly, FaceGrid
    // walls, the pink rim light, and any other Ch2-reactive piece.
    const ch2T = useRef(0);

    // Room dimensions (arbitrary units).
    const W = 20;
    const H = 12;
    const D = 34;
    /* Floor depth — extends further forward than the room so when
       the camera flies back to A_Z (~-3) and tilts straight down at
       stage D, the gaze cone still hits floor on both sides instead
       of cutting off into void at z > 0. Floor center stays at
       z = -D/2 = -17, so the back stays anchored to the back wall;
       the extra length (FLOOR_DEPTH - D) extends FORWARD past the
       room's front edge, into the area the camera occupies. */
    const FLOOR_DEPTH = 60;
    const FLOOR_Z_CENTER = (-D + (FLOOR_DEPTH - D)) / 2; // shift forward by half the extension

    // Distance from camera to back wall.
    // At FOV 60°, viewport half-height = distance * tan(30°). For
    // the full back wall to fit with a touch of overflow (so walls
    // are visible converging toward it), distance needs to be
    // ~slightly less than H/(2*tan(30°)) ≈ 10.4. Pushed a bit
    // further so the corridor is clearly readable.
    const distToBack = 13;
    const cameraZ = -D + distToBack;
    const backDist = distToBack;

    return (
        <Canvas
            dpr={[1, 2]}
            camera={{
                fov: FOV_START,
                position: [0, 0, cameraZ + DOLLY_OFFSET],
                near: 0.1,
                far: backDist + 30,
            }}
            onCreated={({ camera }) => {
                // Camera sits close to the back wall and looks TOWARD it
                // (i.e. further along -Z). Without this, r3f points the
                // camera at the origin, so the back wall ends up behind
                // the camera and the corridor appears reversed.
                camera.lookAt(0, 0, -D);
            }}
            gl={{ antialias: true, alpha: true }}
            style={{ position: "absolute", inset: 0 }}
        >
            <ChapterFade ch2Phase={ch2Phase} ch2T={ch2T} />
            <CameraDolly
                restZ={cameraZ}
                revealed={revealed}
                scrollPhase={scrollPhase}
                ch2Phase={ch2Phase}
                activeChapter={activeChapter}
                ch2T={ch2T}
                reducedMotion={reducedMotion}
                roomH={H}
                scrollVelocity={scrollVelocity}
            />
            {/* Scene background matches the CSS theme bg. This is
                critical for MeshTransmissionMaterial: the glass
                refracts by sampling the scene into its own back-buffer,
                and between our wireframe lines there is no geometry.
                Without this <color/>, empty space samples as black,
                making the ring look dark. With it, the glass refracts
                the same bone-paper / dark-navy color the user sees
                behind the canvas, so it reads as truly transparent. */}
            <color attach="background" args={[colors.bg.r, colors.bg.g, colors.bg.b]} />
            {/* Smooth dark→light background transition for Ch2 */}
            <SceneBackgroundTransition darkBg={colors.bg} activeChapter={activeChapter} />
            <ParallaxGroup
                mouseRef={mouseRef}
                pointerActiveRef={pointerActiveRef}
                ch2Phase={ch2Phase}
            >
                {/* Room walls — fade out in Ch2 (fadeOutRef={ch2T}) so the
                close-up orbit reads as a portrait against pure background.
                Floor is the one exception — no fadeOutRef — so the orbit
                still has a ground reference. */}
                <FaceGrid
                    width={W}
                    height={H}
                    position={[0, 0, -D]}
                    minorColor={colors.minor}
                    minorAlpha={colors.minorAlpha}
                    majorColor={colors.major}
                    majorAlpha={colors.majorAlpha}
                    crossColor={colors.crossColor}
                    crossAlpha={colors.crossAlpha}
                    fadeOutRef={ch2T}
                />
                {/* Floor — visible during the dark-room sections (Hero,
                Ch1, Ch2Intro orbit) as a ground reference. Wrapped in
                <Ch2FloorVisibility/> which toggles the group's `visible`
                attribute off when chapter2Phase ≥ 0.05 — the floor's
                cross/plus marks render with depthTest=false and would
                otherwise punch through the body silhouette in the
                close-up (FaceGrid materials don't set transparent, so
                an alpha-fade via fadeOutRef wouldn't actually hide
                them). Floor depth is extended (FLOOR_DEPTH > D) and
                shifted forward so the camera's straight-down gaze at
                stage D still hits floor instead of cutting off into
                void past z=0. */}
                <Ch2FloorVisibility chapter2Phase={chapter2Phase}>
                    <FaceGrid
                        width={W}
                        height={FLOOR_DEPTH}
                        position={[0, -H / 2, FLOOR_Z_CENTER]}
                        rotation={[-Math.PI / 2, 0, 0]}
                        minorColor={colors.minor}
                        minorAlpha={colors.minorAlpha}
                        majorColor={colors.major}
                        majorAlpha={colors.majorAlpha}
                        crossColor={colors.crossColor}
                        crossAlpha={colors.crossAlpha}
                    />
                </Ch2FloorVisibility>
                <FaceGrid
                    width={W}
                    height={D}
                    position={[0, H / 2, -D / 2]}
                    rotation={[Math.PI / 2, 0, 0]}
                    minorColor={colors.minor}
                    minorAlpha={colors.minorAlpha}
                    majorColor={colors.major}
                    majorAlpha={colors.majorAlpha}
                    crossColor={colors.crossColor}
                    crossAlpha={colors.crossAlpha}
                    fadeOutRef={ch2T}
                />
                <FaceGrid
                    width={D}
                    height={H}
                    position={[-W / 2, 0, -D / 2]}
                    rotation={[0, Math.PI / 2, 0]}
                    minorColor={colors.minor}
                    minorAlpha={colors.minorAlpha}
                    majorColor={colors.major}
                    majorAlpha={colors.majorAlpha}
                    crossColor={colors.crossColor}
                    crossAlpha={colors.crossAlpha}
                    fadeOutRef={ch2T}
                />
                <FaceGrid
                    width={D}
                    height={H}
                    position={[W / 2, 0, -D / 2]}
                    rotation={[0, -Math.PI / 2, 0]}
                    minorColor={colors.minor}
                    minorAlpha={colors.minorAlpha}
                    majorColor={colors.major}
                    majorAlpha={colors.majorAlpha}
                    crossColor={colors.crossColor}
                    crossAlpha={colors.crossAlpha}
                    fadeOutRef={ch2T}
                />

                {/* Wordmark lives in the 3D scene so the glass ring in
                front of it physically refracts the letters. Sits just
                in front of the back wall, same layer as the corridor's
                vanishing point. Wrapped in Suspense because drei's
                <Text/> suspends while its font atlas loads — without a
                boundary, the suspension would unmount the entire Canvas
                subtree and render nothing. */}
                <Suspense fallback={null}>
                    <AnimatedWordmark
                        baseZ={-D + 3}
                        color={colors.luminous}
                        fontUrl={fontUrl}
                        scrollPhase={scrollPhase}
                    />

                    {/* ВЫБЕРИ — chapter divider title between hero and
                    Chapter 1. Placed at z=-10 — closer to the camera
                    than the ring's exhibit position (z=-12) so the
                    text reads as a floating title *in front of* the
                    ring, not behind it. y=+1.0 lifts it above the
                    ring so the two don't overlap. */}
                    <AnimatedChooseText
                        z={-10}
                        color={colors.luminous}
                        fontUrl={fontUrl}
                        scrollPhase={scrollPhase}
                    />

                    {/* ПРИМЕРЬ — Ch2 intro title, laid FLAT on the
                    floor at z=-3 (directly under the storyboard
                    camera's straight-down gaze when the dolly settles).
                    A vertical mesh would render edge-on against the
                    straight-down camera and disappear, so the title
                    is rotated -π/2 about X to lie horizontal on the
                    floor. Same slide-in / hold / slide-out vocabulary
                    and HDR-pushed bloom treatment as ВЫБЕРИ. */}
                    <AnimatedPrimerText
                        floorY={-H / 2}
                        z={-3}
                        color={colors.luminous}
                        fontUrl={fontUrl}
                        ch2TitlePhase={ch2TitlePhase}
                    />

                    {/* ЗАБРОНИРУЙ — Ch3Intro title, also flat on the
                    floor at z=-3 (same as ПРИМЕРЬ — the camera at
                    apex sits at world (0, 0, ~-3) gazing straight
                    down, so z=-3 projects to screen center). Stamped
                    in dark ink (paperInk) instead of luminous bloom
                    because by the time this title appears the Ch2
                    paper plane has fully covered the camera view —
                    light-on-light would be invisible. */}
                    <AnimatedReserveText
                        floorY={-H / 2}
                        z={-3}
                        color={paperInk}
                        fontUrl={fontUrl}
                        ch3TitlePhase={ch3TitlePhase}
                    />

                    {/* Chapter 2 background grid — camera-relative
                        plane that fades in as user scrolls into Chapter 2.
                        Lives inside Suspense + the scene tree so the
                        FluidTrailEffect post-process pass distorts it
                        on cursor movement. */}
                    <Ch2BackgroundGrid chapter2Phase={chapter2Phase} />

                    {/* Chapter 2 body model — same body.glb the catalog
                        uses. Slides in from the right and spins around
                        its vertical axis during entry. Sits in front
                        of the grid plane (closer to camera) so it
                        renders on top via standard depth test. */}
                    <Ch2BodyModel chapter2Phase={chapter2Phase} />

                    {onReady && <ReadinessSignal onReady={onReady} />}
                </Suspense>

                {/* Lighting for the glass piece. Synthetic bright-white
                environment with Lightformers for crisp highlights.
                Cinematic top spotlight with scroll-driven temperature shift. */}
                <directionalLight position={[0, 2, cameraZ + 3]} intensity={0.3} />
                <ExhibitionLight z={cameraZ - 6} scrollPhase={scrollPhase} />
                <PinkRimLight ch2Phase={ch2Phase} />
                <Environment resolution={256}>
                    {/* Fully enclosing bright sphere \u2014 any reflection ray
                    that misses a lightformer hits this and gets bright
                    white instead of black void. */}
                    <mesh scale={100}>
                        <sphereGeometry args={[1, 32, 32]} />
                        <meshBasicMaterial color="#000000" side={THREE.BackSide} />
                    </mesh>
                    {/* Bright top hemisphere rim \u2014 cinematic exhibition key */}
                    <Lightformer
                        form="ring"
                        intensity={5}
                        position={[0, 8, 0]}
                        rotation={[Math.PI / 2, 0, 0]}
                        scale={[6, 6, 1]}
                        color="#fffdf5"
                    />
                    {/* Warm side key */}
                    <Lightformer
                        form="rect"
                        intensity={2}
                        position={[8, 2, 2]}
                        rotation={[0, -Math.PI / 2, 0]}
                        scale={[10, 10, 1]}
                        color="#fff4dd"
                    />
                    {/* Cool fill */}
                    <Lightformer
                        form="rect"
                        intensity={1.5}
                        position={[-8, 2, 2]}
                        rotation={[0, Math.PI / 2, 0]}
                        scale={[10, 10, 1]}
                        color="#dce6ff"
                    />
                </Environment>

                {/* Podium — permanent fixture at EXHIBIT_Z, rooted to the
                room floor. Sits behind the hero camera (invisible) and
                in front of the chapter-1 camera (visible). The camera
                pull-back reveals it organically — no fade animation.
                Solid dark cylinders matching the scene bg, with the
                full minor+major+cross grid pattern matching the walls. */}
                <Podium
                    z={EXHIBIT_Z}
                    bgColor={colors.bg}
                    minorColor={colors.minor}
                    minorAlpha={colors.minorAlpha}
                    majorColor={colors.major}
                    majorAlpha={colors.majorAlpha}
                    crossColor={colors.crossColor}
                    crossAlpha={colors.crossAlpha}
                />

                {/* Glass piece — ring (index 0) or jewelry (1-6). Starts at
                HERO_RING_Z (close, original hero size) and drifts back
                to EXHIBIT_Z as the camera pulls back, so by Chapter 1
                the piece sits on the podium. Drift is handled inside
                GlassPiece's useFrame. */}
                <GlassPiece
                    z={HERO_RING_Z}
                    mouseRef={mouseRef}
                    pointerActiveRef={pointerActiveRef}
                    scrollPhase={scrollPhase}
                    ch2Phase={ch2Phase}
                    activeChapter={activeChapter}
                    activeJewelry={activeJewelry}
                    activeArea={activeArea}
                    transitionProgress={transitionProgress}
                    swapDirection={swapDirection}
                    scrollVelocity={scrollVelocity}
                    settlePulseRef={settlePulseRef}
                    reducedMotion={reducedMotion}
                />

                {/* Dust motes drift in the hero focal area so they're visible
                as atmosphere around the floating ring. Stay there during
                Chapter 1 too — distant background haze behind the exhibit. */}
                <DustMotes
                    z={HERO_RING_Z}
                    activeChapter={activeChapter}
                    scrollVelocity={scrollVelocity}
                />

                {/* The 3D body model on the podium has been retired —
                Ch2 is rendered as a 2D anatomy diagram (Ch2BodyOverlay)
                above the 2D grid, and the podium top tier carries
                only the GlassPiece jewelry across all chapters. The
                BodyModel component file + GLB asset are kept intact
                for the variant pages (page12, new-design-cinematic,
                new-design-editorial) that still consume it; only the
                canonical mount is removed. */}
            </ParallaxGroup>
            <EffectComposer>
                <FluidTrailEffect
                    mouseRef={mouseRef}
                    isDark={colors.bg.r < 0.5}
                    revealed={revealed}
                />
                <ProximityBloom
                    mouseRef={mouseRef}
                    baseIntensity={0.4}
                    maxIntensity={0.8}
                    transitionProgress={transitionProgress}
                    settlePulseRef={settlePulseRef}
                />
            </EffectComposer>
        </Canvas>
    );
}
