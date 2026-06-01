/**
 * Geometry-based auto-placement for AI-generated STUD models.
 *
 * Image-to-3D providers (Tripo3D / Replicate) hand back a stud at an arbitrary
 * orientation, with its origin at the center of mass and no attachment metadata.
 * The catalog renderer (`components/catalog/EquippedPieces.tsx`) seats a piece by
 * applying the anchor's rotation and snapping the GLB's `attach:primary` empty to
 * the anchor point, where — per `docs/07-3d-fitting.md` — the canonical local
 * frame is **+Z pointing outward from the skin** (decorative head out, post in).
 *
 * This module recovers that pose deterministically and BAKES it into the GLB, so
 * an AI stud ends up behaving exactly like the parametric pieces — no schema
 * change, no renderer change, no per-render cost:
 *
 *   1. Bake node transforms → geometry in a single world space.
 *   2. PCA over the vertices → the elongation axis (the post+head line).
 *   3. Cross-section radius per side → which end is the bulky decorative head.
 *   4. Rotate so head→+Z (post→−Z); find the "neck" where the head meets the
 *      post → that skin-contact point becomes `attach:primary`.
 *   5. Derive a scale suggestion from the measured head/post diameters.
 *
 * Returns a confidence score; the caller flags low-confidence results for the
 * admin's verify step instead of shipping a bad placement silently. Rings and
 * multi-anchor types are out of scope here (phase 2).
 */

import type { Document, Node } from "@gltf-transform/core";
import { clearNodeTransform, transformMesh } from "@gltf-transform/functions";
import { Matrix4, Quaternion, Vector3 } from "three";

export interface NormalizeResult {
  ok: boolean;
  /** 0..1 — how sure we are the pose is right. Low → route to manual verify. */
  confidence: number;
  /** Diagnostic for logs / admin messaging. */
  note: string;
  /** Suggested `Jewelry.glbScale` from measured geometry vs gauge/size (or null). */
  suggestedScale: number | null;
  /** Measured decorative-head diameter, in GLB meters (post-normalize). */
  headDiameterM?: number;
  /**
   * Where to place the `attach:primary` empty, in the baked (canonical) scene
   * frame: the skin-contact "neck" point on the +Z axis. The CALLER injects the
   * node AFTER compression — `prune()` would delete a mesh-less leaf node mid-pass.
   */
  attachLocal?: [number, number, number];
  /**
   * True when the decorative face is non-round, so the roll about +Z ("which way
   * is up") is visually meaningful but NOT recoverable from geometry alone. The
   * baseline roll is set to major-axis-vertical; the optional AI tiebreaker
   * (lib/admin/glb-roll-vision.ts) resolves the remaining flip against the photo.
   */
  rollAmbiguous?: boolean;
}

// ── Tuning ───────────────────────────────────────────────────────────────────
const RADIUS_BINS = 24; // resolution of the along-axis cross-section profile.
// A stud reads as "clearly a stud" when it's elongated AND has a fat head over a
// thin post. These map raw ratios → 0..1 sub-scores that gate confidence.
const ELONG_LO = 1.15; // length:width below this ≈ a blob, not a post.
const ELONG_HI = 3.5;
const CONTRAST_LO = 1.3; // head:post radius below this ≈ no detectable neck.
const CONTRAST_HI = 3.0;

function smoothstep(lo: number, hi: number, x: number): number {
  if (hi <= lo) return 0;
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}

// ── Symmetric 3×3 eigensolver (Jacobi rotation) ───────────────────────────────
// Returns eigenvalues + eigenvectors sorted by DESCENDING eigenvalue. Used on the
// vertex covariance matrix to find principal axes. Classic, ~10-sweep Jacobi —
// plenty accurate for a 3×3 and dependency-free.
function eigenSym3(
  m: number[][],
): { values: number[]; vectors: number[][] } {
  const a = [
    [m[0][0], m[0][1], m[0][2]],
    [m[1][0], m[1][1], m[1][2]],
    [m[2][0], m[2][1], m[2][2]],
  ];
  const v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];

  for (let sweep = 0; sweep < 50; sweep++) {
    const off =
      Math.abs(a[0][1]) + Math.abs(a[0][2]) + Math.abs(a[1][2]);
    if (off < 1e-12) break;

    for (const [p, q] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ]) {
      if (Math.abs(a[p][q]) < 1e-15) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t =
        Math.sign(theta || 1) /
        (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1);
      const s = t * c;

      for (let i = 0; i < 3; i++) {
        const aip = a[i][p];
        const aiq = a[i][q];
        a[i][p] = c * aip - s * aiq;
        a[i][q] = s * aip + c * aiq;
      }
      for (let i = 0; i < 3; i++) {
        const api = a[p][i];
        const aqi = a[q][i];
        a[p][i] = c * api - s * aqi;
        a[q][i] = s * api + c * aqi;
      }
      for (let i = 0; i < 3; i++) {
        const vip = v[i][p];
        const viq = v[i][q];
        v[i][p] = c * vip - s * viq;
        v[i][q] = s * vip + c * viq;
      }
    }
  }

  const idx = [0, 1, 2].sort((i, j) => a[j][j] - a[i][i]);
  return {
    values: idx.map((i) => a[i][i]),
    vectors: idx.map((i) => [v[0][i], v[1][i], v[2][i]]),
  };
}

