"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useReducedMotion } from "framer-motion";
import { type Group } from "three";
import * as THREE from "three";
import type { AnchorWire } from "@/lib/catalog/types";
import type { DotsVariant } from "@/lib/catalog/lab-state";
import { orbitState } from "@/lib/catalog/orbit-state";

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
  // Cursor is driven off the single hovered anchor id (NOT per-dot pointerover/
  // pointerout mutations) so it can't get stuck as `pointer` when a hovered dot
  // rotates behind the body — its pointerout never fires, but the hover is
  // cleared in the dot's frame loop, which flows through here. Resets on unmount.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.cursor = hoveredId ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hoveredId]);

  // Resolve reduced-motion once and thread it down (vs. a subscription per dot).
  const reduced = useReducedMotion() ?? false;

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
          reduced={reduced}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
    </group>
  );
}

// Module-scoped scratch vectors reused across every dot's per-frame occlusion
// math — avoids allocating fresh Vector3s each frame (steady GC churn on mobile
// while the turntable keeps the demand loop rendering).
const tempVec = new THREE.Vector3();
const tempToCam = new THREE.Vector3();
const tempStart = new THREE.Vector3();

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
  reduced: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

function Dot({
  anchor,
  variant,
  selected,
  hovered,
  dimmed,
  reduced,
  onSelect,
  onHover,
}: DotProps) {
  const groupRef = useRef<Group | null>(null);
  const scaleRef = useRef(1);
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

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);

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
      const toCam = tempToCam.copy(camera.position).sub(worldPos);
      const dist = toCam.length();
      const dir = toCam.divideScalar(dist || 1); // normalized in place
      // Start a touch toward the camera so the dot's own surface patch doesn't
      // register as a blocker (the source of the flicker on the visible side).
      const start = tempStart
        .copy(worldPos)
        .addScaledVector(dir, OCCLUSION_START_OFFSET);
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
    // If this dot rotated behind the body while hovered, drop the hover so the
    // pointer cursor (driven off hoveredId) doesn't stick on a now-hidden dot.
    if (isOccludedRef.current && hovered) onHover(null);

    // Smooth hover scale (1 → 1.3), eased so the dot doesn't snap on hover. The
    // selected dot never scales — only its border turns accent.
    const targetScale =
      hovered && !isOccludedRef.current && !selected ? 1.3 : 1;
    if (reduced) {
      scaleRef.current = targetScale;
    } else {
      scaleRef.current = THREE.MathUtils.damp(
        scaleRef.current,
        targetScale,
        16,
        dt,
      );
      if (Math.abs(scaleRef.current - targetScale) > 0.001) invalidate();
    }
    g.scale.setScalar(scaleRef.current);
    if (hovered !== lastHoveredRef.current) {
      lastHoveredRef.current = hovered;
      invalidate();
    }
  });

  return (
    <group
      ref={groupRef}
      position={[anchor.position.x, anchor.position.y, anchor.position.z]}
      onPointerDown={(e) => {
        if (isOccludedRef.current) return; // hidden behind the body → not clickable
        e.stopPropagation();
        onSelect(anchor.id);
      }}
      onPointerOver={(e) => {
        // Skip hover while drag-orbiting (keeps the orbit smooth — no re-render
        // churn), for occluded dots behind the body, or for the already-selected
        // (active) dot — it shouldn't grow or show a pointer cursor.
        if (orbitState.dragging || isOccludedRef.current || selected) return;
        e.stopPropagation();
        onHover(anchor.id);
      }}
      onPointerOut={() => {
        onHover(null);
      }}
    >
      {/* Invisible-but-pickable hit target — large so the gap between core and
          outline is clickable. Opacity 0 (not visible:false, which three skips
          in raycasting). */}
      <mesh>
        <sphereGeometry args={[HIT_RADIUS, 10, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Core + border marker. When selected, the core fades out and the border
          turns accent (the equipped jewelry, if any, sits inside). The hit
          target above stays so the spot is always clickable. */}
      <Marker
        variant={variant}
        selected={selected}
        hovered={hovered}
        dimmed={dimmed}
        reduced={reduced}
      />
    </group>
  );
}

