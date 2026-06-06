"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { type Group, type Mesh } from "three";
import * as THREE from "three";
import type { AnchorWire } from "@/lib/catalog/types";
import type { DotsVariant } from "@/lib/catalog/lab-state";

interface AnchorDotsProps {
  anchors: AnchorWire[];
  selectedId: string | null;
  hoveredId: string | null;
  /** Dim or hide unrelated anchors when one is focused. */
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  /** Marker style (?dots=). */
  variant?: DotsVariant;
}

export function AnchorDots({
  anchors,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  variant = "ring",
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
          variant={variant}
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

// Temp vector for world position calculations
const tempVec = new THREE.Vector3();

const ACCENT = "#fe017e";
// Marker sizes in body-local metres (the body renders at real ~1.7 m scale).
const CORE = 0.001;
const RING_INNER = 0.0024;
const RING_OUTER = 0.0028;
// Invisible pick target ≈ the visible marker so the whole dot is clickable but
// it doesn't bleed into neighbours (ear anchors sit only ~5 mm apart).
const HIT_RADIUS = 0.003;
// Push the occlusion ray off the skin so a dot isn't self-occluded by the local
// surface it sits on, and only count a blocker that's clearly in front — so the
// near side's dots all stay visible while the far side (behind the head) hides.
const OCCLUSION_START_OFFSET = 0.015;
const OCCLUSION_MARGIN = 0.03;

interface DotProps {
  anchor: AnchorWire;
  variant: DotsVariant;
  selected: boolean;
  hovered: boolean;
  dimmed: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

function Dot({
  anchor,
  variant,
  selected,
  hovered,
  dimmed,
  onSelect,
  onHover,
}: DotProps) {
  const groupRef = useRef<Group | null>(null);
  const pulseRef = useRef<Mesh | null>(null);
  const { camera, scene, invalidate } = useThree();

  // Per-dot raycaster (BVH-accelerated) for occlusion against the body only.
  const raycasterRef = useRef(new THREE.Raycaster());
  const bodyMeshesRef = useRef<THREE.Object3D[] | null>(null);
  const isOccludedRef = useRef(false);
  const lastHoveredRef = useRef(hovered);

  useEffect(() => {
    raycasterRef.current.firstHitOnly = true;
  }, []);

  // Find the body meshes once; kick a frame so the first occlusion pass runs.
  useEffect(() => {
    const bodyMeshes: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if (obj.type === "Mesh" || obj.type === "SkinnedMesh") {
        let parent = obj.parent;
        let isBodyMesh = false;
        while (parent) {
          if (parent.userData?.isBodyModel || parent.name.includes("body")) {
            isBodyMesh = true;
            break;
          }
          parent = parent.parent;
        }
        if (isBodyMesh) bodyMeshes.push(obj);
      }
    });
    bodyMeshesRef.current = bodyMeshes.length > 0 ? bodyMeshes : null;
    invalidate();
  }, [scene, invalidate]);

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;

    // Billboard — always face the camera.
    g.quaternion.copy(camera.quaternion);

    // Occlusion every rendered frame. The demand loop only renders while
    // something animates (camera tween/orbit, dais turntable), so this stays
    // cheap when idle — but updates in lock-step with a spinning figure, which
    // the old every-30-frames throttle could not (the camera doesn't move
    // during a turntable, so dots used to flicker through the head).
    const worldPos = tempVec.setFromMatrixPosition(g.matrixWorld);
    const body = bodyMeshesRef.current;
    if (body && body.length > 0) {
      const toCam = camera.position.clone().sub(worldPos);
      const dist = toCam.length();
      const dir = toCam.divideScalar(dist || 1);
      // Start a touch toward the camera so the dot's own surface patch doesn't
      // register as a blocker (the source of the flicker on the visible side).
      const start = worldPos.clone().addScaledVector(dir, OCCLUSION_START_OFFSET);
      const raycaster = raycasterRef.current;
      raycaster.set(start, dir);
      raycaster.far = dist - OCCLUSION_START_OFFSET;
      const intersects = raycaster.intersectObjects(body, false);
      isOccludedRef.current = intersects.some(
        (hit) => hit.distance < raycaster.far - OCCLUSION_MARGIN,
      );
    } else {
      isOccludedRef.current = false;
    }
    g.visible = !isOccludedRef.current;

    // Hover scale — invalidate on transitions so the demand loop catches it.
    g.scale.setScalar(hovered && !isOccludedRef.current ? 1.35 : 1);
    if (hovered !== lastHoveredRef.current) {
      lastHoveredRef.current = hovered;
      invalidate();
    }

    // Pulse marker — expanding ring; keep the loop alive while it animates.
    if (variant === "pulse" && pulseRef.current && !selected) {
      const t = (clock.elapsedTime % 1.6) / 1.6;
      const s = 1 + t * 1.8;
      pulseRef.current.scale.setScalar(s);
      const mat = pulseRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - t) * 0.55 * (dimmed ? 0.4 : 1);
      invalidate();
    }
  });

  const opacity = dimmed ? 0.4 : 1;
  const coreColor = hovered ? "#ffffff" : ACCENT;

  return (
    <group
      ref={groupRef}
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
      {/* Invisible-but-pickable hit target — large so the gap between core and
          outline is clickable. Opacity 0 (not visible:false, which three skips
          in raycasting). */}
      <mesh>
        <sphereGeometry args={[HIT_RADIUS, 10, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Marker hidden when this anchor is selected — the equipped jewelry is
          the indicator. The hit target above stays so it's still clickable. */}
      {!selected ? (
        <Marker
          variant={variant}
          opacity={opacity}
          coreColor={coreColor}
          hovered={hovered}
          pulseRef={pulseRef}
        />
      ) : null}
    </group>
  );
}

function Marker({
  variant,
  opacity,
  coreColor,
  hovered,
  pulseRef,
}: {
  variant: DotsVariant;
  opacity: number;
  coreColor: string;
  hovered: boolean;
  pulseRef: React.RefObject<Mesh | null>;
}) {
  const ringColor = hovered ? ACCENT : "#9a9a9a";

  if (variant === "solid") {
    // A clean filled disc with a hairline dark rim for contrast on light skin.
    return (
      <>
        <mesh renderOrder={1000}>
          <circleGeometry args={[RING_INNER, 32]} />
          <meshBasicMaterial
            color={coreColor}
            toneMapped={false}
            depthTest={false}
            transparent
            opacity={opacity}
          />
        </mesh>
        <mesh renderOrder={999}>
          <ringGeometry args={[RING_INNER, RING_INNER * 1.18, 32]} />
          <meshBasicMaterial
            color="#0a0a0a"
            toneMapped={false}
            depthTest={false}
            transparent
            opacity={opacity * 0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      </>
    );
  }

  if (variant === "reticle") {
    // Four ticks around a centre gap — a targeting reticle.
    const tickLen = RING_OUTER * 1.4;
    const tickW = RING_OUTER * 0.28;
    const gap = RING_INNER * 1.2;
    const ticks: Array<[number, number, number]> = [
      [0, gap + tickLen / 2, 0],
      [0, -(gap + tickLen / 2), 0],
      [gap + tickLen / 2, 0, Math.PI / 2],
      [-(gap + tickLen / 2), 0, Math.PI / 2],
    ];
    return (
      <>
        <mesh renderOrder={1000}>
          <circleGeometry args={[CORE * 0.9, 16]} />
          <meshBasicMaterial
            color={coreColor}
            toneMapped={false}
            depthTest={false}
            transparent
            opacity={opacity}
          />
        </mesh>
        {ticks.map((t, i) => (
          <mesh key={i} position={[t[0], t[1], 0]} rotation={[0, 0, t[2]]} renderOrder={1000}>
            <planeGeometry args={[tickW, tickLen]} />
            <meshBasicMaterial
              color={hovered ? ACCENT : "#c8c8c8"}
              toneMapped={false}
              depthTest={false}
              transparent
              opacity={opacity}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </>
    );
  }

  if (variant === "pulse") {
    // Core dot + an expanding ring animated in Dot's useFrame via pulseRef.
    return (
      <>
        <mesh renderOrder={1001}>
          <circleGeometry args={[CORE * 1.2, 20]} />
          <meshBasicMaterial
            color={coreColor}
            toneMapped={false}
            depthTest={false}
            transparent
            opacity={opacity}
          />
        </mesh>
        <mesh ref={pulseRef} renderOrder={1000}>
          <ringGeometry args={[RING_INNER, RING_OUTER, 36]} />
          <meshBasicMaterial
            color={ACCENT}
            toneMapped={false}
            depthTest={false}
            transparent
            opacity={0}
            side={THREE.DoubleSide}
          />
        </mesh>
      </>
    );
  }

  // Default — "ring": filled core + hairline outline ring.
  return (
    <>
      <mesh renderOrder={1000}>
        <sphereGeometry args={[CORE, 14, 14]} />
        <meshBasicMaterial
          color={coreColor}
          toneMapped={false}
          depthTest={false}
          transparent
          opacity={opacity}
        />
      </mesh>
      <mesh renderOrder={1000}>
        <ringGeometry args={[RING_INNER, RING_OUTER, 40]} />
        <meshBasicMaterial
          color={ringColor}
          toneMapped={false}
          depthTest={false}
          transparent
          opacity={hovered ? opacity : opacity * 0.6}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}
