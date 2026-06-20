"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Group, MathUtils } from "three";
import { useReducedMotion } from "framer-motion";
import { BodyModel } from "../BodyModel";
import { AnchorDots } from "../AnchorDots";
import { EquippedPieces } from "../EquippedPieces";
import { CameraRig } from "../CameraRig";
import { PostFx } from "./PostFx";
import { CatalogSceneLoader } from "./SceneLoader";
import { CharacterDais } from "./environments/CharacterDais";
import type { AnchorWire, EquippedMap, JewelryWire } from "@/lib/catalog/types";
import type {
  EnvVariant,
  HudVariant,
  BgVariant,
  DotsVariant,
  LoaderVariant,
} from "@/lib/catalog/lab-state";
import { catalogStrings } from "@/lib/i18n/ru";

interface ShowroomStageProps {
  anchors: AnchorWire[];
  jewelry: JewelryWire[];
  selectedId: string | null;
  equipped: EquippedMap;
  onSelectAnchor: (id: string) => void;
  env: EnvVariant;
  hud: HudVariant;
  bg: BgVariant;
  dots: DotsVariant;
  loader: LoaderVariant;
}

// Locked design: only the character-dais environment ships. (The holo/atelier/
// arena variants from the design lab were removed.) `env` stays in the prop
// surface so the lab-axis type still threads through the tree unchanged.
function SceneEnvironment({ bg }: { env: EnvVariant; bg: BgVariant }) {
  return <CharacterDais bg={bg} />;
}

/**
 * Turntable — slowly spins its children around Y for the character-select
 * idle pose. Wraps the body + dots + equipped pieces so jewelry rides along.
 * Spins only while `enabled`; otherwise eases rotation back to 0 so the
 * per-anchor camera presets (which assume a rest orientation) frame correctly.
 *
 * Drives the `frameloop="demand"` loop: each spinning frame calls invalidate()
 * to request the next, and an effect kicks the first frame. Goes fully idle
 * (no GPU) once settled at rest.
 */
function Turntable({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<Group | null>(null);
  const { invalidate } = useThree();

  useEffect(() => {
    if (enabled) invalidate();
  }, [enabled, invalidate]);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    if (enabled) {
      g.rotation.y += dt * 0.22; // ~13°/s — an unhurried full turn every ~28s
      invalidate();
    } else if (Math.abs(g.rotation.y % (Math.PI * 2)) > 0.001) {
      // Ease the residual angle back to a clean 0 so presets line up.
      const wrapped = g.rotation.y % (Math.PI * 2);
      g.rotation.y = MathUtils.damp(wrapped, 0, 6, dt);
      if (Math.abs(g.rotation.y) < 0.002) g.rotation.y = 0;
      else invalidate();
    }
  });

  return <group ref={ref}>{children}</group>;
}

/**
 * ShowroomStage — the single WebGL canvas for the showroom. The try-on core
 * (body, anchor dots, equipped GLBs, camera rig) is constant; only the
 * surrounding <SceneEnvironment> and <PostFx> swap with the env/hud axes.
 * Mounted exclusively via a `dynamic(ssr:false)` wrapper (see LazyStage).
 */
export function ShowroomStage({
  anchors,
  jewelry,
  selectedId,
  equipped,
  onSelectAnchor,
  env,
  hud,
  bg,
  dots,
  loader,
}: ShowroomStageProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const reduced = useReducedMotion() ?? false;
  const focusedAnchor = anchors.find((a) => a.id === selectedId) ?? null;

  // Mount-only initial camera: start already at the initially-focused anchor's
  // preset so the catalog lands framed (CameraRig snaps to it without a fly-in).
  const initialCamera = useMemo(() => {
    const p = focusedAnchor?.cameraPresets[0];
    return p
      ? ([p.position.x, p.position.y, p.position.z] as [number, number, number])
      : ([0, 1.25, 1.6] as [number, number, number]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- captured once at mount
  }, []);
  const initialFov = useMemo(
    () => focusedAnchor?.cameraPresets[0]?.fov ?? 35,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- captured once at mount
    [],
  );
  // The look-target that pairs with initialCamera — set in onCreated so the
  // camera is *oriented* (not just positioned) before the first paint. Without
  // this the camera renders one frame aimed at the world origin (straight down
  // from a close ear preset) before CameraRig's effect re-aims it → a flash.
  const initialTarget = useMemo(() => {
    const p = focusedAnchor?.cameraPresets[0];
    return p
      ? ([p.target.x, p.target.y, p.target.z] as [number, number, number])
      : ([0, 1.05, 0] as [number, number, number]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- captured once at mount
  }, []);

  // Stable key for the equipped map so the framing memos below don't churn.
  const equippedKey = useMemo(
    () =>
      Object.entries(equipped)
        .sort()
        .map(([k, v]) => `${k}:${v}`)
        .join(","),
    [equipped],
  );

  // Multi-anchor framing: if the selected anchor holds a multi-anchor piece,
  // collect every anchor that shares it so CameraRig can frame the full span.
  // (Ported verbatim from the previous ShowroomScene.)
  const equippedJewelryAtSelected = useMemo(() => {
    if (!selectedId) return null;
    const jewelryId = equipped[selectedId];
    if (!jewelryId) return null;
    return jewelry.find((j) => j.id === jewelryId) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- equippedKey stands in for `equipped`
  }, [selectedId, equippedKey, jewelry]);

  const multiAnchorFramingSet = useMemo(() => {
    if (!equippedJewelryAtSelected) return [];
    if (equippedJewelryAtSelected.piercingCount < 2) return [];
    const anchorsForThisJewelry = new Set<string>();
    for (const [anchorId, jewelryId] of Object.entries(equipped)) {
      if (jewelryId === equippedJewelryAtSelected.id) {
        anchorsForThisJewelry.add(anchorId);
      }
    }
    return anchors.filter((a) => anchorsForThisJewelry.has(a.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- equippedKey stands in for `equipped`
  }, [equippedJewelryAtSelected, equippedKey, anchors]);

  // Idle turntable only on the dais env, when nothing is selected (roster pose)
  // and the user hasn't asked for reduced motion.
  const turntableOn = env === "dais" && !reduced && selectedId === null;

  return (
    <div
      className="relative h-full w-full"
      role="region"
      aria-label={catalogStrings.showroom.stageLabel}
    >
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: initialCamera, fov: initialFov, near: 0.05, far: 50 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
        }}
        style={{ background: "transparent" }}
        frameloop="demand"
        onCreated={({ camera }) => {
          // Aim the camera at the framed target before the first render.
          camera.lookAt(initialTarget[0], initialTarget[1], initialTarget[2]);
        }}
      >
        <SceneEnvironment env={env} bg={bg} />

        <Turntable enabled={turntableOn}>
          <BodyModel />
          <AnchorDots
            anchors={anchors}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={onSelectAnchor}
            onHover={setHoveredId}
            variant={dots}
          />
          <EquippedPieces anchors={anchors} jewelry={jewelry} equipped={equipped} />
        </Turntable>

        <CameraRig
          anchor={focusedAnchor}
          equippedAnchorsForFraming={multiAnchorFramingSet}
          equippedJewelry={equippedJewelryAtSelected}
        />

        <PostFx hud={hud} />
      </Canvas>

      <CatalogSceneLoader variant={loader} />
    </div>
  );
}
