// Extracted from WireframeRoom.tsx (mechanical split — no logic changes).
import * as THREE from "three";
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Bloom } from "@react-three/postprocessing";
import type { BloomEffect } from "postprocessing";
import { EXHIBIT_Z } from "./constants";

/**
 * PinkRimLight — directional light gated by ch2Phase stage D. Reads
 * as a magenta catchlight on cheekbone + jewelry during the Ch2
 * close-up. Intensity ramps in only after the body has materialized
 * so the rim sweep coincides with the body becoming visible.
 */
export function PinkRimLight({ ch2Phase }: { ch2Phase?: React.RefObject<number> }) {
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

/**
 * B3: Exhibition spotlight that shifts color temperature based on scroll.
 * Cool white (#fff8ee) on hero → warm gold (#e1b24a) in Chapter 1.
 */
export function ExhibitionLight({ z, scrollPhase }: { z: number; scrollPhase?: React.RefObject<number> }) {
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
export function ProximityBloom({
    mouseRef,
    baseIntensity = 0.4,
    maxIntensity = 0.8,
    transitionProgress,
    settlePulseRef,
    isLight = false,
}: {
    mouseRef: React.RefObject<{ x: number; y: number }>;
    baseIntensity?: number;
    maxIntensity?: number;
    transitionProgress?: React.RefObject<number>;
    /* One-shot trigger from GlassPiece: when set to 1, fires a brief
       bloom-intensity pulse (sin shape, ~250 ms). Reset to 0
       immediately on consume so the same fire is never replayed. */
    settlePulseRef?: React.RefObject<number>;
    /* On the light "studio" room the white background (luminance 1.0)
       would itself bloom and glare. Raise the threshold above white so
       only the HDR ring highlights bloom, and ease the overall amount. */
    isLight?: boolean;
}) {
    const bloomRef = useRef<BloomEffect | null>(null);
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

        const rawTarget =
            baseIntensity + proximity * (maxIntensity - baseIntensity) + swapBoost + settleBoost;
        // Ease the bloom on the bright studio so the chrome ring sparkles
        // without the whole white room glowing.
        const target = isLight ? rawTarget * 0.5 : rawTarget;
        smoothIntensity.current = THREE.MathUtils.damp(smoothIntensity.current, target, 5, dt);
        bloomRef.current.intensity = smoothIntensity.current;

        // Threshold is set IMPERATIVELY (not as a prop) because it's a
        // BloomEffect constructor arg — changing it via props reconstructs the
        // effect inside EffectComposer, which under React 19 dev crashes the
        // canvas (circular-JSON while serializing the scene). Above pure-white
        // on the light studio so the #ffffff room doesn't bloom into glare;
        // only HDR highlights cross it. Lower on dark so the headline glows.
        const lum = bloomRef.current.luminanceMaterial;
        if (lum) lum.threshold = isLight ? 1.05 : 0.85;
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

/**
 * SceneBackgroundTransition — keeps the scene background damped toward
 * the dark Steel Atelier room color across all chapters. The previous
 * Ch2 light-theme flip was retired so the studio reads as one continuous
 * dark space; the bust on the podium is the new exhibit, not a new world.
 */
export function SceneBackgroundTransition({
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
