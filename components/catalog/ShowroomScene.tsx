"use client";

import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { BodyModel } from "./BodyModel";
import { AnchorDots } from "./AnchorDots";
import { EquippedPieces } from "./EquippedPieces";
import { CameraRig } from "./CameraRig";
import type {
  AnchorWire,
  EquippedMap,
  JewelryWire,
} from "@/lib/catalog/types";
import { catalogStrings } from "@/lib/i18n/ru";

interface ShowroomSceneProps {
  anchors: AnchorWire[];
  jewelry: JewelryWire[];
  selectedId: string | null;
  equipped: EquippedMap;
  onSelectAnchor: (id: string) => void;
}

export function ShowroomScene({
  anchors,
  jewelry,
  selectedId,
  equipped,
  onSelectAnchor,
}: ShowroomSceneProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const focusedAnchor = anchors.find((a) => a.id === selectedId) ?? null;

  return (
    <div className="relative h-full w-full">
      <Canvas
        // dpr capped to keep mobile GPUs happy
        dpr={[1, 1.75]}
        // Initial camera; CameraRig animates from here.
        camera={{ position: [0, 1.25, 1.6], fov: 35, near: 0.05, far: 50 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        // Default-clear so the scene reveals the page background.
        style={{ background: "transparent" }}
        // Render only when something invalidates the loop. CameraRig +
        // selected AnchorDot self-invalidate while moving / pulsing; the
        // scene goes idle (~0% GPU) when nothing's animating.
        frameloop="demand"
      >
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[3, 6, 4]}
          intensity={1.2}
          color="#fff7ec"
        />
        <directionalLight
          position={[-3, 2, 2]}
          intensity={0.45}
          color="#cfe1ff"
        />
        {/* Subtle warm rim from behind for silhouette */}
        <directionalLight
          position={[0, 2, -3]}
          intensity={0.3}
          color="#fe017e"
        />

        <BodyModel />
        <AnchorDots
          anchors={anchors}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={onSelectAnchor}
          onHover={setHoveredId}
        />
        <EquippedPieces
          anchors={anchors}
          jewelry={jewelry}
          equipped={equipped}
        />

        <CameraRig anchor={focusedAnchor} />
      </Canvas>

      {/* Hint badge */}
      <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-page/80 px-3 py-1 text-xs text-mute backdrop-blur">
        {selectedId
          ? anchors.find((a) => a.id === selectedId)?.name
          : catalogStrings.showroom.listAnchorPrompt}
      </p>
    </div>
  );
}
