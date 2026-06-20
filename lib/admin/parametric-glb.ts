/**
 * Server-side parametric jewelry GLB builder — the self-serve path.
 *
 * The Blender pipeline (scripts/blender/jewelry/*) is the high-fidelity authoring
 * path but must be driven by hand inside Blender via MCP. This module re-implements
 * the same 6 shapes in pure TypeScript so the admin can generate a finding straight
 * from a form — no Blender, runs in a server action — using three.js geometry
 * generators (pure math, no WebGL/DOM) assembled into a GLB with @gltf-transform.
 *
 * It is FAITHFUL TO THE SAME CONVENTIONS as the Blender scripts (see
 * scripts/blender/jewelry/_jewelry_helpers.py and docs/14-jewelry-pipeline.md):
 *   • 1 unit = 1 metre; all inputs are millimetres, converted via m().
 *   • piece-local +Z = body-outward.
 *   • named `attach:*` empty nodes (Phase B multi-anchor convention).
 *   • metal = MATERIAL_COLORS (baseColor + metallic + roughness); gem = GEM_COLORS
 *     (transmission + ior + emissive) ported verbatim from _jewelry_helpers.py.
 *
 * Output is an UNCOMPRESSED GLB; the caller runs it through `optimizeGlb` (no
 * `normalize`) to meshopt-compress, exactly like a manual upload. The result is
 * `Jewelry.glbScale = 1.0` (real-metre scale), seating identically to the Blender
 * pieces. Server-only: imports three + @gltf-transform; dynamic-import from actions.
 *
 * Form descriptors + the public type unions live in the client-safe sibling
 * `lib/admin/parametric-shapes.ts` so the admin form never pulls these heavy
 * Node-only deps into the browser bundle.
 */

