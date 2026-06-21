/**
 * Server-side GLB optimization pass.
 *
 * AI providers (Tripo3D / Replicate) and many hand-authored exports hand back a
 * raw, dense, fully-textured `.glb` — often several MB of high-poly geometry +
 * 1–2K PBR maps. We re-host every model on Vercel Blob anyway (see
 * `lib/admin/jewelry-generation-actions.ts` + `app/api/cron/poll-jobs`), so this
 * is the natural choke point to shrink it once, on the way in, instead of
 * shipping the bloat to every catalog visitor forever.
 *
 * The pipeline (gltf-transform):
 *   dedup → flatten → join → weld → [simplify if very dense] → prune →
 *   textureCompress (→ WebP, ≤1024px) → meshopt (EXT_meshopt_compression)
 *
 * Quality is deliberately preserved: meshopt quantization is relative to the
 * model's AABB (sub-micron at jewelry scale), simplification is gated behind a
 * high triangle threshold AND a tight error bound, and textures only ever
 * downscale. Typical result is a 70–95% smaller file with no visible change.
 *
 * The runtime loader (drei `useGLTF`) enables the Meshopt decoder by default and
 * three's `GLTFLoader` handles `EXT_texture_webp` natively, so NOTHING on the
 * read side (catalog render, admin preview, stats) needs to change — meshopt +
 * WebP load out of the box. The JSON-accessor scale probe in `glb-scale-fast.ts`
 * also still works because accessor min/max survive meshopt compression.
 *
 * This module is server-only: it pulls in `sharp` (native) + the meshopt WASM.
 * Import it dynamically from server actions / route handlers so those modules
 * stay lean and it never reaches a client bundle.
 */

import { NodeIO, type Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  flatten,
  getBounds,
  join,
  meshopt,
  prune,
  simplify,
  textureCompress,
  transformMesh,
  weld,
} from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { Matrix4, Quaternion, Vector3 } from "three";
import {
  normalizeStudDocument,
  normalizeRingDocument,
  normalizeBarbellDocument,
  measureRingBandFromDoc,
  collectMeshVertices,
  bakeRoll,
  bakeHeadFlip,
} from "./glb-normalize";
import type { QualityVerdict } from "./glb-quality-vision";

// ── Tuning ───────────────────────────────────────────────────────────────────
// Only simplify (lossy triangle reduction) when a mesh is genuinely dense; most
// of the size win comes from meshopt + texture re-encode, so we keep this rare
// and conservative to protect the look of detailed pieces.
const SIMPLIFY_TRIANGLE_THRESHOLD = 80_000;
const SIMPLIFY_TARGET_RATIO = 0.5; // aim for ~50% of triangles…
const SIMPLIFY_MAX_ERROR = 0.0005; // …but never exceed 0.05% of the AABB.
// Max texture edge (px). Jewelry renders small on the body model; 1024 is
// already generous. Textures smaller than this are left untouched.
const MAX_TEXTURE_EDGE = 1024;

export interface OptimizeOptions {
  /**
   * When set for a single-anchor STUD or RING, auto-orient the model into the
   * canonical pose (+Z out), inject `attach:primary`, and suggest a scale from
   * gauge/size. See lib/admin/glb-normalize.ts. Other types are left untouched.
   */
  normalize?: {
    type?: string | null;
    gauge?: number | null;
    size?: number | null;
    /**
     * Product photo URL. When set (and GEMINI_API_KEY is configured), enables the
     * AI roll tiebreaker for asymmetric studs and hoops — see lib/admin/glb-roll-vision.ts.
     */
    photoUrl?: string | null;
  };
}

export interface PlacementResult {
  /** True when auto-placement was applied (orientation baked + attach injected). */
  applied: boolean;
  /** 0..1 — low values should be routed to the admin's verify step. */
  confidence: number;
  /** Suggested `Jewelry.glbScale`, or null when gauge/size were unavailable. */
  suggestedScale: number | null;
  /** Diagnostic (e.g. "elong 2.8, head/post 2.1"). */
  note: string;
}

