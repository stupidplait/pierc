"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import { Group, type Material, MathUtils, type Mesh } from "three";
import type {
  AnchorWire,
  EquippedMap,
  JewelryWire,
} from "@/lib/catalog/types";
import { catalogGlbSrc } from "@/lib/jewelry/glb-proxy";
import { GlbPreviewBoundary } from "@/components/admin/GlbPreviewBoundary";
import {
  REVEAL_DAMP,
  REVEAL_TARGET,
  patchDitherReveal,
  setRevealValue,
} from "@/lib/catalog/dither-reveal";
import {
  groupEquipped,
  placeMultiAnchor,
  placeSingleAnchor,
  readAttachLocals,
  type EquippedPiece,
} from "@/lib/catalog/place-jewelry";

interface EquippedPiecesProps {
  anchors: AnchorWire[];
  jewelry: JewelryWire[];
  equipped: EquippedMap;
}

export function EquippedPieces({
  anchors,
  jewelry,
  equipped,
}: EquippedPiecesProps) {
  const anchorsById = useMemo(() => {
    const m = new Map<string, AnchorWire>();
    for (const a of anchors) m.set(a.id, a);
    return m;
  }, [anchors]);

  const jewelryById = useMemo(() => {
    const m = new Map<string, JewelryWire>();
    for (const j of jewelry) m.set(j.id, j);
    return m;
  }, [jewelry]);

  const pieces = useMemo(
    () => groupEquipped(equipped, anchorsById, jewelryById),
    [equipped, anchorsById, jewelryById],
  );

  return (
    <group>
      {pieces.map((p) => {
        // Re-mount when the equipped anchor set changes so we don't carry stale
        // transforms from the previous configuration. Keying the BOUNDARY (the
        // outer node) also resets it on re-equip, giving a previously-failed GLB
        // a fresh load attempt.
        const key = `${p.jewelry.id}:${p.anchors.map((a) => a.id).join(",")}`;
        return (
          <GlbPreviewBoundary
            key={key}
            fallback={<LoadFailedMarker anchor={p.anchors[0]} />}
          >
            <Suspense fallback={<PlaceholderRing anchor={p.anchors[0]} />}>
              {p.jewelry.glbUrl ? (
                <JewelryGLB piece={p} />
              ) : (
                <PlaceholderRing anchor={p.anchors[0]} />
              )}
            </Suspense>
          </GlbPreviewBoundary>
        );
      })}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Placeholder: shown while the GLB loads OR when no GLB is on the jewelry.
// Always renders at the primary anchor — multi-anchor placeholder isn't
// worth the complexity since real pieces always have a GLB.
// ─────────────────────────────────────────────────────────────────────────

const PLACEHOLDER_ACCENT = "#fe017e";

function PlaceholderRing({ anchor }: { anchor: AnchorWire }) {
  const billboardRef = useRef<Group | null>(null);
  const spinRef = useRef<Group | null>(null);
  const { invalidate } = useThree();
  const reduced = useReducedMotion() ?? false;

  // A localized "materializing" spinner pinned at the anchor: a faint accent
  // track with two arcs sweeping around the view axis + a soft glowing core, so
  // a piece that's still loading reads as actively assembling rather than a
  // stray ring. Billboards to the camera; idles flat for reduced motion.
  useFrame(({ camera, clock }) => {
    const bb = billboardRef.current;
    if (!bb) return;
    bb.quaternion.copy(camera.quaternion);
    if (reduced) return;
    const spin = spinRef.current;
    if (spin) spin.rotation.z = -clock.elapsedTime * 2.6;
    const pulse = 0.92 + Math.sin(clock.elapsedTime * 4) * 0.08;
    bb.scale.setScalar(pulse);
    invalidate();
  });

  return (
    <group position={[anchor.position.x, anchor.position.y, anchor.position.z]}>
      <group ref={billboardRef}>
        {/* faint full track */}
        <mesh renderOrder={1000}>
          <ringGeometry args={[0.0046, 0.0054, 48]} />
          <meshBasicMaterial
            color={PLACEHOLDER_ACCENT}
            transparent
            opacity={0.18}
            depthTest={false}
            toneMapped={false}
          />
        </mesh>

        {/* two bright arcs sweeping around the track */}
        <group ref={spinRef}>
          <mesh renderOrder={1001}>
            <ringGeometry args={[0.0043, 0.0057, 32, 1, 0, Math.PI * 0.42]} />
            <meshBasicMaterial
              color={PLACEHOLDER_ACCENT}
              transparent
              opacity={0.95}
              depthTest={false}
              toneMapped={false}
            />
          </mesh>
          <mesh renderOrder={1001}>
            <ringGeometry
              args={[0.0043, 0.0057, 32, 1, Math.PI, Math.PI * 0.42]}
            />
            <meshBasicMaterial
              color={PLACEHOLDER_ACCENT}
              transparent
              opacity={0.95}
              depthTest={false}
              toneMapped={false}
            />
          </mesh>
        </group>

        {/* soft glowing core */}
        <mesh renderOrder={1002}>
          <circleGeometry args={[0.0016, 24]} />
          <meshBasicMaterial
            color="#ffe6f2"
            transparent
            opacity={0.9}
            depthTest={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Load-failed marker — rendered by the error boundary when a piece's GLB throws
// during load (404 / expired CDN link / malformed file). A static, muted ring,
// deliberately NOT the magenta animated spinner, so a permanent failure never
// masquerades as "still loading". Billboards to the camera so it stays visible.
// ─────────────────────────────────────────────────────────────────────────

function LoadFailedMarker({ anchor }: { anchor: AnchorWire }) {
  const billboardRef = useRef<Group | null>(null);
  // Passive billboard — no invalidate(); it re-orients on the next frame the
  // scene renders for another reason (orbit / equip), which is enough.
  useFrame(({ camera }) => {
    const bb = billboardRef.current;
    if (bb) bb.quaternion.copy(camera.quaternion);
  });

  return (
    <group position={[anchor.position.x, anchor.position.y, anchor.position.z]}>
      <group ref={billboardRef}>
        <mesh renderOrder={1000}>
          <ringGeometry args={[0.0044, 0.0056, 32]} />
          <meshBasicMaterial
            color="#9aa0a6"
            transparent
            opacity={0.5}
            depthTest={false}
            toneMapped={false}
          />
        </mesh>
        <mesh renderOrder={1001}>
          <circleGeometry args={[0.0012, 16]} />
          <meshBasicMaterial
            color="#9aa0a6"
            transparent
            opacity={0.6}
            depthTest={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Jewelry GLB renderer.
//
// Per-instance clones the cached scene so multiple equips on different
// anchors don't share a single mesh reference.
//
// Placement strategy (see docs/20-multi-anchor-jewelry.md):
//
//   1 anchor equipped (STUD / RING / multi-anchor in 1-anchor fallback):
//     - Place mesh at anchor.position with rotation = anchor.rotation
//       (legacy behaviour; works for the existing 22 parametric pieces).
//     - If `attach:primary` empty exists, OFFSET the mesh by -attachLocal
//       so the empty lands EXACTLY on the anchor — accounts for cases
//       where the mesh's origin isn't at the post tip (e.g. an AI-
//       generated stud whose origin is at the centre of mass).
//
//   2+ anchors equipped (BARBELL / CIRCULAR_BARBELL / ORBITAL / CHAIN_LADDER):
//     - Read attach:primary, attach:secondary, … from the GLB.
//     - Compute rigid transform that maps each `attach[i]` onto its
//       corresponding `anchor[i].position`.
//     - For 2 anchors: scale = |worldB-worldA| / |attachB-attachA|;
//       rotation aligns attach-direction onto world-direction; position
//       is derived so attach:primary lands at anchor[0].position.
// ─────────────────────────────────────────────────────────────────────────

interface JewelryGLBProps {
  piece: EquippedPiece;
}

function JewelryGLB({ piece }: JewelryGLBProps) {
  const { jewelry, anchors } = piece;
  // Load via the same-origin proxy — the raw blob URL is blocked cross-origin.
  const url = catalogGlbSrc(jewelry.id, jewelry.glbUrl);
  const gltf = useGLTF(url) as unknown as { scene: Group };
  const { invalidate } = useThree();
  const reduced = useReducedMotion() ?? false;

  // Current reveal progress (0→REVEAL_TARGET). Only touched in useFrame/effects,
  // never during render, so it stays lint-clean.
  const revealRef = useRef(0);

  // Per-instance clone: clone direct children (meshes) AND their materials so
  // the per-instance dither patch never mutates drei's shared cached material.
  // Reduced motion → skip the patch entirely (materials stay shared, instant).
  //
  // `disposables` collects ONLY the materials we cloned here, so the unmount
  // cleanup can free them without ever touching the shared geometry or drei's
  // cached materials. NOTE: child.clone() shares geometry with the cache, so we
  // must never dispose geometry; and the reduced path leaves `disposables`
  // empty because it reuses the cached materials directly.
  const { cloned, disposables } = useMemo(() => {
    const clone = new Group();
    gltf.scene.children.forEach((child) => {
      clone.add(child.clone());
    });
    clone.userData = { ...gltf.scene.userData };
    const disposables: Material[] = [];
    if (!reduced) {
      clone.traverse((o) => {
        const mesh = o as Mesh;
        if (!mesh.isMesh) return;
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => {
            const c = m.clone();
            patchDitherReveal(c);
            disposables.push(c);
            return c;
          });
        } else if (mesh.material) {
          const c = mesh.material.clone();
          patchDitherReveal(c);
          disposables.push(c);
          mesh.material = c;
        }
      });
    }
    return { cloned: clone, disposables };
  }, [gltf.scene, reduced]);

  // Free the per-instance cloned materials (and their compiled GPU programs)
  // when this piece unmounts or the anchor-set Suspense key churns — otherwise
  // every equip/re-equip leaks a material + shader. Shared geometry and drei's
  // cached materials are intentionally left untouched.
  useEffect(() => {
    return () => {
      for (const m of disposables) m.dispose();
    };
  }, [disposables]);

  // Read attach:* empties' local positions ONCE per cloned scene.
  const attachLocals = useMemo(
    () => readAttachLocals(cloned),
    [cloned],
  );

  const groupRef = useRef<Group | null>(null);

  // Compute and apply the placement transform whenever anchors / mesh change.
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    if (anchors.length === 1) {
      // Per-binding orientation nudge (Layer 3): the admin's escape hatch for a
      // specific piece on a specific anchor. Null for the common case.
      const offset =
        jewelry.anchorBindings.find((b) => b.anchorId === anchors[0].id)
          ?.rotationOffset ?? null;
      placeSingleAnchor(
        group,
        anchors[0],
        jewelry.glbScale,
        attachLocals[0],
        jewelry.type,
        offset,
      );
    } else {
      placeMultiAnchor(group, anchors, attachLocals);
    }
    invalidate(); // kick the demand loop so the reveal starts from this mount
  }, [
    anchors,
    attachLocals,
    jewelry.glbScale,
    jewelry.type,
    jewelry.anchorBindings,
    invalidate,
  ]);

  // Drive the dither dissolve until fully revealed, then idle.
  useFrame((_, delta) => {
    if (reduced || revealRef.current >= REVEAL_TARGET - 0.01) return;
    revealRef.current = MathUtils.damp(
      revealRef.current,
      REVEAL_TARGET,
      REVEAL_DAMP,
      Math.min(delta, 0.05),
    );
    setRevealValue(cloned, revealRef.current);
    invalidate();
  });

  return (
    <group ref={groupRef}>
      <primitive object={cloned} />
    </group>
  );
}
