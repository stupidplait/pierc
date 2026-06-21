import {
  Euler,
  type Group,
  Matrix4,
  type Object3D,
  Quaternion,
  Vector3,
} from "three";
import {
  isSingleAnchorType,
  type AnchorWire,
  type EquippedMap,
  type JewelryType,
  type JewelryWire,
  type Vec3,
} from "@/lib/catalog/types";

// ─────────────────────────────────────────────────────────────────────────
// Group equipped (anchorId → jewelryId) entries by jewelryId so multi-anchor
// pieces render once, regardless of how many anchors they occupy.
// ─────────────────────────────────────────────────────────────────────────

export interface EquippedPiece {
  jewelry: JewelryWire;
  /** Sorted by JewelryAnchorBinding.order (primary first). Length 1..N. */
  anchors: AnchorWire[];
}

export function groupEquipped(
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

    const resolved = anchorIds
      .map((id) => anchorsById.get(id))
      .filter((a): a is AnchorWire => Boolean(a));
    if (resolved.length === 0) continue;

    // Compat-list types (STUD/RING): each anchor the piece is worn on is an
    // INDEPENDENT instance — emit one single-anchor piece per anchor. Bucketing
    // them into a single multi-anchor piece (the bug) routed a stud worn on two
    // holes through placeMultiAnchor → its <2-attach-point fallback rendered it
    // ONCE at the primary anchor with a hardcoded scale 1.0 (ignoring glbScale
    // and the per-binding nudge), so it vanished from the other anchor and lost
    // its scale/orientation. Each instance now places via placeSingleAnchor with
    // the piece's glbScale + that binding's rotationOffset.
    if (isSingleAnchorType(j.type)) {
      for (const a of resolved) pieces.push({ jewelry: j, anchors: [a] });
      continue;
    }

    // Fixed multi-anchor types (BARBELL/CIRCULAR_BARBELL/ORBITAL/CHAIN_LADDER):
    // one mesh spans all bound anchors. Sort by JewelryAnchorBinding.order so
    // primary lands at attach:primary, secondary at attach:secondary, etc.
    // Anchors not in this jewelry's binding list (shouldn't happen, but be
    // defensive) get pushed to the end.
    const orderByAnchor = new Map<string, number>();
    for (const b of j.anchorBindings) orderByAnchor.set(b.anchorId, b.order);
    resolved.sort(
      (a, b) =>
        (orderByAnchor.get(a.id) ?? 99) - (orderByAnchor.get(b.id) ?? 99),
    );
    pieces.push({ jewelry: j, anchors: resolved });
  }
  return pieces;
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

