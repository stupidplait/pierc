"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { type Mesh } from "three";
import type { AnchorWire } from "@/lib/catalog/types";

interface AnchorDotsProps {
  anchors: AnchorWire[];
  selectedId: string | null;
  hoveredId: string | null;
  /** Dim or hide unrelated anchors when one is focused. */
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

export function AnchorDots({
  anchors,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}: AnchorDotsProps) {
  // Belt-and-suspenders: if the canvas unmounts while a dot is hovered
  // (e.g. route change), reset the global cursor that pointerOver sets.
  useEffect(() => {
    return () => {
      if (typeof document !== "undefined") {
        document.body.style.cursor = "";
      }
    };
  }, []);

  return (
    <group>
      {anchors.map((a) => (
        <Dot
          key={a.id}
          anchor={a}
          selected={selectedId === a.id}
          hovered={hoveredId === a.id}
          dimmed={selectedId !== null && selectedId !== a.id}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
    </group>
  );
}

interface DotProps {
  anchor: AnchorWire;
  selected: boolean;
  hovered: boolean;
  dimmed: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

function Dot({ anchor, selected, hovered, dimmed, onSelect, onHover }: DotProps) {
  const meshRef = useRef<Mesh | null>(null);
  const { invalidate } = useThree();

  // Frame loop participation:
  // - Selected dot: drive the pulse + invalidate every frame to keep the
  //   on-demand loop running.
  // - Hovered dot: settle to scale 1.3 in a single frame, no invalidate.
  // - Idle: settle to scale 1, no invalidate.
  // Non-selected dots early-return to skip per-frame Math.sin work.
  useFrame(({ clock }) => {
    const m = meshRef.current;
    if (!m) return;

    if (selected) {
      const s = 1 + Math.sin(clock.elapsedTime * 4) * 0.15;
      m.scale.setScalar(s);
      invalidate();
      return;
    }

    if (hovered) {
      m.scale.setScalar(1.3);
      return;
    }

    m.scale.setScalar(1);
  });

  const radius = 0.012;
  const color = selected ? "#fe017e" : hovered ? "#fe017e" : "#ffffff";
  const opacity = dimmed ? 0.35 : 1;

  return (
    <mesh
      ref={meshRef}
      position={[anchor.position.x, anchor.position.y, anchor.position.z]}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(anchor.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(anchor.id);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = "";
      }}
    >
      <sphereGeometry args={[radius, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={selected ? 0.9 : hovered ? 0.6 : 0.3}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}