export interface OptimizeResult {
  /** Optimized GLB bytes — or the original bytes if optimization was skipped. */
  bytes: Uint8Array;
  /** Input size in bytes. */
  before: number;
  /** Output size in bytes (== before when not optimized). */
  after: number;
  /** True when we produced a smaller file; false when we fell back to input. */
  optimized: boolean;
  /** Diagnostic for logs / admin messaging. */
  note?: string;
  /** Present when `normalize` was requested for a STUD. */
  placement?: PlacementResult;
  /**
   * Vision quality verdict for AI output — present only when `normalize.photoUrl`
   * was supplied (i.e. the auto-generation path; manual upload skips it). The
   * caller decides accept vs auto-retry; see lib/admin/glb-quality-vision.ts.
   */
  quality?: QualityVerdict;
}

// NodeIO is reusable across calls; building it requires the meshopt WASM to be
// ready. Memoize the whole thing so concurrent jobs share one initialization.
let ioPromise: Promise<NodeIO> | null = null;
function getIO(): Promise<NodeIO> {
  if (!ioPromise) {
    ioPromise = (async () => {
      await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
      return new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({
          "meshopt.decoder": MeshoptDecoder,
          "meshopt.encoder": MeshoptEncoder,
        });
    })();
  }
  return ioPromise;
}

function countTriangles(doc: Document): number {
  let tris = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      const position = prim.getAttribute("POSITION");
      if (indices) tris += indices.getCount() / 3;
      else if (position) tris += position.getCount() / 3;
    }
  }
  return Math.round(tris);
}

/**
 * Optimize a GLB. Never throws: on any failure (malformed model, unsupported
 * texture, …) it returns the original bytes with `optimized: false` and a note,
 * so the re-host / upload pipeline degrades gracefully instead of breaking.
 */
