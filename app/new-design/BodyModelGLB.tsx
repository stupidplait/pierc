"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Environment } from "@react-three/drei";
import * as THREE from "three";
import { Object3D } from "three";
import styles from "./page.module.css";

/**
 * BodyModelGLB — the 3D body that rotates in from the right over the
 * 2D grid backdrop in Ch2. References NFS Carbon's character intro:
 * the model enters off-screen-right facing sideways, rotates as it
 * slides centered, and settles in a slight 3/4 angle for cinematic
 * weight (not dead-on, which always feels flat).
 *
 * Lives in its own R3F Canvas because the main WireframeRoom canvas
 * is occluded by the opaque 2D grid (Ch2GridOverlay) once it covers
 * the screen. This canvas sits *on top* of the grid (z-index 2 via
 * .ch2BodyCanvas) so the model reads as the figure on the floor.
 *
 * Entry animation tied to `ch2BodyPhase` (0 = top of Ch2, 1 = bottom):
 *   • ph 0.30 → 0.55  slide-in from right + rotate to 3/4 (ease-out-cubic)
 *   • ph 0.55 → 0.85  held in final pose, gentle idle bob
 *   • ph 0.85 → 0.95  fade-out + small slide back right
 *                     (so the body doesn't crash into the footer)
 *
 * Visibility is also opacity-gated by --ch2-body-reveal which
 * BodyModelPreview writes per-frame on the chapter root, ramping
 * 0 → 1 across the same entry window and back to 0 across exit.
 */
interface BodyModelGLBProps {
    ch2BodyPhase: React.RefObject<number>;
}

const ENTRY_START = 0.30;
const ENTRY_END = 0.55;
const EXIT_START = 0.85;
const EXIT_END = 0.95;

function BodyMesh({ ch2BodyPhase }: { ch2BodyPhase: React.RefObject<number> }) {
    const groupRef = useRef<THREE.Group>(null);
    const gltf = useGLTF("/models/body/body.glb");

    // Hide the anchor:* empties so they don't show as visible nulls.
    // Their transforms remain in the scene graph for any future code
    // path that reads them via scene.getObjectByName("anchor:slug").
    const sceneRef = useRef<THREE.Object3D | null>(null);
    if (sceneRef.current !== gltf.scene) {
        sceneRef.current = gltf.scene;
        gltf.scene.traverse((obj: Object3D) => {
            if (obj.name.startsWith("anchor:")) {
                obj.visible = false;
            }
        });
    }

    useFrame((state) => {
        const ph = ch2BodyPhase.current ?? 0;
        const tEntry = Math.max(0, Math.min(1, (ph - ENTRY_START) / (ENTRY_END - ENTRY_START)));
        const easedEntry = 1 - Math.pow(1 - tEntry, 3); // easeOutCubic

        // Exit slide — small movement back to the right + scale-down.
        const tExit = Math.max(0, Math.min(1, (ph - EXIT_START) / (EXIT_END - EXIT_START)));
        const easedExit = tExit * tExit * (3 - 2 * tExit); // smoothstep

        if (!groupRef.current) return;

        // NFS Carbon swoop:
        //   • X: starts +3.0 (off-stage right), reaches 0 (centered)
        //     after entry, drifts back to +1.5 during exit.
        //   • Y rotation: starts -π/2 (right side profile), settles
        //     to -0.32 (~18° three-quarter angle), continues to -0.5
        //     during exit so the figure "turns away" as it leaves.
        //   • Scale: subtle 0.92 → 1.0 → 0.88 (slight zoom-in then
        //     pull-back as it exits).
        const xEntry = (1 - easedEntry) * 3.0;
        const xExit = easedExit * 1.5;
        groupRef.current.position.x = xEntry + xExit;

        const rotEntry = THREE.MathUtils.lerp(-Math.PI / 2, -0.32, easedEntry);
        const rotExit = easedExit * (-0.18); // additional turn-away
        groupRef.current.rotation.y = rotEntry + rotExit;

        const scaleEntry = THREE.MathUtils.lerp(0.92, 1.0, easedEntry);
        const scaleExit = THREE.MathUtils.lerp(1.0, 0.88, easedExit);
        const s = scaleEntry * scaleExit;
        groupRef.current.scale.set(s, s, s);

        // Gentle idle breath once settled — only during the held
        // window (after entry, before exit). Tiny vertical bob + tilt.
        const settled = easedEntry > 0.95 && easedExit < 0.05 ? 1 : 0;
        const elapsed = state.clock.elapsedTime;
        groupRef.current.position.y = Math.sin(elapsed * 0.7) * 0.012 * settled;
        groupRef.current.rotation.z = Math.sin(elapsed * 0.5) * 0.008 * settled;
    });

    return (
        <group ref={groupRef}>
            <primitive object={gltf.scene} />
        </group>
    );
}

export default function BodyModelGLB({ ch2BodyPhase }: BodyModelGLBProps) {
    return (
        <div className={styles.ch2BodyCanvas} aria-hidden="true">
            <Canvas
                camera={{ position: [0, 1.05, 2.6], fov: 28 }}
                gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
                dpr={[1, 2]}
                style={{ position: "absolute", inset: 0 }}
            >
                {/* Three-light setup matched to the room's vocabulary:
                    a strong key from camera-front-top, a soft fill, and
                    the signature pink rim light from camera-left.
                    Pink rim is what carries the new-design's accent
                    color across the chapter handoff. */}
                <ambientLight intensity={0.35} />
                <directionalLight
                    position={[1.2, 3.0, 3.5]}
                    intensity={2.4}
                    color="#ffffff"
                />
                <directionalLight
                    position={[-2.5, 1.8, 1.0]}
                    intensity={0.9}
                    color="#f06ba0"
                />
                <directionalLight
                    position={[0, -1.5, 2.0]}
                    intensity={0.25}
                    color="#7aa6ff"
                />

                <Suspense fallback={null}>
                    <Environment preset="studio" environmentIntensity={0.4} />
                    <BodyMesh ch2BodyPhase={ch2BodyPhase} />
                </Suspense>
            </Canvas>
        </div>
    );
}

useGLTF.preload("/models/body/body.glb");
