import { describe, it, expect } from "vitest";
import { Group, Vector3 } from "three";
import { placeMultiAnchor } from "@/lib/catalog/place-jewelry";
import type { AnchorWire } from "@/lib/catalog/types";

function anchor(p: [number, number, number]): AnchorWire {
  return { position: { x: p[0], y: p[1], z: p[2] } } as unknown as AnchorWire;
}

// Map a mesh-local point through the group's placement (uniform scale → rotate →
// translate) to its world position.
function toWorld(group: Group, local: Vector3): Vector3 {
  return local
    .clone()
    .multiplyScalar(group.scale.x)
    .applyQuaternion(group.quaternion)
    .add(group.position);
}

describe("placeMultiAnchor", () => {
  it("maps both endpoints onto their anchors and derives scale", () => {
    const group = new Group();
    const anchors = [anchor([0, 0, 0]), anchor([2, 0, 0])]; // bar along world +X
    const attachLocals = [new Vector3(0, 0, 0), new Vector3(0, 0, 1)]; // mesh bar +Z
    placeMultiAnchor(group, anchors, attachLocals);

    expect(group.scale.x).toBeCloseTo(2, 4); // |2| / |1|
    const a = toWorld(group, attachLocals[0]);
    const b = toWorld(group, attachLocals[1]);
    expect(a.x).toBeCloseTo(0, 4);
    expect(b.x).toBeCloseTo(2, 4);
    expect(Math.abs(b.y)).toBeLessThan(1e-3);
    expect(Math.abs(b.z)).toBeLessThan(1e-3);
  });

  it("with attach:up, rolls the piece so local up aligns with world up", () => {
    const group = new Group();
    const anchors = [anchor([0, 0, 0]), anchor([1, 0, 0])]; // bar along world +X
    const attachLocals = [new Vector3(0, 0, 0), new Vector3(0, 0, 1)]; // mesh bar +Z
    const attachUp = new Vector3(0, 1, 0); // local "up" = +Y

    placeMultiAnchor(group, anchors, attachLocals, attachUp);

    // The local up vector should rotate to world up (perpendicular to the +X bar).
    const up = toWorld(group, new Vector3(0, 1, 0));
    expect(up.y).toBeGreaterThan(0.9);
    expect(Math.abs(up.x)).toBeLessThan(0.15);
    expect(Math.abs(up.z)).toBeLessThan(0.15);
    // The endpoints still land on the anchors.
    expect(toWorld(group, attachLocals[1]).x).toBeCloseTo(1, 4);
  });
});