export async function optimizeGlb(
  input: ArrayBuffer | Uint8Array,
  opts: OptimizeOptions = {},
): Promise<OptimizeResult> {
  const src = input instanceof Uint8Array ? input : new Uint8Array(input);
  const before = src.byteLength;

  try {
    const io = await getIO();
    const doc = await io.readBinary(src);

    // Auto-placement (STUD only): bake the canonical orientation into the geometry
    // BEFORE compression. The attach:primary node is injected AFTER compression —
    // prune() would delete a mesh-less leaf node mid-pass.
    let placement: PlacementResult | undefined;
    let attachLocal: [number, number, number] | undefined;
    let attachSecondary: [number, number, number] | undefined;
    if (opts.normalize?.type === "STUD") {
      const r = normalizeStudDocument(doc, {
        gauge: opts.normalize.gauge,
        size: opts.normalize.size,
      });
      placement = {
        applied: r.ok,
        confidence: r.confidence,
        suggestedScale: r.suggestedScale,
        note: r.note,
      };
      if (r.ok) {
        attachLocal = r.attachLocal;
        // AI tiebreakers — both need a photo to compare against and GEMINI_API_KEY;
        // each no-ops gracefully (keeping the geometric pose) when unavailable.
        if (opts.normalize.photoUrl) {
          const { chooseHeadDirection, chooseRoll } = await import(
            "./glb-roll-vision"
          );
          const photoUrl = opts.normalize.photoUrl;
          // Gather vertices once; only re-gather if the head flip mutates geometry.
          let verts = collectMeshVertices(doc);

          // 1) Head direction (gem out vs in) — fixes a geometric flip. Runs for
          // every stud, since even a round-gem one can be detected backwards.
          const head = await chooseHeadDirection({ vertices: verts, photoUrl });
          if (head.flip && attachLocal) {
            bakeHeadFlip(doc);
            attachLocal = [attachLocal[0], -attachLocal[1], -attachLocal[2]];
            verts = collectMeshVertices(doc); // geometry changed → re-gather for roll
          }

          // 2) Roll about +Z — only meaningful for an asymmetric face. Measured
          // on the (possibly head-flipped) geometry, via the two-pass search.
          let rollNote = "roll: skipped";
          let rollOk = false;
          if (r.rollAmbiguous) {
            const choice = await chooseRoll({ vertices: verts, photoUrl, kind: "stud" });
            if (choice.ok) {
              bakeRoll(doc, choice.angleRad);
              rollOk = true;
            }
            rollNote = `roll: ${choice.note}`;
          }

          // The photo VERIFIED the orientation (a confident head decision and/or a
          // roll pick), so raise confidence above the geometry-only score.
          const aiVerified = head.ok || rollOk;
          placement = {
            ...placement,
            confidence: aiVerified
              ? Math.max(placement.confidence, 0.85)
              : placement.confidence,
            note: `${r.note}; head: ${head.note}; ${rollNote}`,
          };
        }
      }
    } else if (opts.normalize?.type === "RING") {
      const r = normalizeRingDocument(doc, {
        gauge: opts.normalize.gauge,
        size: opts.normalize.size,
      });
      placement = {
        applied: r.ok,
        confidence: r.confidence,
        suggestedScale: r.suggestedScale,
        note: r.note,
      };
      if (r.ok) {
        attachLocal = r.attachLocal; // [0, bandRadius, 0] — top of the band.
        // Roll tiebreaker — only for an ASYMMETRIC hoop (charm/gem/gap), where which
        // band point meets the skin is semantic. We bake the photo-matched roll into
        // the geometry; attach:primary stays the fixed +Y top marker, so it ends up on
        // whatever band point rotated to the top. No-ops (keeps the geometric baseline)
        // when GEMINI_API_KEY / the photo is unavailable.
        if (opts.normalize.photoUrl && r.rollAmbiguous) {
          const { chooseRoll } = await import("./glb-roll-vision");
          const choice = await chooseRoll({
            vertices: collectMeshVertices(doc),
            photoUrl: opts.normalize.photoUrl,
            kind: "ring", // mount-aware instruction (hinge/opening/narrowing → top)
          });
          if (choice.ok) bakeRoll(doc, choice.angleRad);
          placement = {
            ...placement,
            confidence: choice.ok
              ? Math.max(placement.confidence, 0.85)
              : placement.confidence,
            note: `${r.note}; roll: ${choice.note}`,
          };
        }
      }
    } else if (opts.normalize?.type === "BARBELL") {
      // Straight/curved bar: recover the two ball ends as attach:primary/secondary.
      // No reorientation or glbScale — the multi-anchor renderer derives scale from
      // the two-anchor span (placeMultiAnchor in lib/catalog/place-jewelry.ts).
      const r = normalizeBarbellDocument(doc);
      placement = {
        applied: r.ok,
        confidence: r.confidence,
        suggestedScale: r.suggestedScale,
        note: r.note,
      };
      if (r.ok && r.attachLocals && r.attachLocals.length >= 2) {
        attachLocal = r.attachLocals[0];
        attachSecondary = r.attachLocals[1];
      }
    }

    // Capture the FINAL oriented vertices for the quality gate NOW, before the
    // compression transforms (weld/simplify/meshopt) quantize positions. Only when
    // a reference photo is available to compare against — i.e. the AI path; manual
    // upload passes no `normalize`, so it skips the gate entirely.
    const qualityVerts = opts.normalize?.photoUrl
      ? collectMeshVertices(doc)
      : null;

    const triangles = countTriangles(doc);

    const transforms = [dedup(), flatten(), join(), weld()];
    if (triangles > SIMPLIFY_TRIANGLE_THRESHOLD) {
      transforms.push(
        simplify({
          simplifier: MeshoptSimplifier,
          ratio: SIMPLIFY_TARGET_RATIO,
          error: SIMPLIFY_MAX_ERROR,
        }),
      );
    }
    transforms.push(
      prune(),
      textureCompress({
        encoder: sharp,
        targetFormat: "webp",
        resize: [MAX_TEXTURE_EDGE, MAX_TEXTURE_EDGE],
      }),
      meshopt({ encoder: MeshoptEncoder, level: "medium" }),
    );

    await doc.transform(...transforms);

    // Inject attach:* now that prune() has run, so they survive to the file
    // (prune() would delete a mesh-less leaf node mid-pass).
    if (attachLocal) {
      const scene =
        doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
      scene?.addChild(
        doc.createNode("attach:primary").setTranslation(attachLocal),
      );
      // BARBELL: the second ball end → attach:secondary (multi-anchor renderer).
      if (attachSecondary) {
        scene?.addChild(
          doc.createNode("attach:secondary").setTranslation(attachSecondary),
        );
      }
    }

    // Quality gate: render the final oriented mesh from several angles and ask the
    // vision judge whether it's a faithful, clean reconstruction of the photo.
    // Best-effort — a missing key / dead judge returns ok:false and never blocks.
    let quality: QualityVerdict | undefined;
    if (qualityVerts && opts.normalize?.photoUrl) {
      const { assessQuality } = await import("./glb-quality-vision");
      quality = await assessQuality({
        vertices: qualityVerts,
        photoUrl: opts.normalize.photoUrl,
        type: opts.normalize.type,
      });
    }

    const out = await io.writeBinary(doc);
    const after = out.byteLength;

    // If the pass somehow didn't help (already-optimized input), keep the
    // original so we never store a larger file than we received. (When we baked
    // placement into the geometry we must keep the new bytes regardless — the
    // original lacks the orientation + attach:primary the renderer needs.)
    if (after >= before && !attachLocal) {
      return {
        bytes: src,
        before,
        after: before,
        optimized: false,
        note: "no size gain",
        placement,
        quality,
      };
    }
    return {
      bytes: out,
      before,
      after,
      optimized: after < before,
      placement,
      quality,
    };
  } catch (err) {
    return {
      bytes: src,
      before,
      after: before,
      optimized: false,
      note: err instanceof Error ? err.message : "optimize failed",
    };
  }
}