// ── Hierarchy + vertex helpers ────────────────────────────────────────────────

/** True when any mesh is shared by >1 node — baking transforms would corrupt it,
 *  so we bail out of normalization. (Provider output is single-mesh; defensive.) */
function hasSharedMesh(doc: Document): boolean {
  const seen = new Set<unknown>();
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    if (seen.has(mesh)) return true;
    seen.add(mesh);
  }
  return false;
}

/** Bake every node's local transform into its geometry (top-down) so all
 *  vertices share one world space and node transforms become identity. */
function bakeNodeTransforms(doc: Document): void {
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  if (!scene) return;
  const visit = (node: Node) => {
    clearNodeTransform(node);
    node.listChildren().forEach(visit);
  };
  scene.listChildren().forEach(visit);
}

/** Collect every POSITION vertex across all meshes. Call AFTER bakeNodeTransforms
 *  so the coordinates are already in world space. */
function gatherPositions(doc: Document): number[][] {
  const pts: number[][] = [];
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      if (!pos) continue;
      const el = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, el);
        pts.push([el[0], el[1], el[2]]);
      }
    }
  }
  return pts;
}

// ── Main entry ─────────────────────────────────────────────────────────────────

/**
 * Analyze + reorient a STUD document in place. Mutates `doc`: bakes the canonical
 * orientation into the geometry and adds an `attach:primary` node. Never throws —
 * on any failure it leaves `doc` usable and returns `ok:false` with a note, so the
 * surrounding optimize/upload pipeline still produces a valid (just un-posed) GLB.
 */
