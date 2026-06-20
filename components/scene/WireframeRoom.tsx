"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { EffectComposer } from "@react-three/postprocessing";
import FluidTrailEffect from "./FluidTrailEffect";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { DOLLY_OFFSET, FOV_START, EXHIBIT_Z, HERO_RING_Z } from "./wireframe-room/constants";
import { useReducedMotion } from "./wireframe-room/use-reduced-motion";
import { useThemeColors } from "./wireframe-room/colors";
import { ReadinessSignal } from "./wireframe-room/readiness";
import { CameraDolly, Ch2FloorVisibility, ChapterFade } from "./wireframe-room/camera";
import { ExhibitionLight, PinkRimLight, ProximityBloom, SceneBackgroundTransition } from "./wireframe-room/lighting";
import { ParallaxGroup, Podium } from "./wireframe-room/room";
import { FaceGrid } from "./wireframe-room/face-grid";
import { DustMotes, GlassPiece } from "./wireframe-room/jewelry";
import { Ch2BodyModel } from "./wireframe-room/ch2-body";
import { Ch2BackgroundGrid } from "./wireframe-room/ch2-grid";
import { AnimatedChooseText, AnimatedPrimerText, AnimatedReserveText, AnimatedWordmark } from "./wireframe-room/titles";

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

    // Pause the always-on render loop while the tab is hidden so the heavy
    // transmission + fluid passes don't keep the GPU busy in the background.
    // (Full frameloop="demand" conversion is intentionally deferred — this
    // scene drives a continuous scroll storyboard and needs visual QA first.)
    const [frameloop, setFrameloop] = useState<"always" | "never">("always");
    useEffect(() => {
        const onVisibility = () =>
            setFrameloop(document.hidden ? "never" : "always");
        document.addEventListener("visibilitychange", onVisibility);
        onVisibility();
        return () =>
            document.removeEventListener("visibilitychange", onVisibility);
    }, []);

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
            frameloop={frameloop}
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
                    Chapter 1. Placed at z=-14 — *behind* the ring's
                    exhibit position (z=-12) so the exhibit ring + podium
                    occlude it and it reads as a backdrop title the
                    foreground objects sit in front of (depthTest=true
                    on the text material handles the occlusion). */}
                    <AnimatedChooseText
                        z={-14}
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
                {/* NOT keyed on the theme: remounting <Environment> live re-bakes
                    the PMREM cubemap, which makes drei serialize the scene
                    (Texture.toJSON → circular-structure crash → WebGL context
                    loss) on a theme toggle. The reflection fallback is near-black
                    in both themes (dark #000 / studio #15131a), so the baked-once
                    env is visually identical either way — no remount needed. The
                    enclosing sphere's `color` prop still updates in place. */}
                <Environment resolution={256}>
                    {/* Fully enclosing reflection sphere \u2014 any reflection ray
                    that misses a lightformer hits this. Themed via
                    --scene-reflect: a black void on the dark room (dramatic,
                    high-contrast glass) \u2192 a light wash on the paper/studio hero
                    so the glass ring reads as clean chrome instead of picking
                    up dark smudges against the bright surface. */}
                    <mesh scale={100}>
                        <sphereGeometry args={[1, 32, 32]} />
                        <meshBasicMaterial color={colors.reflect} side={THREE.BackSide} />
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
                    isLight={colors.bg.r > 0.5}
                />
            </EffectComposer>
        </Canvas>
    );
}