/** Human-readable "4.2 МБ → 480 КБ (−89%)" for admin messages. */
export function formatOptimizeDelta(
  r: Pick<OptimizeResult, "before" | "after" | "optimized">,
): string {
  const kb = (n: number) =>
    n < 1024 * 1024
      ? `${Math.round(n / 1024)} КБ`
      : `${(n / 1024 / 1024).toFixed(1)} МБ`;
  if (!r.optimized) return kb(r.before);
  const pct = Math.round((1 - r.after / r.before) * 100);
  return `${kb(r.before)} → ${kb(r.after)} (−${pct}%)`;
}

/**
 * Measure a GLB's real-world bounding-box size (meters), via gltf-transform
 * `getBounds`, which applies node transforms — crucially the dequantization scale
 * that `KHR_mesh_quantization` puts on the node. A naive read of accessor min/max
 * would return QUANTIZED integers (≈65535) for our compressed models and report a
 * nonsense multi-kilometer size. Returns null on failure.
 */
export async function measureGlbSizeM(
  input: ArrayBuffer | Uint8Array,
): Promise<{ x: number; y: number; z: number } | null> {
  try {
    const src = input instanceof Uint8Array ? input : new Uint8Array(input);
    const io = await getIO();
    const doc = await io.readBinary(src);
    const scene =
      doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
    if (!scene) return null;
    const b = getBounds(scene);
    const size = {
      x: b.max[0] - b.min[0],
      y: b.max[1] - b.min[1],
      z: b.max[2] - b.min[2],
    };
    if (size.x <= 0 && size.y <= 0 && size.z <= 0) return null;
    return size;
  } catch {
    return null;
  }
}

