"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import {
  Euler,
  Group,
  type Material,
  MathUtils,
  type Mesh,
  Object3D,
  Quaternion,
  Vector3,
} from "three";
import type {
  AnchorWire,
  EquippedMap,
  JewelryWire,
} from "@/lib/catalog/types";
import { catalogGlbSrc } from "@/lib/jewelry/glb-proxy";

// ── Dither-dissolve reveal ────────────────────────────────────────────────
// Materialize newly-attached jewelry with a hashed screen-space dither (à la
// the landing's jewelry swaps) instead of a hard pop-in: a `uReveal` uniform
// ramps 0→1 and any fragment whose stable per-pixel hash exceeds it is
// discarded, so the piece stipples into existence. Works on any GLB material
// (discard needs no transparency/sort), patched per-instance via onBeforeCompile.
const REVEAL_TARGET = 1.12; // slightly >1 so no stray pixels stay discarded
const REVEAL_DAMP = 4.5; // ramp speed (≈0.6s)

const DITHER_GLSL = /* glsl */ `
uniform float uReveal;
float _revealHash(vec2 p){
  return fract(sin(dot(floor(p), vec2(12.9898, 78.233))) * 43758.5453);
}
`;

function patchDitherReveal(material: Material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uReveal = { value: 0 };
    // Stash the compiled shader so useFrame can drive uReveal without holding a
    // React value (avoids the lint against mutating refs/memos during render).
    material.userData.shader = shader;
    shader.fragmentShader =
      DITHER_GLSL +
      shader.fragmentShader.replace(
        "void main() {",
        "void main() {\n  if (uReveal < _revealHash(gl_FragCoord.xy)) discard;",
      );
  };
  material.needsUpdate = true;
}

/** Push the current reveal value into every patched material in `root`. */
function setRevealValue(root: Object3D, value: number) {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const shader = m?.userData?.shader as
        | { uniforms: { uReveal?: { value: number } } }
        | undefined;
      if (shader?.uniforms.uReveal) shader.uniforms.uReveal.value = value;
    }
  });
}

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
  // Create stable keys to avoid recalculating maps when array references change
  const anchorsKey = useMemo(() => anchors.map(a => a.id).join(','), [anchors]);
  const jewelryKey = useMemo(() => jewelry.map(j => j.id).join(','), [jewelry]);

  const anchorsById = useMemo(() => {
    const m = new Map<string, AnchorWire>();
    for (const a of anchors) m.set(a.id, a);
    return m;
  }, [anchors, anchorsKey]);

  const jewelryById = useMemo(() => {
    const m = new Map<string, JewelryWire>();
    for (const j of jewelry) m.set(j.id, j);
    return m;
  }, [jewelry, jewelryKey]);

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
  const cloned = useMemo(() => {
    const clone = new Group();
    gltf.scene.children.forEach((child) => {
      clone.add(child.clone());
    });
    clone.userData = { ...gltf.scene.userData };
    if (!reduced) {
      clone.traverse((o) => {
        const mesh = o as Mesh;
        if (!mesh.isMesh) return;
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => {
            const c = m.clone();
            patchDitherReveal(c);
            return c;
          });
        } else if (mesh.material) {
          const c = mesh.material.clone();
          patchDitherReveal(c);
          mesh.material = c;
        }
      });
    }
    return clone;
  }, [gltf.scene, reduced]);

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
      placeSingleAnchor(group, anchors[0], jewelry.glbScale, attachLocals[0]);
    } else {
      placeMultiAnchor(group, anchors, attachLocals);
    }
    invalidate(); // kick the demand loop so the reveal starts from this mount
  }, [anchors, attachLocals, jewelry.glbScale, invalidate]);

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

/** The attach slug ("primary"/"secondary"/…) of a node, or null if it isn't an
 *  attach empty. three's GLTFLoader runs every node name through
 *  `sanitizeNodeName`, which STRIPS reserved chars including ':' — so our
 *  `attach:primary` node is renamed to `attachprimary` at runtime. The ORIGINAL
 *  name survives in `userData.name`, so prefer that; fall back to the sanitized
 *  form ("attach" + slug, no colon) so the lookup is robust either way. */
function attachSlug(obj: Object3D): string | null {
  const raw = (obj.userData?.name as string | undefined) ?? obj.name;
  if (raw.startsWith("attach:")) return raw.slice("attach:".length); // "attach:primary"
  if (raw.startsWith("attach") && raw.length > "attach".length) {
    return raw.slice("attach".length); // sanitized "attachprimary" → "primary"
  }
  return null;
}

function readAttachLocals(scene: Object3D): Vector3[] {
  // Build a name→local-position map so we can index by order.
  const found = new Map<string, Vector3>();
  scene.traverse((obj) => {
    const slug = attachSlug(obj);
    if (!slug) return;
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
