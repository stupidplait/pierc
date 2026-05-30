"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { Euler, Group, Object3D, Quaternion, Vector3 } from "three";
import type {
  AnchorWire,
  EquippedMap,
  JewelryWire,
} from "@/lib/catalog/types";

interface EquippedPiecesProps {
  anchors: AnchorWire[];
  jewelry: JewelryWire[];
  equipped: EquippedMap;
}

// ─────────────────────────────────────────────────────────────────────────
// Group equipped (anchorId → jewelryId) entries by jewelryId so multi-anchor
// pieces render once, regardless of how many anchors they occupy.
// ─────────────────────────────────────────────────────────────────────────

interface EquippedPiece {
  jewelry: JewelryWire;
  /** Sorted by JewelryAnchorBinding.order (primary first). Length 1..N. */
  anchors: AnchorWire[];
}

function groupEquipped(
  equipped: EquippedMap,
  anchorsById: Map<string, AnchorWire>,
  jewelryById: Map<string, JewelryWire>,
): EquippedPiece[] {
  // Bucket anchorIds by jewelryId.
  const buckets = new Map<string, string[]>();
  for (const [anchorId, jewelryId] of Object.entries(equipped)) {
    if (!buckets.has(jewelryId)) buckets.set(jewelryId, []);
    buckets.get(jewelryId)!.push(anchorId);
  }

  const pieces: EquippedPiece[] = [];
  for (const [jewelryId, anchorIds] of buckets) {
    const j = jewelryById.get(jewelryId);
    if (!j) continue;

    // Resolve anchor records and sort by their JewelryAnchorBinding.order so
    // primary lands at attach:primary, secondary at attach:secondary, etc.
    // Bindings whose anchor isn't in this jewelry's binding list (shouldn't
    // happen, but be defensive) get pushed to the end.
    const orderByAnchor = new Map<string, number>();
    for (const b of j.anchorBindings) orderByAnchor.set(b.anchorId, b.order);

    const resolved = anchorIds
      .map((id) => anchorsById.get(id))
      .filter((a): a is AnchorWire => Boolean(a))
      .sort(
        (a, b) =>
          (orderByAnchor.get(a.id) ?? 99) - (orderByAnchor.get(b.id) ?? 99),
      );

    if (resolved.length === 0) continue;
    pieces.push({ jewelry: j, anchors: resolved });
  }
  return pieces;
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
      {pieces.map((p) => (
        <Suspense
          // Re-mount when the equipped anchor set changes so we don't end up
          // with stale transforms from the previous configuration.
          key={`${p.jewelry.id}:${p.anchors.map((a) => a.id).join(",")}`}
          fallback={<PlaceholderRing anchor={p.anchors[0]} />}
        >
          {p.jewelry.glbUrl ? (
            <JewelryGLB piece={p} />
          ) : (
            <PlaceholderRing anchor={p.anchors[0]} />
          )}
        </Suspense>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Placeholder: shown while the GLB loads OR when no GLB is on the jewelry.
// Always renders at the primary anchor — multi-anchor placeholder isn't
// worth the complexity since real pieces always have a GLB.
// ─────────────────────────────────────────────────────────────────────────

function PlaceholderRing({ anchor }: { anchor: AnchorWire }) {
  return (
    <group
      position={[anchor.position.x, anchor.position.y, anchor.position.z]}
      rotation={[anchor.rotation.x, anchor.rotation.y, anchor.rotation.z]}
    >
      <mesh>
        <torusGeometry args={[0.013, 0.0035, 12, 32]} />
        <meshStandardMaterial
          color="#fe017e"
          metalness={0.85}
          roughness={0.18}
          emissive="#fe017e"
          emissiveIntensity={0.15}
        />
      </mesh>
      <mesh position={[0, 0, 0.005]}>
        <sphereGeometry args={[0.005, 16, 16]} />
        <meshStandardMaterial color="#ffffff" metalness={0.2} roughness={0.4} />
      </mesh>
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
  const url = jewelry.glbUrl!;
  const gltf = useGLTF(url) as unknown as { scene: Group };

  // Per-instance clone so multiple equips on different anchors don't mutate
  // a shared scene reference.
  const cloned = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  // Read attach:* empties' local positions ONCE per cloned scene.
  const attachLocals = useMemo(
    () => readAttachLocals(cloned),
    [cloned],
  );

  const groupRef = useRef<Group | null>(null);

  // Compute and apply the placement transform whenever anchors / mesh change.
  // We mutate the group's transform directly (pattern matched in CameraRig);
  // React Compiler is not in play here because the assignment happens
  // inside an effect and references are not memoised props.
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    if (anchors.length === 1) {
      placeSingleAnchor(group, anchors[0], jewelry.glbScale, attachLocals[0]);
    } else {
      placeMultiAnchor(group, anchors, attachLocals);
    }
  }, [anchors, attachLocals, jewelry.glbScale]);

  return (
    <group ref={groupRef}>
      <primitive object={cloned} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// attach:* lookup
//
// The Blender export emits empties as scene-graph nodes named like
// `attach:primary`, `attach:secondary`, … Drei/three.js loads them as
// `Object3D` nodes with no geometry. We traverse, match the prefix, and
// store their LOCAL positions (relative to the GLB scene root). These
// positions are stable for the lifetime of the cloned scene.
// ─────────────────────────────────────────────────────────────────────────

const ATTACH_NAMES = [
  "primary",
  "secondary",
  "tertiary",
  "quaternary",
  "quinary",
  "senary",
  "septenary",
  "octonary",
] as const;

function readAttachLocals(scene: Object3D): Vector3[] {
  // Build a name→local-position map so we can index by order.
  const found = new Map<string, Vector3>();
  scene.traverse((obj) => {
    if (!obj.name.startsWith("attach:")) return;
    const slug = obj.name.slice("attach:".length);
    // Use world-relative-to-scene-root as "local" since attach empties live
    // directly under the GLB root in our parametric exports. If a complex
    // hierarchy is introduced later, swap to obj.matrixWorld decomposition.
    found.set(slug, obj.position.clone());
  });

  const out: Vector3[] = [];
  for (const slug of ATTACH_NAMES) {
    const p = found.get(slug);
    if (p) out.push(p);
    else break; // first missing name terminates — attach points are dense.
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// 1-anchor placement
// ─────────────────────────────────────────────────────────────────────────

function placeSingleAnchor(
  group: Group,
  anchor: AnchorWire,
  scale: number,
  attachLocal: Vector3 | undefined,
) {
  // Reset and apply anchor rotation + scale.
  group.scale.setScalar(scale);
  group.position.set(anchor.position.x, anchor.position.y, anchor.position.z);
  group.rotation.set(
    anchor.rotation.x,
    anchor.rotation.y,
    anchor.rotation.z,
    "XYZ",
  );

  if (!attachLocal) return; // legacy GLB without attach:primary — done.

  // Offset the mesh so attach:primary lands exactly on the anchor.
  // (group.position currently puts the GLB's local origin there; we want
  // the attach:primary point to be there instead.)
  const localOffset = attachLocal
    .clone()
    .applyEuler(group.rotation as Euler)
    .multiplyScalar(scale);
  group.position.sub(localOffset);
}

// ─────────────────────────────────────────────────────────────────────────
// Multi-anchor (2+) placement
//
// For 2 anchors, this resolves into a unique rigid transform (translation +
// rotation + uniform scale) up to one DOF — the rotation around the line
// connecting the two anchors. We don't constrain that DOF because the
// existing parametric pieces are rotationally symmetric around their bar
// axis; that's good enough for industrial / circular barbell / orbital.
//
// For N>2 we do the same 2-anchor math using the first two attach points;
// the rest are advisory and not enforced. CHAIN_LADDER would need a real
// per-segment chain placement — not in scope for Phase B.
// ─────────────────────────────────────────────────────────────────────────

function placeMultiAnchor(
  group: Group,
  anchors: AnchorWire[],
  attachLocals: Vector3[],
) {
  if (anchors.length < 2 || attachLocals.length < 2) {
    // Fall back to 1-anchor placement if the GLB is missing the required
    // attach points. This keeps multi-anchor jewelry visible (just not
    // perfectly placed) until the GLB is rebuilt with empties.
    placeSingleAnchor(group, anchors[0], 1.0, attachLocals[0]);
    return;
  }

  const meshA = attachLocals[0];
  const meshB = attachLocals[1];
  const worldA = new Vector3(
    anchors[0].position.x,
    anchors[0].position.y,
    anchors[0].position.z,
  );
  const worldB = new Vector3(
    anchors[1].position.x,
    anchors[1].position.y,
    anchors[1].position.z,
  );

  const meshDir = meshB.clone().sub(meshA);
  const worldDir = worldB.clone().sub(worldA);

  const meshLen = meshDir.length();
  const worldLen = worldDir.length();
  if (meshLen < 1e-6 || worldLen < 1e-6) {
    // Degenerate — fall back to single-anchor at the first anchor.
    placeSingleAnchor(group, anchors[0], 1.0, meshA);
    return;
  }

  const scale = worldLen / meshLen;

  const meshDirNorm = meshDir.clone().divideScalar(meshLen);
  const worldDirNorm = worldDir.clone().divideScalar(worldLen);

  const quat = new Quaternion().setFromUnitVectors(meshDirNorm, worldDirNorm);

  // Position so that meshA, after rotation+scale, lands at worldA.
  //   world = position + quat * (mesh * scale)
  //   worldA = position + quat * (meshA * scale)
  //   position = worldA - quat * (meshA * scale)
  const transformedA = meshA.clone().multiplyScalar(scale).applyQuaternion(quat);
  const position = worldA.clone().sub(transformedA);

  group.position.copy(position);
  group.quaternion.copy(quat);
  group.scale.setScalar(scale);
}
