import { describe, it, expect } from "vitest";
import { groupEquipped } from "@/lib/catalog/place-jewelry";
import type {
  AnchorWire,
  EquippedMap,
  JewelryType,
  JewelryWire,
} from "@/lib/catalog/types";

function anchor(id: string): AnchorWire {
  return { id } as unknown as AnchorWire;
}

function jewelry(
  id: string,
  type: JewelryType,
  bindings: { anchorId: string; order: number }[],
): JewelryWire {
  return { id, type, anchorBindings: bindings } as unknown as JewelryWire;
}

function maps(anchors: AnchorWire[], jewels: JewelryWire[]) {
  const anchorsById = new Map(anchors.map((a) => [a.id, a]));
  const jewelryById = new Map(jewels.map((j) => [j.id, j]));
  return { anchorsById, jewelryById };
}

describe("groupEquipped", () => {
  it("renders a STUD/RING worn on N anchors as N independent single-anchor pieces", () => {
    const a = [anchor("a1"), anchor("a2")];
    const j = jewelry("ring", "RING", [
      { anchorId: "a1", order: 0 },
      { anchorId: "a2", order: 0 },
    ]);
    const equipped: EquippedMap = { a1: "ring", a2: "ring" };
    const { anchorsById, jewelryById } = maps(a, [j]);

    const pieces = groupEquipped(equipped, anchorsById, jewelryById);

    // Two separate instances, each at exactly one anchor — NOT one stretched
    // multi-anchor piece (the regression this guards against).
    expect(pieces).toHaveLength(2);
    expect(pieces.every((p) => p.anchors.length === 1)).toBe(true);
    expect(pieces.map((p) => p.anchors[0].id).sort()).toEqual(["a1", "a2"]);
    expect(pieces.every((p) => p.jewelry.id === "ring")).toBe(true);
  });

  it("keeps a fixed multi-anchor (BARBELL) as one piece spanning all anchors, sorted by binding order", () => {
    const a = [anchor("top"), anchor("bottom")];
    const j = jewelry("bar", "BARBELL", [
      { anchorId: "top", order: 0 },
      { anchorId: "bottom", order: 1 },
    ]);
    // Insertion order deliberately reversed to prove the order-sort runs.
    const equipped: EquippedMap = { bottom: "bar", top: "bar" };
    const { anchorsById, jewelryById } = maps(a, [j]);

    const pieces = groupEquipped(equipped, anchorsById, jewelryById);

    expect(pieces).toHaveLength(1);
    expect(pieces[0].anchors.map((x) => x.id)).toEqual(["top", "bottom"]);
  });

  it("treats different single-anchor pieces independently", () => {
    const a = [anchor("a1"), anchor("a2")];
    const j1 = jewelry("studA", "STUD", [{ anchorId: "a1", order: 0 }]);
    const j2 = jewelry("studB", "STUD", [{ anchorId: "a2", order: 0 }]);
    const equipped: EquippedMap = { a1: "studA", a2: "studB" };
    const { anchorsById, jewelryById } = maps(a, [j1, j2]);

    const pieces = groupEquipped(equipped, anchorsById, jewelryById);
    expect(pieces).toHaveLength(2);
    expect(pieces.every((p) => p.anchors.length === 1)).toBe(true);
  });
});
