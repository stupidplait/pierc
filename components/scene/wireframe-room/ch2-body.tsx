// Extracted from WireframeRoom.tsx (mechanical split — no logic changes).
import * as THREE from "three";
import { Suspense, useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import { CH2_VISIBLE_ANCHORS, CH2_DEFAULT_LOBE } from "./anchors";

export function Ch2AnchorMarker({
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

export function Ch2BodyModel({
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
export function Ch2BodyMesh({
    onAnchorFound,
}: {
    onAnchorFound?: (anchor: THREE.Object3D) => void;
}) {
    // Self-hosted Draco decoder (public/draco/) — see components/catalog/BodyModel.
    const gltf = useGLTF("/models/body/body.glb", "/draco/") as unknown as {
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