import { Document, NodeIO, type Scene } from "@gltf-transform/core";
import {
  KHRMaterialsEmissiveStrength,
  KHRMaterialsIOR,
  KHRMaterialsTransmission,
} from "@gltf-transform/extensions";
import { getBounds, mergeDocuments, unpartition } from "@gltf-transform/functions";
import {
  type BufferGeometry,
  CatmullRomCurve3,
  CubicBezierCurve3,
  CylinderGeometry,
  IcosahedronGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import type {
  GemColor,
  MaterialColor,
  ParametricShape,
} from "./parametric-shapes";

export type { GemColor, MaterialColor, ParametricShape };

// ── Material tables (ported from _jewelry_helpers.py) ───────────────────────────

/** (r, g, b, metallic, roughness). */
const MATERIAL_COLORS: Record<
  MaterialColor,
  [number, number, number, number, number]
> = {
  titanium: [0.92, 0.93, 0.95, 1.0, 0.18],
  "gold-585": [1.0, 0.78, 0.36, 1.0, 0.16],
  "rose-gold-585": [0.95, 0.7, 0.62, 1.0, 0.18],
  "black-pvd": [0.06, 0.06, 0.07, 1.0, 0.3],
};

/** (r, g, b, transmission, ior, emissiveStrength). */
const GEM_COLORS: Record<
  GemColor,
  [number, number, number, number, number, number]
> = {
  clear: [1.0, 1.0, 1.0, 0.85, 1.5, 0.0],
  pink: [1.0, 0.56, 0.77, 0.45, 1.5, 0.0],
  blue: [0.45, 0.77, 1.0, 0.45, 1.5, 0.0],
  "opal-white": [0.95, 0.93, 0.84, 0.0, 1.5, 0.08],
};

// ── Geometry helpers (millimetres in → metre geometry) ──────────────────────────

const m = (mm: number) => mm / 1000;

type MatKind = "metal" | "gem";
interface Part {
  geometry: BufferGeometry;
  material: MatKind;
}
interface AttachPoint {
  name: string;
  pos: [number, number, number];
}
interface ShapeBuild {
  parts: Part[];
  attach: AttachPoint[];
  /** Set when a gem material is needed (the gem color to use). */
  gem?: GemColor;
  /** Where a hybrid AI top is seated (metre coords), for post-type shapes only. */
  topMount?: [number, number, number];
}

/** UV sphere centred at `c` (metre coords). */
function sphere(radiusMm: number, c: [number, number, number]): BufferGeometry {
  const g = new SphereGeometry(m(radiusMm), 24, 16);
  g.translate(c[0], c[1], c[2]);
  return g;
}

/** Faceted icosphere (gem) centred at `c`. */
function gemGeom(radiusMm: number, c: [number, number, number]): BufferGeometry {
  const g = new IcosahedronGeometry(m(radiusMm), 2);
  g.translate(c[0], c[1], c[2]);
  return g;
}

/** Cylinder of `lengthMm` along the given axis, centred at `c`. three's cylinder
 *  is +Y-aligned; we rotate it onto +Z (rotateX 90°) or +X (rotateZ −90°). */
function cylinder(
  radiusMm: number,
  lengthMm: number,
  c: [number, number, number],
  axis: "z" | "x" = "z",
): BufferGeometry {
  const g = new CylinderGeometry(m(radiusMm), m(radiusMm), m(lengthMm), 24);
  if (axis === "z") g.rotateX(Math.PI / 2);
  else g.rotateZ(-Math.PI / 2);
  g.translate(c[0], c[1], c[2]);
  return g;
}

/** Torus in the XY plane (hole along +Z) — matches Blender's default torus. */
function torus(majorRMm: number, minorRMm: number): BufferGeometry {
  return new TorusGeometry(m(majorRMm), m(minorRMm), 12, 48);
}

/** A tube swept along a 3D curve sampled from `points` (metre coords). */
function tube(points: Vector3[], radiusMm: number): BufferGeometry {
  const curve = new CatmullRomCurve3(points, false, "centripetal");
  return new TubeGeometry(curve, Math.max(24, points.length), m(radiusMm), 8, false);
}

// ── Shapes (geometry + attach points mirror the Blender shape_*.py scripts) ──────

type Params = Record<string, number | string | undefined>;
const num = (p: Params, k: string, d: number) =>
  p[k] != null && Number.isFinite(Number(p[k])) ? Number(p[k]) : d;
const str = (p: Params, k: string, d: string) =>
  typeof p[k] === "string" && p[k] ? (p[k] as string) : d;

function buildSeamlessHoop(p: Params): ShapeBuild {
  const diameter = num(p, "diameterMm", 8);
  const gauge = num(p, "gaugeMm", 1.2);
  const majorR = (diameter - gauge) / 2;
  return {
    parts: [{ geometry: torus(majorR, gauge / 2), material: "metal" }],
    // Top of the band (+Y), where a hoop crosses the piercing.
    attach: [{ name: "attach:primary", pos: [0, m(majorR), 0] }],
  };
}

function buildStraightBarbell(p: Params): ShapeBuild {
  const len = num(p, "shaftLengthMm", 14);
  const gauge = num(p, "gaugeMm", 1.6);
  const ball = num(p, "ballSizeMm", Math.max(2.5, gauge * 1.8));
  return {
    parts: [
      { geometry: sphere(ball / 2, [0, 0, 0]), material: "metal" },
      { geometry: cylinder(gauge / 2, len, [0, 0, m(len) / 2]), material: "metal" },
      { geometry: sphere(ball / 2, [0, 0, m(len)]), material: "metal" },
    ],
    attach: [
      { name: "attach:primary", pos: [0, 0, 0] },
      { name: "attach:secondary", pos: [0, 0, m(len)] },
    ],
  };
}

function buildCurvedBarbell(p: Params): ShapeBuild {
  const len = num(p, "shaftLengthMm", 10);
  const gauge = num(p, "gaugeMm", 1.6);
  const ball = num(p, "ballSizeMm", Math.max(2.5, gauge * 1.8));
  const bow = num(p, "bowDepthMm", 1.5);
  const L = m(len);
  const D = m(bow) * 1.2;
  // Cubic Bézier matching the Blender handles (bow lifts toward +Y).
  const curve = new CubicBezierCurve3(
    new Vector3(0, 0, 0),
    new Vector3(0, D, L * 0.33),
    new Vector3(0, D, L * 0.66),
    new Vector3(0, 0, L),
  );
  const shaft = new TubeGeometry(curve, 48, m(gauge / 2), 8, false);
  return {
    parts: [
      { geometry: shaft, material: "metal" },
      { geometry: sphere(ball / 2, [0, 0, 0]), material: "metal" },
      { geometry: sphere(ball / 2, [0, 0, L]), material: "metal" },
    ],
    attach: [
      { name: "attach:primary", pos: [0, 0, 0] },
      { name: "attach:secondary", pos: [0, 0, L] },
    ],
  };
}

function buildHorseshoe(p: Params): ShapeBuild {
  const diameter = num(p, "diameterMm", 10);
  const gauge = num(p, "gaugeMm", 1.6);
  const ball = num(p, "ballSizeMm", Math.max(2.5, gauge * 1.6));
  const gapDeg = num(p, "gapDegrees", 90);
  const radius = (diameter - gauge) / 2;
  const R = m(radius);
  const halfGap = (gapDeg / 2) * (Math.PI / 180);
  const start = Math.PI / 2 + halfGap;
  const end = Math.PI / 2 - halfGap + 2 * Math.PI;
  const n = 48;
  const pts: Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = start + (end - start) * (i / (n - 1));
    pts.push(new Vector3(R * Math.cos(a), R * Math.sin(a), 0));
  }
  const leftTip: [number, number, number] = [
    R * Math.cos(start),
    R * Math.sin(start),
    0,
  ];
  const rightTip: [number, number, number] = [
    R * Math.cos(Math.PI / 2 - halfGap),
    R * Math.sin(Math.PI / 2 - halfGap),
    0,
  ];
  return {
    parts: [
      { geometry: tube(pts, gauge / 2), material: "metal" },
      { geometry: sphere(ball / 2, leftTip), material: "metal" },
      { geometry: sphere(ball / 2, rightTip), material: "metal" },
    ],
    attach: [
      { name: "attach:primary", pos: [0, 0, 0] }, // ring centre (RING usage)
      { name: "attach:secondary", pos: leftTip }, // ball tips (CIRCULAR_BARBELL)
      { name: "attach:tertiary", pos: rightTip },
    ],
  };
}

