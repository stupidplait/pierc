import { describe, it, expect } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import {
  KHRMaterialsEmissiveStrength,
  KHRMaterialsIOR,
  KHRMaterialsTransmission,
} from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { buildParametricGlb, buildHybridGlb } from "@/lib/admin/parametric-glb";
import {
  PARAMETRIC_SHAPES,
  type ParametricShape,
} from "@/lib/admin/parametric-shapes";

function io() {
  return new NodeIO().registerExtensions([
    KHRMaterialsIOR,
    KHRMaterialsTransmission,
    KHRMaterialsEmissiveStrength,
  ]);
}

async function read(bytes: Uint8Array) {
  return io().readBinary(bytes);
}

function attachOf(doc: Awaited<ReturnType<typeof read>>, name: string) {
  return doc.getRoot().listNodes().find((n) => n.getName() === name) ?? null;
}

describe("buildParametricGlb — conventions", () => {
  it("seamless_hoop: outer diameter = real mm, attach at band top (+Y)", async () => {
    const bytes = await buildParametricGlb({
      shape: "seamless_hoop",
      materialColor: "titanium",
      params: { diameterMm: 8, gaugeMm: 1.2 },
    });
    const doc = await read(bytes);
    const b = getBounds(doc.getRoot().getDefaultScene()!);
    const xExtent = b.max[0] - b.min[0];
    expect(xExtent).toBeGreaterThan(0.0076); // ~8 mm outer diameter
    expect(xExtent).toBeLessThan(0.0084);

    const primary = attachOf(doc, "attach:primary");
    expect(primary).not.toBeNull();
    const t = primary!.getTranslation();
    // majorR = (8 - 1.2)/2 = 3.4 mm on +Y.
    expect(t[1]).toBeCloseTo(0.0034, 4);
    expect(Math.abs(t[0])).toBeLessThan(1e-6);
  });

  it("straight_barbell: Z spans the bar, two attach endpoints at the balls", async () => {
    const bytes = await buildParametricGlb({
      shape: "straight_barbell",
      materialColor: "gold-585",
      params: { shaftLengthMm: 14, gaugeMm: 1.6, ballSizeMm: 4 },
    });
    const doc = await read(bytes);
    const b = getBounds(doc.getRoot().getDefaultScene()!);
    const zExtent = b.max[2] - b.min[2];
    // ball_in (−2 mm) … ball_out (16 mm) ⇒ ~18 mm.
    expect(zExtent).toBeGreaterThan(0.017);
    expect(zExtent).toBeLessThan(0.019);

    expect(attachOf(doc, "attach:primary")!.getTranslation()[2]).toBeCloseTo(0, 5);
    expect(attachOf(doc, "attach:secondary")!.getTranslation()[2]).toBeCloseTo(
      0.014,
      4,
    );
  });

  it("labret_stud gem: emits a transmissive gem material + attach at origin", async () => {
    const bytes = await buildParametricGlb({
      shape: "labret_stud",
      materialColor: "titanium",
      params: { shaftLengthMm: 8, gaugeMm: 1.2, topShape: "gem", topGemColor: "clear", topSizeMm: 3 },
    });
    const doc = await read(bytes);
    const mats = doc.getRoot().listMaterials();
    expect(mats.length).toBe(2); // metal + gem
    const gem = mats.find((mm) => mm.getName().startsWith("gem_"));
    expect(gem).toBeTruthy();
    expect(gem!.getExtension("KHR_materials_transmission")).toBeTruthy();

    const t = attachOf(doc, "attach:primary")!.getTranslation();
    expect(t).toEqual([0, 0, 0]);
  });

  it("every shape builds a valid GLB with attach:primary", async () => {
    for (const def of PARAMETRIC_SHAPES) {
      const shape = def.shape as ParametricShape;
      const bytes = await buildParametricGlb({
        shape,
        materialColor: "titanium",
        params: {}, // rely on per-shape defaults
      });
      const doc = await read(bytes);
      expect(doc.getRoot().listMeshes().length, shape).toBe(1);
      expect(attachOf(doc, "attach:primary"), shape).not.toBeNull();
    }
  });

  it("rejects an unknown shape", async () => {
    await expect(
      buildParametricGlb({
        // @ts-expect-error — deliberately invalid
        shape: "not_a_shape",
        materialColor: "titanium",
        params: {},
      }),
    ).rejects.toThrow();
  });
});

describe("buildHybridGlb", () => {
  it("fuses an AI top onto a labret finding at the shaft top", async () => {
    // Stand-in "AI top": a small parametric hoop with its own attach node.
    const top = await buildParametricGlb({
      shape: "seamless_hoop",
      materialColor: "gold-585",
      params: { diameterMm: 8, gaugeMm: 1.2 },
    });

    const out = await buildHybridGlb(
      {
        shape: "labret_stud",
        materialColor: "titanium",
        params: { shaftLengthMm: 8, gaugeMm: 1.2, topSizeMm: 4 },
      },
      top,
    );
    const doc = await read(out);

    // Finding mesh + the merged top's mesh.
    expect(doc.getRoot().listMeshes().length).toBeGreaterThanOrEqual(2);

    // The AI top is parented under an `ai_top` transform node seated at the shaft
    // top (z ≈ 8 mm = 0.008 m).
    const aiTop = doc.getRoot().listNodes().find((n) => n.getName() === "ai_top");
    expect(aiTop).toBeTruthy();
    const tz = aiTop!.getTranslation()[2];
    expect(tz).toBeGreaterThan(0.007);
    expect(tz).toBeLessThan(0.009);

    // The finding keeps exactly one attach:primary at the body surface; the merged
    // top's own attach node was stripped.
    const attaches = doc
      .getRoot()
      .listNodes()
      .filter((n) => n.getName() === "attach:primary");
    expect(attaches.length).toBe(1);
    expect(attaches[0].getTranslation()).toEqual([0, 0, 0]);
  });

  it("rejects hybrid for a shape with no top mount (hoop)", async () => {
    const top = await buildParametricGlb({
      shape: "seamless_hoop",
      materialColor: "titanium",
      params: {},
    });
    await expect(
      buildHybridGlb(
        { shape: "seamless_hoop", materialColor: "titanium", params: {} },
        top,
      ),
    ).rejects.toThrow();
  });
});