export function normalizeStudDocument(
  doc: Document,
  opts: { gauge?: number | null; size?: number | null },
): NormalizeResult {
  try {
    if (hasSharedMesh(doc)) {
      return { ok: false, confidence: 0, note: "shared mesh — skipped", suggestedScale: null };
    }

    bakeNodeTransforms(doc);
    const pts = gatherPositions(doc);
    if (pts.length < 64) {
      return { ok: false, confidence: 0, note: "too few vertices", suggestedScale: null };
    }

    // Centroid.
    const c = [0, 0, 0];
    for (const p of pts) {
      c[0] += p[0];
      c[1] += p[1];
      c[2] += p[2];
    }
    c[0] /= pts.length;
    c[1] /= pts.length;
    c[2] /= pts.length;

    // Covariance (symmetric 3×3).
    const cov = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    for (const p of pts) {
      const dx = p[0] - c[0];
      const dy = p[1] - c[1];
      const dz = p[2] - c[2];
      cov[0][0] += dx * dx;
      cov[1][1] += dy * dy;
      cov[2][2] += dz * dz;
      cov[0][1] += dx * dy;
      cov[0][2] += dx * dz;
      cov[1][2] += dy * dz;
    }
    cov[1][0] = cov[0][1];
    cov[2][0] = cov[0][2];
    cov[2][1] = cov[1][2];

    const { values, vectors } = eigenSym3(cov);
    // PC1 (largest variance) is the post+head elongation axis.
    let axis = new Vector3(vectors[0][0], vectors[0][1], vectors[0][2]).normalize();
    const elong = values[0] / (values[1] + 1e-9); // length : width

    const centroid = new Vector3(c[0], c[1], c[2]);

    // Split vertices by side along the axis and measure mean radial distance, so
    // the bulkier end (the decorative head) can be sent to +Z.
    let rPlus = 0;
    let nPlus = 0;
    let rMinus = 0;
    let nMinus = 0;
    const tmp = new Vector3();
    for (const p of pts) {
      tmp.set(p[0], p[1], p[2]).sub(centroid);
      const t = tmp.dot(axis);
      const radial = Math.sqrt(Math.max(0, tmp.lengthSq() - t * t));
      if (t >= 0) {
        rPlus += radial;
        nPlus++;
      } else {
        rMinus += radial;
        nMinus++;
      }
    }
    rPlus /= Math.max(1, nPlus);
    rMinus /= Math.max(1, nMinus);
    // Point the axis toward the heavier (head) side.
    if (rMinus > rPlus) axis = axis.clone().multiplyScalar(-1);

    // Canonical-frame z (along the head-ward axis) + radius profile per bin.
    let zMin = Infinity;
    let zMax = -Infinity;
    const zs: number[] = new Array(pts.length);
    const rs: number[] = new Array(pts.length);
    for (let i = 0; i < pts.length; i++) {
      tmp.set(pts[i][0], pts[i][1], pts[i][2]).sub(centroid);
      const z = tmp.dot(axis);
      zs[i] = z;
      rs[i] = Math.sqrt(Math.max(0, tmp.lengthSq() - z * z));
      if (z < zMin) zMin = z;
      if (z > zMax) zMax = z;
    }
    const span = zMax - zMin || 1e-6;
    const binMaxR = new Array(RADIUS_BINS).fill(0);
    for (let i = 0; i < pts.length; i++) {
      const b = Math.min(
        RADIUS_BINS - 1,
        Math.floor(((zs[i] - zMin) / span) * RADIUS_BINS),
      );
      if (rs[i] > binMaxR[b]) binMaxR[b] = rs[i];
    }
    // Head diameter = the WIDEST cross-section (the equator bin), not the +Z tip
    // — a round/domed head narrows again at its outer pole. Post radius = the mean
    // of the thin far-post quarter (−Z), robust to a noisy tip.
    let eqBin = 0;
    for (let b = 1; b < RADIUS_BINS; b++) {
      if (binMaxR[b] > binMaxR[eqBin]) eqBin = b;
    }
    const headR = binMaxR[eqBin];
    const postBinCount = Math.max(1, Math.floor(RADIUS_BINS * 0.25));
    let postR = 0;
    for (let b = 0; b < postBinCount; b++) postR += binMaxR[b];
    postR = postR / postBinCount || headR;
    const contrast = headR / (postR + 1e-9);

    // Neck = the head/post boundary. Scan from the equator DOWN toward the post;
    // the first bin whose radius drops below the head→post midpoint is the
    // skin-contact point → attach:primary. (Scanning from the +Z pole instead
    // would false-trigger on the head's own narrowing dome.)
    const threshold = postR + 0.4 * (headR - postR);
    let neckZ = zMin; // fallback: post tip
    for (let b = eqBin; b >= 0; b--) {
      if (binMaxR[b] < threshold) {
        neckZ = zMin + ((b + 1) / RADIUS_BINS) * span;
        break;
      }
    }

    // Quaternion that takes the head-ward axis onto +Z.
    const q = new Quaternion().setFromUnitVectors(axis, new Vector3(0, 0, 1));

    // Meaningful baseline ROLL: setFromUnitVectors leaves the rotation about +Z
    // arbitrary, so a non-round head would land at a random angle. Project the
    // decorative head face into the +Z view plane, find its 2D principal axis,
    // and roll so that axis is VERTICAL — a repeatable orientation, and the
    // anchor for the AI tiebreaker's candidate rolls. Also yields rollAmbiguous:
    // a round face (λ1≈λ2) has no meaningful "up", so we don't flag it.
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    let nHead = 0;
    const pv = new Vector3();
    for (const p of pts) {
      pv.set(p[0], p[1], p[2]).sub(centroid);
      if (pv.dot(axis) < neckZ) continue; // head region only
      pv.applyQuaternion(q); // pv.x, pv.y now lie in the +Z view plane
      sxx += pv.x * pv.x;
      sxy += pv.x * pv.y;
      syy += pv.y * pv.y;
      nHead++;
    }
    let rollAngle = 0;
    let rollAsymmetry = 1;
    if (nHead > 16) {
      sxx /= nHead;
      sxy /= nHead;
      syy /= nHead;
      const tr = sxx + syy;
      const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - (sxx * syy - sxy * sxy)));
      const l1 = tr / 2 + disc;
      const l2 = tr / 2 - disc;
      rollAsymmetry = l2 > 1e-9 ? Math.sqrt(l1 / l2) : 999;
      const phi = 0.5 * Math.atan2(2 * sxy, sxx - syy); // major-axis angle
      rollAngle = Math.PI / 2 - phi; // rotate major axis onto vertical (+Y)
    }
    const rollAmbiguous = rollAsymmetry > 1.25;

    // Build the rigid correction M = Rz(roll) · R(q) · T(−centroid): center on
    // centroid, rotate the head-ward axis onto +Z, then apply the baseline roll.
    // (No scale — scale stays in glbScale. Rz about +Z leaves attach on the axis.)
    const M = new Matrix4()
      .makeRotationZ(rollAngle)
      .multiply(new Matrix4().makeRotationFromQuaternion(q))
      .multiply(new Matrix4().makeTranslation(-centroid.x, -centroid.y, -centroid.z));

    // Bake M into all geometry.
    const m = [...M.elements] as unknown as Parameters<typeof transformMesh>[1];
    for (const mesh of doc.getRoot().listMeshes()) {
      transformMesh(mesh, m);
    }

    // attach:primary sits at the neck on the (now) +Z axis. After M the axis is
    // +Z and the centroid is at the origin, so the neck point is (0, 0, neckZ).
    // The caller injects the node post-compression (prune deletes mesh-less leaves).
    const attachLocal: [number, number, number] = [0, 0, neckZ];

    // Scale: prefer the measured decorative-head diameter vs the real `size`;
    // fall back to post diameter vs `gauge`.
    const headDiameterM = headR * 2;
    const postDiameterM = postR * 2;
    let suggestedScale: number | null = null;
    if (opts.size && headDiameterM > 1e-6) {
      suggestedScale = opts.size / 1000 / headDiameterM;
    } else if (opts.gauge && postDiameterM > 1e-6) {
      suggestedScale = opts.gauge / 1000 / postDiameterM;
    }

    const confidence =
      0.2 +
      0.8 *
        Math.min(
          smoothstep(ELONG_LO, ELONG_HI, elong),
          smoothstep(CONTRAST_LO, CONTRAST_HI, contrast),
        );

    return {
      ok: true,
      confidence: Number(confidence.toFixed(2)),
      note: `elong ${elong.toFixed(2)}, head/post ${contrast.toFixed(2)}, roll-asym ${rollAsymmetry.toFixed(2)}`,
      suggestedScale,
      headDiameterM,
      attachLocal,
      rollAmbiguous,
    };
  } catch (err) {
    return {
      ok: false,
      confidence: 0,
      note: err instanceof Error ? err.message : "normalize failed",
      suggestedScale: null,
    };
  }
}