function buildLabretStud(p: Params): ShapeBuild {
  const len = num(p, "shaftLengthMm", 8);
  const gauge = num(p, "gaugeMm", 1.2);
  const disc = num(p, "discDiameterMm", Math.max(3, gauge * 2.5));
  const topShape = str(p, "topShape", "ball");
  const topSize = num(p, "topSizeMm", Math.max(2.5, gauge * 2.2));
  const DISC_T = 0.6;
  const TOP_DISC_T = 0.5;

  const parts: Part[] = [
    { geometry: cylinder(disc / 2, DISC_T, [0, 0, -m(DISC_T) / 2]), material: "metal" },
    { geometry: cylinder(gauge / 2, len, [0, 0, m(len) / 2]), material: "metal" },
  ];
  let gem: GemColor | undefined;
  if (topShape === "ball") {
    parts.push({
      geometry: sphere(topSize / 2, [0, 0, m(len) + m(topSize) / 2]),
      material: "metal",
    });
  } else if (topShape === "disc") {
    parts.push({
      geometry: cylinder(topSize / 2, TOP_DISC_T, [0, 0, m(len) + m(TOP_DISC_T) / 2]),
      material: "metal",
    });
  } else if (topShape === "gem") {
    gem = str(p, "topGemColor", "clear") as GemColor;
    parts.push({
      geometry: gemGeom(topSize / 2, [0, 0, m(len) + m(topSize) / 2]),
      material: "gem",
    });
  } else if (topShape !== "none") {
    throw new Error(`labret_stud: unknown topShape '${topShape}'`);
  }
  return {
    parts,
    attach: [{ name: "attach:primary", pos: [0, 0, 0] }],
    gem,
    topMount: [0, 0, m(len)], // top of the shaft — where a hybrid AI top sits
  };
}

function buildNoseStudL(p: Params): ShapeBuild {
  const visible = num(p, "visibleLengthMm", 3.5);
  const inside = num(p, "insideLengthMm", 5.5);
  const gauge = num(p, "gaugeMm", 1.0);
  const topShape = str(p, "topShape", "ball");
  const topSize = num(p, "topSizeMm", Math.max(2.0, gauge * 2.2));
  const r = gauge / 2;

  const parts: Part[] = [
    { geometry: cylinder(r, visible, [0, 0, m(visible) / 2]), material: "metal" },
    { geometry: cylinder(r, inside, [m(inside) / 2, 0, 0], "x"), material: "metal" },
    { geometry: sphere(r * 1.05, [0, 0, 0]), material: "metal" }, // elbow
    { geometry: sphere(r * 1.05, [m(inside), 0, 0]), material: "metal" }, // tail
  ];
  const topZ = m(visible) + m(topSize) / 2;
  let gem: GemColor | undefined;
  if (topShape === "ball") {
    parts.push({ geometry: sphere(topSize / 2, [0, 0, topZ]), material: "metal" });
  } else if (topShape === "gem") {
    gem = str(p, "topGemColor", "clear") as GemColor;
    parts.push({ geometry: gemGeom(topSize / 2, [0, 0, topZ]), material: "gem" });
  } else if (topShape !== "none") {
    throw new Error(`nose_stud_l: unknown topShape '${topShape}'`);
  }
  return {
    parts,
    attach: [{ name: "attach:primary", pos: [0, 0, 0] }],
    gem,
    topMount: [0, 0, m(visible)],
  };
}

