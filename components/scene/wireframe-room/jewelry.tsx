// Extracted from WireframeRoom.tsx (mechanical split — no logic changes).
import * as THREE from "three";
import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial } from "@react-three/drei";
import { DOLLY_LAMBDA, EXHIBIT_Z, HERO_RING_Z, MOTE_COUNT } from "./constants";
import { flyEasing } from "./easing";
import { PIECE_GEOMETRIES } from "./geometry";

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
export function GlassPiece({
    z,
    mouseRef,
    pointerActiveRef,
    scrollPhase,
    activeChapter,
    activeJewelry = 0,
    transitionProgress,
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
    const matRef = useRef<React.ComponentRef<typeof MeshTransmissionMaterial> | null>(null);
    const obcChained = useRef(false);

    // Chain Bayer dither onto MeshTransmissionMaterial's onBeforeCompile
    useEffect(() => {
        // The runtime instance is a MeshPhysicalMaterial subclass; the drei JSX
        // type marks its methods Readonly, so take a plain-material view to patch
        // onBeforeCompile / customProgramCacheKey imperatively.
        const mat = matRef.current as unknown as THREE.MeshPhysicalMaterial | null;
        if (!mat || obcChained.current) return;
        const orig = mat.onBeforeCompile?.bind(mat);
        mat.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms, renderer: THREE.WebGLRenderer) => {
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
    const lastInputTime = useRef(0);
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
        // Lazily stamp the initial "last input" time on the first frame so the
        // ref initializer stays pure (performance.now() is fine inside useFrame).
        if (lastInputTime.current === 0) lastInputTime.current = performance.now();
        const tp = transitionProgress?.current ?? 0;
        const sv = scrollVelocity?.current ?? 0;
        const elapsed = state.clock.elapsedTime;
        const ac = activeChapter?.current ?? 0;
        const sp = scrollPhase?.current ?? 0;

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
        const mat = ref.current.material as THREE.Material;
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
export function DustMotes({
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

    /* eslint-disable react-hooks/purity -- one-time random particle seed; useMemo re-seeds only when z changes */
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
    /* eslint-enable react-hooks/purity */

    const geometry = useMemo(() => {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        return g;
    }, [positions]);

    /* eslint-disable react-hooks/immutability -- in-place typed-array buffer animation each frame is the canonical r3f particle pattern */
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
    /* eslint-enable react-hooks/immutability */

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