/**
 * Measure a RING's band (outer + tube diameter, meters), EXCLUDING any pendant/charm,
 * by fitting the load-bearing circle — the scale-correct dimension for a hoop, where
 * the whole-bbox max axis would be the pendant-inflated height. Returns null when no
 * band can be isolated (caller falls back to `measureGlbSizeM`). See
 * lib/admin/glb-normalize.ts `measureRingBandFromDoc`.
 */
export async function measureRingBandM(
  input: ArrayBuffer | Uint8Array,
): Promise<{ outerDiameterM: number; tubeDiameterM: number } | null> {
  try {
    const src = input instanceof Uint8Array ? input : new Uint8Array(input);
    const io = await getIO();
    const doc = await io.readBinary(src);
    return measureRingBandFromDoc(doc);
  } catch {
    return null;
  }
}

// ── Manual orientation nudge ────────────────────────────────────────────────

/** A full orientation quaternion [x, y, z, w] — general enough for the arbitrary
 *  angles image-to-3D providers emit (the model can arrive rotated by any amount,
 *  not just multiples of 90°). */
export type NudgeQuat = [number, number, number, number];

/**
 * Bake an arbitrary orientation correction into an already-placed GLB and return
 * the new bytes — the admin's manual fallback when auto-placement gets the pose
 * wrong (or no Gemini key is set). `quat` is the EXACT orientation the admin set
 * by dragging/rolling the model in the preview, so what they see before "Save"
 * is what gets baked. Both the geometry and the `attach:*` nodes are rotated by
 * the same matrix so they stay consistent. Geometry is re-compressed with
 * meshopt; WebP textures pass through untouched (no re-encode → no degradation).
 */
export async function nudgeGlbOrientation(
  input: ArrayBuffer | Uint8Array,
  quat: NudgeQuat,
): Promise<Uint8Array> {
  const src = input instanceof Uint8Array ? input : new Uint8Array(input);
  const io = await getIO();
  const doc = await io.readBinary(src);

  const q = new Quaternion(quat[0], quat[1], quat[2], quat[3]).normalize();
  const M = new Matrix4().makeRotationFromQuaternion(q);
  const m = [...M.elements] as unknown as Parameters<typeof transformMesh>[1];

  for (const mesh of doc.getRoot().listMeshes()) transformMesh(mesh, m);
  for (const node of doc.getRoot().listNodes()) {
    if (!node.getName().startsWith("attach:")) continue;
    const t = node.getTranslation();
    const v = new Vector3(t[0], t[1], t[2]).applyMatrix4(M);
    node.setTranslation([v.x, v.y, v.z]);
  }

  // Re-compress geometry only; textures (already WebP) ride through unchanged.
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  return io.writeBinary(doc);
}

/**
 * Set `attach:primary` to an exact local point and return the new GLB bytes — the
 * admin's manual point-picker fallback when auto-placement (geometry / AI) puts the
 * attach point in the wrong spot. `point` is in the model's LOCAL frame (the same
 * frame `readAttachLocals` reads on the client). `name` is the attach node to set
 * (`attach:primary` by default, or `attach:secondary` for a 2-anchor bar's other
 * end). Finds the existing node (gltf-transform preserves names, so match by
 * `getName()`) or creates one at the scene root, sets its translation, and
 * re-compresses geometry with meshopt; textures (already WebP) ride through
 * untouched. Never the full optimize pass — the model is already optimized.
 */
export async function setGlbAttachPoint(
  input: ArrayBuffer | Uint8Array,
  point: [number, number, number],
  name: string = "attach:primary",
): Promise<Uint8Array> {
  const src = input instanceof Uint8Array ? input : new Uint8Array(input);
  const io = await getIO();
  const doc = await io.readBinary(src);
  const root = doc.getRoot();

  let node = root.listNodes().find((n) => n.getName() === name) ?? null;
  if (!node) {
    node = doc.createNode(name);
    const scene = root.getDefaultScene() ?? root.listScenes()[0];
    scene?.addChild(node);
  }
  node.setTranslation(point);

  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  return io.writeBinary(doc);
}
