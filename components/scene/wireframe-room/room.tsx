// Extracted from WireframeRoom.tsx (mechanical split — no logic changes).
import * as THREE from "three";
import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { smoothstep } from "./easing";

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
export function CylinderGrid({
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
export function Podium({
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

export function ParallaxGroup({
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
