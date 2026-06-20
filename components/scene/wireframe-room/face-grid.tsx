// Extracted from WireframeRoom.tsx (mechanical split — no logic changes).
import * as THREE from "three";
import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";

export function FaceGrid({
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