// ── Helpers for the AI roll tiebreaker (lib/admin/glb-roll-vision.ts) ──────────

/** Collect all mesh-vertex positions in the current (post-normalize, oriented)
 *  frame — the input the roll renderer projects down +Z. */
export function collectMeshVertices(doc: Document): number[][] {
  return gatherPositions(doc);
}

/** Bake a roll about +Z (radians) into all geometry, to apply the AI-chosen
 *  orientation. attach:primary lives on the +Z axis, so it stays put. */
export function bakeRoll(doc: Document, angleRad: number): void {
  if (!angleRad) return;
  const m = [
    ...new Matrix4().makeRotationZ(angleRad).elements,
  ] as unknown as Parameters<typeof transformMesh>[1];
  for (const mesh of doc.getRoot().listMeshes()) transformMesh(mesh, m);
}

/** Bake a 180° flip about X into all geometry — swaps which end points +Z
 *  (head vs post), to correct a geometric head/post mis-detection that the AI
 *  head-direction check (lib/admin/glb-roll-vision.ts) caught. A point (x,y,z)
 *  maps to (x,−y,−z), so the CALLER must mirror attach:primary's Z too
 *  ((0,0,neckZ) → (0,0,−neckZ)). */
export function bakeHeadFlip(doc: Document): void {
  const m = [
    ...new Matrix4().makeRotationX(Math.PI).elements,
  ] as unknown as Parameters<typeof transformMesh>[1];
  for (const mesh of doc.getRoot().listMeshes()) transformMesh(mesh, m);
}

// ── RING auto-placement (phase 3) ──────────────────────────────────────────────

/** Centroid + principal axes (eigenvectors sorted by descending variance) of a
 *  point set — shared by the ring detector. */
function computePrincipalAxes(pts: number[][]): {
  centroid: Vector3;
  values: number[];
  vectors: Vector3[];
} {
  const c = [0, 0, 0];
  for (const p of pts) {
    c[0] += p[0];
    c[1] += p[1];
    c[2] += p[2];
  }
  c[0] /= pts.length;
  c[1] /= pts.length;
  c[2] /= pts.length;
  const cov = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (const p of pts) {
    const dx = p[0] - c[0];
    const dy = p[1] - c[1];
    const dz = p[2] - c[2];
    cov[0][0] += dx * dx;
    cov[1][1] += dy * dy;
    cov[2][2] += dz * dz;
    cov[0][1] += dx * dy;
    cov[0][2] += dx * dz;
    cov[1][2] += dy * dz;
  }
  cov[1][0] = cov[0][1];
  cov[2][0] = cov[0][2];
  cov[2][1] = cov[1][2];
  const { values, vectors } = eigenSym3(cov);
  return {
    centroid: new Vector3(c[0], c[1], c[2]),
    values,
    vectors: vectors.map((v) => new Vector3(v[0], v[1], v[2]).normalize()),
  };
}