const BUILDERS: Record<ParametricShape, (p: Params) => ShapeBuild> = {
  seamless_hoop: buildSeamlessHoop,
  straight_barbell: buildStraightBarbell,
  curved_barbell: buildCurvedBarbell,
  horseshoe: buildHorseshoe,
  labret_stud: buildLabretStud,
  nose_stud_l: buildNoseStudL,
};

// ── GLB assembly ────────────────────────────────────────────────────────────────

export interface ParametricInput {
  shape: ParametricShape;
  materialColor: MaterialColor;
  params: Params;
}

/** Assemble the gltf-transform Document for a parametric piece (no I/O). Throws on
 *  an unknown shape or invalid params. */
function assembleDocument(input: ParametricInput): {
  doc: Document;
  build: ShapeBuild;
} {
  const builder = BUILDERS[input.shape];
  if (!builder) throw new Error(`Unknown parametric shape: ${input.shape}`);
  if (!MATERIAL_COLORS[input.materialColor]) {
    throw new Error(`Unknown materialColor: ${input.materialColor}`);
  }
  const built = builder(input.params);

  const doc = new Document();
  const buffer = doc.createBuffer();

  // Metal material.
  const [mr, mg, mb, metallic, roughness] = MATERIAL_COLORS[input.materialColor];
  const metalMat = doc
    .createMaterial(`metal_${input.materialColor}`)
    .setBaseColorFactor([mr, mg, mb, 1])
    .setMetallicFactor(metallic)
    .setRoughnessFactor(roughness);

  // Gem material (only when a part needs it) + its glTF extensions.
  let gemMat: ReturnType<Document["createMaterial"]> | null = null;
  if (built.gem) {
    if (!GEM_COLORS[built.gem]) throw new Error(`Unknown gem color: ${built.gem}`);
    const [gr, gg, gb, transmission, ior, emissive] = GEM_COLORS[built.gem];
    gemMat = doc
      .createMaterial(`gem_${built.gem}`)
      .setBaseColorFactor([gr, gg, gb, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.05);
    const iorExt = doc.createExtension(KHRMaterialsIOR);
    gemMat.setExtension("KHR_materials_ior", iorExt.createIOR().setIOR(ior));
    if (transmission > 0) {
      const trExt = doc.createExtension(KHRMaterialsTransmission);
      gemMat.setExtension(
        "KHR_materials_transmission",
        trExt.createTransmission().setTransmissionFactor(transmission),
      );
    }
    if (emissive > 0) {
      gemMat.setEmissiveFactor([gr, gg, gb]);
      const emExt = doc.createExtension(KHRMaterialsEmissiveStrength);
      gemMat.setExtension(
        "KHR_materials_emissive_strength",
        emExt.createEmissiveStrength().setEmissiveStrength(emissive),
      );
    }
  }

  const mesh = doc.createMesh(input.shape);
  for (const part of built.parts) {
    let geom = part.geometry;
    if (!geom.getAttribute("normal")) geom.computeVertexNormals();
    if (!geom.index) geom = geom.toNonIndexed();
    const posArr = new Float32Array(geom.getAttribute("position").array);
    const norArr = new Float32Array(geom.getAttribute("normal").array);
    const idxSrc = geom.index?.array ?? null;

    const pos = doc.createAccessor().setType("VEC3").setArray(posArr).setBuffer(buffer);
    const nor = doc.createAccessor().setType("VEC3").setArray(norArr).setBuffer(buffer);
    const prim = doc
      .createPrimitive()
      .setAttribute("POSITION", pos)
      .setAttribute("NORMAL", nor)
      .setMaterial(part.material === "gem" && gemMat ? gemMat : metalMat);
    if (idxSrc) {
      const idx = doc
        .createAccessor()
        .setType("SCALAR")
        .setArray(new Uint32Array(idxSrc))
        .setBuffer(buffer);
      prim.setIndices(idx);
    }
    mesh.addPrimitive(prim);
    disposeGeometry(part.geometry);
  }

  const scene = doc.createScene().addChild(doc.createNode(input.shape).setMesh(mesh));
  doc.getRoot().setDefaultScene(scene);
  for (const a of built.attach) {
    scene.addChild(doc.createNode(a.name).setTranslation(a.pos));
  }

  return { doc, build: built };
}

const HYBRID_EXTENSIONS = [
  KHRMaterialsIOR,
  KHRMaterialsTransmission,
  KHRMaterialsEmissiveStrength,
];

/** Build an (uncompressed) GLB for a parametric piece. The caller should pipe the
 *  bytes through `optimizeGlb` (no `normalize`) for meshopt compression. */
export async function buildParametricGlb(
  input: ParametricInput,
): Promise<Uint8Array> {
  const { doc } = assembleDocument(input);
  const io = new NodeIO().registerExtensions(HYBRID_EXTENSIONS);
  return io.writeBinary(doc);
}

/**
 * Fuse an AI-generated decorative top onto an exact-scale parametric finding into
 * one GLB (the research's recommended hybrid). The finding (a post-type shape with
 * topShape forced to "none") guarantees mm-scale + the attach axis; the AI top is
 * scaled to `topSizeMm` (largest dimension) and seated base-down at the finding's
 * top mount, then merged in via `mergeDocuments` (materials/textures/extensions come
 * along). Only labret_stud / nose_stud_l expose a top mount. The AI top is assumed
 * roughly +Z-up; if it lands tilted, the admin's orientation nudge fixes it.
 */
export async function buildHybridGlb(
  input: ParametricInput,
  topGlbBytes: Uint8Array | ArrayBuffer,
): Promise<Uint8Array> {
  const findingInput: ParametricInput = {
    ...input,
    params: { ...input.params, topShape: "none" },
  };
  const { doc, build } = assembleDocument(findingInput);
  if (!build.topMount) {
    throw new Error(`Форма ${input.shape} не поддерживает ИИ-верх.`);
  }

  const io = new NodeIO().registerExtensions(HYBRID_EXTENSIONS);
  const src =
    topGlbBytes instanceof Uint8Array ? topGlbBytes : new Uint8Array(topGlbBytes);
  const topDoc = await io.readBinary(src);
  const topScene =
    topDoc.getRoot().getDefaultScene() ?? topDoc.getRoot().listScenes()[0];
  if (!topScene) throw new Error("В модели ИИ-верха нет сцены.");

  // Scale the top to topSizeMm (largest dimension) and seat its base at the mount.
  const b = getBounds(topScene);
  const maxDim = Math.max(
    b.max[0] - b.min[0],
    b.max[1] - b.min[1],
    b.max[2] - b.min[2],
    1e-6,
  );
  const topSize = num(input.params, "topSizeMm", 3);
  const scale = m(topSize) / maxDim;
  const cx = (b.min[0] + b.max[0]) / 2;
  const cy = (b.min[1] + b.max[1]) / 2;
  const [mx, my, mz] = build.topMount;
  const translation: [number, number, number] = [
    mx - scale * cx,
    my - scale * cy,
    mz - scale * b.min[2], // base (min Z) sits at the mount
  ];

  // Merge the top's graph into the finding doc, re-parent under a transform node.
  const map = mergeDocuments(doc, topDoc);
  const mergedScene = map.get(topScene) as Scene | undefined;
  if (!mergedScene) throw new Error("Не удалось объединить модели.");
  const wrap = doc
    .createNode("ai_top")
    .setScale([scale, scale, scale])
    .setTranslation(translation);
  for (const child of mergedScene.listChildren()) {
    if (child.getName().startsWith("attach:")) {
      child.dispose(); // drop the top's own attach nodes — the finding owns attach
      continue;
    }
    wrap.addChild(child);
  }
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  scene.addChild(wrap);
  mergedScene.dispose();

  await doc.transform(unpartition());
  return io.writeBinary(doc);
}

function disposeGeometry(g: BufferGeometry): void {
  try {
    g.dispose();
  } catch {
    /* dispose is best-effort; the GC handles the typed arrays anyway. */
  }
}
