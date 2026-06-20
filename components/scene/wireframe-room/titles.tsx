// Extracted from WireframeRoom.tsx (mechanical split — no logic changes).
import * as THREE from "three";
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";

/**
 * Wordmark "PIERCERKZN" — fades in place and recedes into depth as the
 * user scrolls into chapter 1. No horizontal slide — the brand dissolves
 * where it stood, with a subtle Z push-back so it reads as receding rather
 * than fading flat.
 */
export function AnimatedWordmark({
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
    const ref = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.Material>>(null);
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
            renderOrder={-10}
        >
            PIERCERKZN
            <meshBasicMaterial
                color={color}
                transparent
                opacity={1}
                depthTest={true}
                depthWrite={false}
            />
        </Text>
    );
}

/**
 * AnimatedChooseText — "ВЫБЕРИ" rendered as a 3D Text mesh BEHIND the
 * exhibit ring. Reads as a backdrop chapter-divider title that the
 * exhibit (ring + podium) sits *in front of*, framing the brand beat.
 * Glows via toneMapped=false + HDR-pushed colour (the existing bloom
 * pass picks it up); depthTest=true so the foreground geometry occludes
 * it correctly.
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
export function AnimatedChooseText({
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
    const ref = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.Material>>(null);
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
            // Sits BEHIND the ring's exhibit position (z=-12), at z=-14,
            // so the ring + podium occlude it — a backdrop chapter title
            // the foreground exhibit stands in front of. Enlarged to read
            // at the greater distance from the Ch1 camera.
            fontSize={1.9}
            letterSpacing={0.04}
            color={brightColor}
            anchorX="center"
            anchorY="middle"
            font={fontUrl}
            sdfGlyphSize={128}
            fillOpacity={1}
            renderOrder={-10}
        >
            ВЫБЕРИ
            <meshBasicMaterial
                color={brightColor}
                transparent
                opacity={0}
                toneMapped={false}
                depthTest={true}
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
export function AnimatedPrimerText({
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
    const ref = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.Material>>(null);
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
            renderOrder={-10}
        >
            ПРИМЕРЬ
            <meshBasicMaterial
                color={brightColor}
                transparent
                opacity={0}
                toneMapped={false}
                depthTest={true}
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
export function AnimatedReserveText({
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
    const ref = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.Material>>(null);
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
            renderOrder={-10}
        >
            ЗАБРОНИРУЙ
            <meshBasicMaterial
                color={brightColor}
                transparent
                opacity={0}
                toneMapped={false}
                depthTest={true}
                depthWrite={false}
            />
        </Text>
    );
}
