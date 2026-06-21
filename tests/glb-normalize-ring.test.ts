import { describe, it, expect } from "vitest";
import { Document } from "@gltf-transform/core";
import { Euler, Vector3 } from "three";
import {
  normalizeRingDocument,
  measureRingBandFromDoc,
} from "@/lib/admin/glb-normalize";

// Build a hoop (torus band) optionally with a pendant/charm hanging below it (−Y in
// the model's own frame), then bake an arbitrary world pose into the vertices so the
// test exercises orientation-invariance. normalizeRingDocument re-centers + re-orients
// into the canonical frame (hole axis → +Z, band top → +Y) and returns attach:primary
// in THAT frame, so a correct placement is always ≈ [0, ringRadius, 0] regardless of
// input pose — and crucially NOT dragged toward the hole center or onto the pendant.
function makeHoop(opts: {
  rot: Euler;
  trans: Vector3;
  R?: number; // ring (band centerline) radius
  tube?: number;
  pendant?: boolean;
}) {
  const R = opts.R ?? 1;
  const tube = opts.tube ?? 0.08;
  const out: number[] = [];
  const push = (x: number, y: number, z: number) => {
    const w = new Vector3(x, y, z).applyEuler(opts.rot).add(opts.trans);
    out.push(w.x, w.y, w.z);
  };

  // Band: torus in the XY plane, hole axis +Z.
  const M = 140;
  const K = 12;
  for (let i = 0; i < M; i++) {
    const theta = (2 * Math.PI * i) / M;
    for (let j = 0; j < K; j++) {
      const phi = (2 * Math.PI * j) / K;
      const rr = R + tube * Math.cos(phi);
      push(rr * Math.cos(theta), rr * Math.sin(theta), tube * Math.sin(phi));
    }
  }

  if (opts.pendant) {
    // A heavy charm hanging below the band (−Y): a dense blob + a thin bail. ~26% of
    // the vertices — enough to wreck the old centroid/radius estimate.
    const blob = (cy: number, rad: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;
        push(
          rad * Math.sin(phi) * Math.cos(theta),
          cy + rad * Math.sin(phi) * Math.sin(theta),
          rad * Math.sin(phi) * Math.cos(theta) * 0, // keep it ~in-plane (flat charm)
        );
      }
    };
    blob(-(R + 0.55), 0.32, 560);
    // Bail connecting the band (−Y) down to the blob.
    for (let i = 0; i < 40; i++) {
      const t = i / 39;
      push(0.02 * Math.cos(i), -(R + 0.23 * t), 0.02 * Math.sin(i));
    }
  }

  return new Float32Array(out);
}

function docFromPoints(pts: Float32Array<ArrayBuffer>): Document {
  const doc = new Document();
  const buf = doc.createBuffer();
  const pos = doc.createAccessor().setType("VEC3").setArray(pts).setBuffer(buf);
  const prim = doc.createPrimitive().setAttribute("POSITION", pos);
  const mesh = doc.createMesh().addPrimitive(prim);
  const scene = doc.createScene().addChild(doc.createNode().setMesh(mesh));
  doc.getRoot().setDefaultScene(scene);
  return doc;
}

describe("normalizeRingDocument", () => {
  it("places attach on the BAND (not the pendant) for a ring with a charm", () => {
    const R = 1;
    const pts = makeHoop({
      rot: new Euler(0.5, -0.9, 0.3),
      trans: new Vector3(1.5, -2, 0.7),
      R,
      pendant: true,
    });

    const r = normalizeRingDocument(docFromPoints(pts), { gauge: null, size: null });
    expect(r.ok).toBe(true);
    expect(r.attachLocal).toBeDefined();
    expect(r.note).toContain("feature pendant"); // pendant detected + rolled down
    expect(r.rollAmbiguous).toBe(true);

    const a = new Vector3(...r.attachLocal!);
    // On the band: x≈0, z≈0, and at the band radius on +Y — NOT in the hole center
    // (~0.5R, the old bug) and NOT on the pendant (~1.55R below).
    expect(Math.abs(a.x)).toBeLessThan(0.18);
    expect(Math.abs(a.z)).toBeLessThan(0.18);
    expect(a.y).toBeGreaterThan(0.82 * R);
    expect(a.y).toBeLessThan(1.18 * R);
    // The attach radius itself tracks the band centerline, not the inflated extent.
    expect(a.length()).toBeGreaterThan(0.82 * R);
    expect(a.length()).toBeLessThan(1.18 * R);
  });

  it("still places attach on the band for a clean hoop (no regression)", () => {
    const R = 1;
    const pts = makeHoop({
      rot: new Euler(-0.7, 0.4, 1.1),
      trans: new Vector3(-1, 0.5, 2),
      R,
      pendant: false,
    });

    const r = normalizeRingDocument(docFromPoints(pts), { gauge: null, size: null });
    expect(r.ok).toBe(true);
    const a = new Vector3(...r.attachLocal!);
    expect(Math.abs(a.x)).toBeLessThan(0.12);
    expect(Math.abs(a.z)).toBeLessThan(0.12);
    expect(a.y).toBeGreaterThan(0.88 * R);
    expect(a.y).toBeLessThan(1.12 * R);
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  it("measureRingBandFromDoc returns the band diameter, not the pendant-inflated bbox", () => {
    const R = 1; // band centerline; tube 0.08 → outer diameter ≈ 2.16
    const pts = makeHoop({
      rot: new Euler(0.3, 0.8, -0.5),
      trans: new Vector3(2, 1, -1),
      R,
      pendant: true,
    });
    const band = measureRingBandFromDoc(docFromPoints(pts));
    expect(band).not.toBeNull();
    // Band outer diameter ≈ 2.16 — NOT the pendant-inclusive height (~2.95) the old
    // whole-bbox measurement would have used.
    expect(band!.outerDiameterM).toBeGreaterThan(2.0);
    expect(band!.outerDiameterM).toBeLessThan(2.4);
    // Tube (wire) diameter ≈ 2 × 0.08 = 0.16.
    expect(band!.tubeDiameterM).toBeGreaterThan(0.1);
    expect(band!.tubeDiameterM).toBeLessThan(0.25);
  });

  it("derives a glbScale from the band's outer diameter, not the pendant extent", () => {
    const R = 1;
    // size = ring outer diameter in mm. Band outer radius ≈ R + tube = 1.08 → outer
    // diameter ≈ 2.16 (model units). With size=10.8mm the scale should be ≈ 0.005,
    // i.e. driven by the BAND, not the taller pendant-inclusive bounding box.
    const pts = makeHoop({
      rot: new Euler(0, 0, 0),
      trans: new Vector3(0, 0, 0),
      R,
      pendant: true,
    });
    const r = normalizeRingDocument(docFromPoints(pts), { gauge: null, size: 10.8 });
    expect(r.ok).toBe(true);
    expect(r.suggestedScale).not.toBeNull();
    // 10.8mm / 1000 / ~2.16 ≈ 0.005. Allow a wide band; the point is it's the ring
    // diameter scale (~0.005), not the pendant-inflated ~0.0035.
    expect(r.suggestedScale!).toBeGreaterThan(0.0042);
    expect(r.suggestedScale!).toBeLessThan(0.0060);
  });
});
