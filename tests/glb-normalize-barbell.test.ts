import { describe, it, expect } from "vitest";
import { Document } from "@gltf-transform/core";
import { Euler, Vector3 } from "three";
import { normalizeBarbellDocument } from "@/lib/admin/glb-normalize";

// Build a barbell-shaped point cloud (thin shaft + a fat ball at each end),
// already rotated + translated into an arbitrary "world" frame so the test
// exercises orientation-invariance. We bake the pose into the vertices and leave
// the node transform at identity, so the recovered attach points come back in the
// same coordinates as the (also-transformed) ball centers.
function makeBarbell(rot: Euler, trans: Vector3) {
  const out: number[] = [];
  const push = (x: number, y: number, z: number) => {
    const v = new Vector3(x, y, z).applyEuler(rot).add(trans);
    out.push(v.x, v.y, v.z);
  };
  // Thin shaft (radius 0.05) along local Z, z ∈ [-0.8, 0.8].
  for (let i = 0; i < 200; i++) {
    const z = -0.8 + (1.6 * i) / 199;
    const a = i * 2.399;
    push(0.05 * Math.cos(a), 0.05 * Math.sin(a), z);
  }
  // Two balls (radius 0.2) centered at z = ∓1 (Fibonacci-sphere sampling).
  const ball = (cz: number) => {
    for (let i = 0; i < 400; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / 400);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      push(
        0.2 * Math.sin(phi) * Math.cos(theta),
        0.2 * Math.sin(phi) * Math.sin(theta),
        cz + 0.2 * Math.cos(phi),
      );
    }
  };
  ball(-1);
  ball(1);
  return {
    pts: new Float32Array(out),
    ballA: new Vector3(0, 0, -1).applyEuler(rot).add(trans),
    ballB: new Vector3(0, 0, 1).applyEuler(rot).add(trans),
  };
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

describe("normalizeBarbellDocument", () => {
  it("recovers two endpoints near the ball centers at arbitrary orientation", () => {
    const rot = new Euler(0.4, -1.1, 0.7);
    const trans = new Vector3(2, -1, 0.5);
    const { pts, ballA, ballB } = makeBarbell(rot, trans);

    const r = normalizeBarbellDocument(docFromPoints(pts));
    expect(r.ok).toBe(true);
    expect(r.attachLocals).toHaveLength(2);
    expect(r.suggestedScale).toBeNull(); // multi-anchor scale is renderer-derived

    const [e0, e1] = r.attachLocals!.map((p) => new Vector3(p[0], p[1], p[2]));
    // Endpoint order is arbitrary for a symmetric bar — match as an unordered set.
    const matched =
      (e0.distanceTo(ballA) < 0.15 && e1.distanceTo(ballB) < 0.15) ||
      (e0.distanceTo(ballB) < 0.15 && e1.distanceTo(ballA) < 0.15);
    expect(matched).toBe(true);
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  it("gives low confidence for a non-bar blob (sphere)", () => {
    const out: number[] = [];
    for (let i = 0; i < 800; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / 800);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      out.push(
        0.5 * Math.sin(phi) * Math.cos(theta),
        0.5 * Math.sin(phi) * Math.sin(theta),
        0.5 * Math.cos(phi),
      );
    }
    const r = normalizeBarbellDocument(docFromPoints(new Float32Array(out)));
    // A near-isotropic blob has elongation ≈ 1 → confidence floors near 0.2, so it
    // routes to manual review rather than shipping a bogus 2-point placement.
    expect(r.confidence).toBeLessThan(0.4);
  });

  it("bails out cleanly on too few vertices", () => {
    const r = normalizeBarbellDocument(
      docFromPoints(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])),
    );
    expect(r.ok).toBe(false);
  });
});