/**
 * Analyze + reorient a RING (hoop) document in place. Per the parametric
 * convention (docs/20-multi-anchor-jewelry.md, shape_seamless_hoop.py): the ring
 * lies in the XY plane with its hole-axis along +Z (body-outward), centered at
 * `attach:primary` = (0,0,0). We recover that pose: the least-variance principal
 * axis is the ring normal (a torus is thin along its hole axis) → map it onto +Z,
 * center on the centroid. Confidence combines flatness (thin along normal),
 * roundness (isotropic in-plane) and hole presence (inner radius > 0) so a disc or
 * a sphere — which aren't rings — score low and route to manual review. Mutates
 * `doc`; the caller injects attach:primary at (0,0,0). Never throws.
 */
export function normalizeRingDocument(
  doc: Document,
  opts: { gauge?: number | null; size?: number | null },
): NormalizeResult {
  try {
    if (hasSharedMesh(doc)) {
      return { ok: false, confidence: 0, note: "shared mesh — skipped", suggestedScale: null };
    }
    bakeNodeTransforms(doc);
    const pts = gatherPositions(doc);
    if (pts.length < 64) {
      return { ok: false, confidence: 0, note: "too few vertices", suggestedScale: null };
    }

    const { centroid, values, vectors } = computePrincipalAxes(pts);
    const normal = vectors[2]; // least variance = the ring's hole axis

    // In-plane radial distances (perpendicular to the normal) → inner/outer radius.
    const radii: number[] = new Array(pts.length);
    const tmp = new Vector3();
    for (let i = 0; i < pts.length; i++) {
      tmp.set(pts[i][0], pts[i][1], pts[i][2]).sub(centroid);
      const along = tmp.dot(normal);
      radii[i] = Math.sqrt(Math.max(0, tmp.lengthSq() - along * along));
    }
    radii.sort((a, b) => a - b);
    const pct = (p: number) =>
      radii[Math.min(radii.length - 1, Math.max(0, Math.floor(p * radii.length)))];
    const innerR = pct(0.02);
    const outerR = pct(0.98);
    const outerDiameterM = outerR * 2;
    const tubeR = Math.max(1e-6, (outerR - innerR) / 2);
    const holeRatio = outerR > 1e-9 ? innerR / outerR : 0;

    // Shape scores: thin along the normal (flat), isotropic in-plane (round),
    // and an actual hole (ring, not a filled disc).
    const flatness = values[2] > 1e-12 ? Math.sqrt(values[0] / values[2]) : 999;
    const roundness = values[0] > 1e-12 ? values[1] / values[0] : 0;

    // Orient: ring normal → +Z, center → origin. attach:primary = center.
    const q = new Quaternion().setFromUnitVectors(normal, new Vector3(0, 0, 1));
    const M = new Matrix4()
      .makeRotationFromQuaternion(q)
      .multiply(new Matrix4().makeTranslation(-centroid.x, -centroid.y, -centroid.z));
    const m = [...M.elements] as unknown as Parameters<typeof transformMesh>[1];
    for (const mesh of doc.getRoot().listMeshes()) transformMesh(mesh, m);

    const attachLocal: [number, number, number] = [0, 0, 0];

    // `size` for a ring = outer diameter (mm); fall back to gauge vs tube diameter.
    let suggestedScale: number | null = null;
    if (opts.size && outerDiameterM > 1e-6) {
      suggestedScale = opts.size / 1000 / outerDiameterM;
    } else if (opts.gauge && tubeR > 1e-6) {
      suggestedScale = opts.gauge / 1000 / (tubeR * 2);
    }

    const confidence =
      0.2 +
      0.8 *
        Math.min(
          smoothstep(2.0, 6.0, flatness),
          smoothstep(0.6, 0.85, roundness),
          smoothstep(0.2, 0.5, holeRatio),
        );

    return {
      ok: true,
      confidence: Number(confidence.toFixed(2)),
      note: `flat ${flatness.toFixed(2)}, round ${roundness.toFixed(2)}, hole ${holeRatio.toFixed(2)}`,
      suggestedScale,
      attachLocal,
    };
  } catch (err) {
    return {
      ok: false,
      confidence: 0,
      note: err instanceof Error ? err.message : "ring normalize failed",
      suggestedScale: null,
    };
  }
}