// Marker palette — module-scoped THREE.Color targets so the per-frame tween
// doesn't allocate. Core sits accent (white on hover); the border ring sits
// neutral grey, turning accent when the anchor is hovered or selected.
const _white = new THREE.Color("#ffffff");
const _accent = new THREE.Color(ACCENT);
const _grey = new THREE.Color("#9a9a9a");

/** Ease colour `c` toward `target` in place; returns true while still moving. */
function approachColor(c: THREE.Color, target: THREE.Color, a: number): boolean {
  if (
    Math.abs(c.r - target.r) < 0.004 &&
    Math.abs(c.g - target.g) < 0.004 &&
    Math.abs(c.b - target.b) < 0.004
  ) {
    c.copy(target);
    return false;
  }
  c.lerp(target, a);
  return true;
}

// The anchor-dot marker: a filled core inside a hairline border ring. Every state
// change (idle · hover · selected) cross-fades smoothly — colours AND opacity are
// eased per frame, never snapped. Selected = the core fades out and the border
// turns accent, leaving just an accent ring around the (possibly equipped) spot.
function Marker({
  variant,
  selected,
  hovered,
  dimmed,
  reduced,
}: {
  variant: DotsVariant;
  selected: boolean;
  hovered: boolean;
  dimmed: boolean;
  reduced: boolean;
}) {
  const coreMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const { invalidate } = useThree();

  const base = dimmed ? 0.4 : 1;
  const targetCoreColor = hovered ? _white : _accent;
  const targetCoreOpacity = selected ? 0 : base;
  const targetRingColor = selected || hovered ? _accent : _grey;
  const targetRingOpacity = selected || hovered ? base : base * 0.6;

  useFrame((_, delta) => {
    const core = coreMatRef.current;
    const ring = ringMatRef.current;
    if (!core || !ring) return;

    if (reduced) {
      core.color.copy(targetCoreColor);
      core.opacity = targetCoreOpacity;
      core.visible = targetCoreOpacity > 0.01;
      ring.color.copy(targetRingColor);
      ring.opacity = targetRingOpacity;
      return;
    }

    // Frame-rate-independent ease factor.
    const a = 1 - Math.exp(-14 * Math.min(delta, 0.05));
    let moving = false;

    if (approachColor(core.color, targetCoreColor, a)) moving = true;
    if (Math.abs(core.opacity - targetCoreOpacity) > 0.004) {
      core.opacity += (targetCoreOpacity - core.opacity) * a;
      moving = true;
    } else {
      core.opacity = targetCoreOpacity;
    }
    core.visible = core.opacity > 0.01;

    if (approachColor(ring.color, targetRingColor, a)) moving = true;
    if (Math.abs(ring.opacity - targetRingOpacity) > 0.004) {
      ring.opacity += (targetRingOpacity - ring.opacity) * a;
      moving = true;
    } else {
      ring.opacity = targetRingOpacity;
    }

    if (moving) invalidate();
  });

  if (variant !== "ring") return null;
  // Static initial props = the idle look. The useFrame above OWNS colour/opacity
  // after mount, so these must not be state-derived — r3f would otherwise
  // re-apply (snap) them on every re-render and fight the tween.
  return (
    <>
      <mesh renderOrder={1000}>
        <sphereGeometry args={[CORE, 14, 14]} />
        <meshBasicMaterial
          ref={coreMatRef}
          color={ACCENT}
          toneMapped={false}
          depthTest={false}
          transparent
          opacity={1}
        />
      </mesh>
      <mesh renderOrder={1000}>
        <ringGeometry args={[RING_INNER, RING_OUTER, 40]} />
        <meshBasicMaterial
          ref={ringMatRef}
          color="#9a9a9a"
          toneMapped={false}
          depthTest={false}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}