export function readAttachLocals(scene: Object3D): Vector3[] {
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

/** The `attach:up` reference point, or null. It's NOT an ordered endpoint (so it's
 *  excluded from ATTACH_NAMES / readAttachLocals); it's a roll constraint for
 *  asymmetric multi-anchor pieces — see placeMultiAnchor. */
export function readAttachUp(scene: Object3D): Vector3 | null {
  let up: Vector3 | null = null;
  scene.traverse((obj) => {
    if (attachSlug(obj) === "up") up = obj.position.clone();
  });
  return up;
}

// ─────────────────────────────────────────────────────────────────────────
// 1-anchor placement
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// Orientation
//
// A piece's canonical GLB frame (see lib/admin/glb-normalize.ts):
//   • STUD : +Z = post→head axis (decorative head out), attach at the neck.
//   • RING : +Z = hole axis, +Y = band top, attach on the band at +Y.
//
// The anchor's `rotation` Euler aims canonical +Z at the skin's OUTWARD NORMAL.
// That's right for a post (it sinks into the skin along the normal). For a hoop
// it's wrong on laterally-facing anchors (the EAR family, hips, ankles): the
// hole-axis ends up lateral, so the ring lies in the sagittal plane and reads
// edge-on from the front ("along the ear"). A hoop should hang (band-top up) and
// FACE the viewer instead. deriveRingRotation() builds that frame; an explicit
// AnchorWire.ringRotation overrides it. Posts always use `rotation`.
// ─────────────────────────────────────────────────────────────────────────

// How far a hoop turns toward the surface's lateral normal. 0 = always dead
// front; 1 = follow the normal fully (re-introduces the edge-on bug on ears).
// ~0.45 reads as a natural 3/4 on ears while staying ≈front on the navel/septum
// (whose normal is already forward, so there's nothing lateral to turn toward).
const RING_OUTWARD_BLEND = 0.45;

const WORLD_UP = new Vector3(0, 1, 0);
const WORLD_FORWARD = new Vector3(0, 0, 1);

// Outward tilt of a captive cartilage ring about its piercing, so it swings OUT
// over the rim edge instead of hanging straight down into the concave skin beside
// it. Radians; tuned against the reference photo.
const CARTILAGE_LEAN = 0.28;

function eulerToQuat(r: Vec3): Quaternion {
  return new Quaternion().setFromEuler(new Euler(r.x, r.y, r.z, "XYZ"));
}

/**
 * Build a hoop orientation from an anchor's post `rotation`: band-top → world
 * up (hangs straight down), hole-axis → a forward-facing horizontal direction
 * blended slightly toward the surface's lateral normal for a natural 3/4. For a
 * front-facing anchor the normal is already forward, so this collapses to "face
 * front" with no turn — i.e. no regression where the post rule already worked.
 */
export function deriveRingRotation(anchorRotation: Vec3): Quaternion {
  const R = new Matrix4().makeRotationFromEuler(
    new Euler(anchorRotation.x, anchorRotation.y, anchorRotation.z, "XYZ"),
  );
  const normal = new Vector3(0, 0, 1).applyMatrix4(R).normalize();
  // Horizontal component of the outward normal (drop the vertical part).
  const horiz = normal.clone().addScaledVector(WORLD_UP, -normal.dot(WORLD_UP));
  let facing: Vector3;
  if (horiz.lengthSq() < 1e-6) {
    // Normal is ~vertical (e.g. tongue) — no lateral cue; face straight front.
    facing = WORLD_FORWARD.clone();
  } else {
    horiz.normalize();
    facing = WORLD_FORWARD.clone()
      .addScaledVector(horiz, RING_OUTWARD_BLEND)
      .normalize();
  }
  // Orthonormal basis: Z' = facing (hole axis), Y' = up (band top), X' = Y'×Z'.
  const zAxis = facing;
  const yAxis = WORLD_UP.clone();
  const xAxis = new Vector3().crossVectors(yAxis, zAxis).normalize();
  // Re-orthogonalize Y against X,Z to kill drift (facing is already ⟂ up, but
  // be defensive against fp error).
  yAxis.crossVectors(zAxis, xAxis).normalize();
  const m = new Matrix4().makeBasis(xAxis, yAxis, zAxis);
  return new Quaternion().setFromRotationMatrix(m);
}

/** Final world orientation for a single-anchor piece: the type-appropriate base
 *  (post rotation, or ring frame) with the optional per-binding nudge applied in
 *  the piece's LOCAL frame. */
export function orientationForPiece(
  anchor: AnchorWire,
  type: JewelryType | undefined,
  rotationOffset: Vec3 | null | undefined,
): Quaternion {
  let base: Quaternion;
  if (type === "RING") {
    base = anchor.ringRotation
      ? eulerToQuat(anchor.ringRotation)
      : deriveRingRotation(anchor.rotation);
  } else {
    base = eulerToQuat(anchor.rotation);
  }
  if (rotationOffset) base.multiply(eulerToQuat(rotationOffset));
  return base;
}

export function placeSingleAnchor(
  group: Group,
  anchor: AnchorWire,
  scale: number,
  attachLocal: Vector3 | undefined,
  type?: JewelryType,
  rotationOffset?: Vec3 | null,
) {
  let quat = orientationForPiece(anchor, type, rotationOffset);
  // Captive cartilage ring: tilt it OUTWARD about the piercing so it wraps over the
  // rim edge (like the reference) instead of hanging straight down into the ear.
  // Applied to the orientation; the attach-offset below re-derives from it, so the
  // band-top (wire) stays on the piercing.
  if (type === "RING" && anchor.hoopSeat === "captive") {
    const normal = new Vector3(0, 0, 1).applyQuaternion(eulerToQuat(anchor.rotation));
    const tiltAxis = new Vector3().crossVectors(normal, WORLD_UP);
    if (tiltAxis.lengthSq() > 1e-6) {
      quat = new Quaternion()
        .setFromAxisAngle(tiltAxis.normalize(), CARTILAGE_LEAN)
        .multiply(quat);
    }
  }
  group.scale.setScalar(scale);
  group.quaternion.copy(quat);
  group.position.set(anchor.position.x, anchor.position.y, anchor.position.z);

  if (!attachLocal) return; // legacy GLB without attach:primary — done.

  // Offset the mesh so attach:primary (the band-top — a point on the ring's WIRE)
  // lands exactly on the anchor, so the ring threads THROUGH the piercing (the wire
  // passes through it) and encircles the adjacent cartilage edge — like a real
  // captive ring. Studs land their post-neck here so the post embeds.
  const localOffset = attachLocal
    .clone()
    .applyQuaternion(quat)
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

export function placeMultiAnchor(
  group: Group,
  anchors: AnchorWire[],
  attachLocals: Vector3[],
  attachUp?: Vector3 | null,
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

  // Optional third-DOF constraint: if the GLB carries an `attach:up` reference,
  // roll the piece about the bar axis so its local "up" lines up with world up —
  // needed for asymmetric multi-anchor pieces (e.g. an industrial with a gem on
  // one ball). Without it the roll is left free (fine for symmetric bars).
  if (attachUp) {
    const localUp = attachUp.clone().sub(meshA);
    localUp.addScaledVector(meshDirNorm, -localUp.dot(meshDirNorm)); // ⟂ to the bar
    const desiredUp = WORLD_UP.clone().addScaledVector(
      worldDirNorm,
      -WORLD_UP.dot(worldDirNorm),
    ); // world up ⟂ to the bar
    if (localUp.lengthSq() > 1e-12 && desiredUp.lengthSq() > 1e-12) {
      const rotatedUp = localUp.applyQuaternion(quat).normalize();
      desiredUp.normalize();
      const cross = new Vector3().crossVectors(rotatedUp, desiredUp);
      const angle = Math.atan2(cross.dot(worldDirNorm), rotatedUp.dot(desiredUp));
      quat.premultiply(new Quaternion().setFromAxisAngle(worldDirNorm, angle));
    }
  }

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
