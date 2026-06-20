// Extracted from WireframeRoom.tsx (mechanical split — no logic changes).
import * as THREE from "three";
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";

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
export function Ch2BackgroundGrid({
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
