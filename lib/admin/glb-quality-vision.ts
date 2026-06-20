/**
 * AI quality gate for auto-generated jewelry meshes.
 *
 * The orientation tiebreaker (lib/admin/glb-roll-vision.ts) answers "which way is
 * up"; it does NOT answer "is this mesh any good". Image-to-3D providers regularly
 * hand back blobby/melted lumps, a stud missing its gem, a hoop with a broken band,
 * or floating fragments — and those would silently reach the admin's PENDING_REVIEW
 * queue (or worse, the catalog) today.
 *
 * This module closes that gap with the research-validated GPTEval3D pattern: render
 * the generated model from a few orthographic angles, hand those renders + the
 * reference product photo to a vision model, and ask for a structured accept/reject
 * verdict. A single defect is often invisible head-on but obvious from the side, so
 * we render MULTIPLE views, not one.
 *
 * Rendering reuses the same dependency-free orthographic depth-splat as the roll
 * tiebreaker (no headless WebGL → runs on serverless). The judge is Gemini Flash on
 * the free tier via plain REST with structured JSON output (responseSchema). Like the
 * roll module, everything degrades gracefully: a missing GEMINI_API_KEY, a fetch
 * failure, or an unparseable answer all return `{ ok: false, acceptable: true }`, so a
 * dead judge NEVER blocks a generation — it just doesn't gate it.
 *
 * Privacy note: the Gemini FREE tier may use submitted images to improve Google's
 * products. Reference jewelry photos are low-sensitivity product shots, so this is
 * acceptable; switch to the paid tier (fractions of a cent per verdict) to opt out.
 * See .env.example / docs/23.
 */

import sharp from "sharp";
import { Quaternion, Vector3 } from "three";
import { fetchPhotoBase64, type PhotoData } from "./glb-roll-vision";

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";
const IMG = 320; // render edge (px)
const VIEW_LABELS = ["V1 (front)", "V2 (side)", "V3 (top)", "V4 (3/4)"];

// Below this score a not-acceptable verdict is treated as a CONFIDENT reject and
// auto-retries the next provider; 45–100 (or acceptable=true) lands in review so a
// borderline-but-salvageable mesh is never thrown away or looped on.
const REJECT_SCORE = 45;

export interface QualityVerdict {
  /** True only when a usable verdict came back. False → caller must NOT gate on it. */
  ok: boolean;
  /** Model's accept/reject. Defaults to `true` on any failure so we never block. */
  acceptable: boolean;
  /** 0..100, 100 = excellent reconstruction. */
  score: number;
  /** Concrete defects the model called out (≤8), for the admin message. */
  issues: string[];
  /** One-line rationale. */
  reason: string;
  /** Diagnostic for logs. */
  note: string;
}

/** A confident reject — the only case we auto-retry the chain on. Borderline
 *  verdicts (acceptable, or score ≥ REJECT_SCORE) go to review instead. */
export function qualityRejected(v: QualityVerdict | undefined): boolean {
  return Boolean(v && v.ok && !v.acceptable && v.score < REJECT_SCORE);
}

// ── Multi-view renderer ────────────────────────────────────────────────────────
// Each view rotates the model so a different face points at the camera, then splats
// orthographically down +Z with a z-buffer + depth shading (same technique as the
// roll renderer). Bounds are per-view so each render fills the frame.

function viewQuats(): Quaternion[] {
  const axis = (x: number, y: number, z: number, deg: number) =>
    new Quaternion().setFromAxisAngle(
      new Vector3(x, y, z).normalize(),
      (deg * Math.PI) / 180,
    );
  return [
    new Quaternion(), // front (as-is, down +Z)
    axis(0, 1, 0, -90), // right side (+X toward camera)
    axis(1, 0, 0, 90), // top (+Y toward camera)
    new Quaternion().multiplyQuaternions(axis(0, 1, 0, -45), axis(1, 0, 0, 30)), // 3/4
  ];
}

async function renderView(
  vertices: number[][],
  rot: Quaternion,
): Promise<Buffer> {
  const v = new Vector3();
  const rotated: number[][] = new Array(vertices.length);
  let rMax = 1e-6;
  let zMin = Infinity;
  let zMax = -Infinity;
  for (let i = 0; i < vertices.length; i++) {
    v.set(vertices[i][0], vertices[i][1], vertices[i][2]).applyQuaternion(rot);
    rotated[i] = [v.x, v.y, v.z];
    const r = Math.hypot(v.x, v.y);
    if (r > rMax) rMax = r;
    if (v.z < zMin) zMin = v.z;
    if (v.z > zMax) zMax = v.z;
  }

  const px = new Uint8Array(IMG * IMG);
  const zbuf = new Float32Array(IMG * IMG).fill(-Infinity);
  const scale = (IMG * 0.45) / rMax;
  const zSpan = zMax - zMin || 1e-6;
  const rad = Math.max(1, Math.round(IMG / 110)); // splat radius for solidity

  for (const [x, y, z] of rotated) {
    const sx = Math.round(IMG / 2 + x * scale);
    const sy = Math.round(IMG / 2 - y * scale); // image y grows downward
    const shade = Math.round(55 + 200 * ((z - zMin) / zSpan));
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const ix = sx + dx;
        const iy = sy + dy;
        if (ix < 0 || iy < 0 || ix >= IMG || iy >= IMG) continue;
        const idx = iy * IMG + ix;
        if (z > zbuf[idx]) {
          zbuf[idx] = z;
          px[idx] = shade;
        }
      }
    }
  }

  return sharp(Buffer.from(px), { raw: { width: IMG, height: IMG, channels: 1 } })
    .png()
    .toBuffer();
}

// ── Vision judge ────────────────────────────────────────────────────────────────

const QUALITY_SCHEMA = {
  type: "OBJECT",
  properties: {
    acceptable: { type: "BOOLEAN" },
    score: { type: "INTEGER" },
    issues: { type: "ARRAY", items: { type: "STRING" } },
    reason: { type: "STRING" },
  },
  required: ["acceptable", "score", "issues", "reason"],
} as const;

function instruction(type: string | null): string {
  const feature =
    type === "RING"
      ? "For a hoop/ring: the band must form a clean closed (or designed-open) loop with no breaks, and any bead/charm present in the photo must be there."
      : type === "BARBELL" || type === "CIRCULAR_BARBELL"
        ? "For a barbell: there must be a clean straight (or evenly curved) bar with a distinct ball/end at EACH end — not a single blob."
        : "For a stud/labret: there must be a clear decorative front (gem/ornament) on a thin post, not a featureless lump.";
  return (
    "The FIRST image is a real product PHOTO of a piece of body jewelry. The " +
    "following labeled images (V1..V4) are renders of an auto-generated 3D MODEL of " +
    "that same piece, from the front, side, top, and a 3/4 view. The renders are " +
    "UNTEXTURED grayscale depth views — judge GEOMETRY and SILHOUETTE only (shape " +
    "completeness, missing or extra parts, blobby/melted surfaces, broken bands or " +
    "posts, floating disconnected fragments), NOT color or material. Decide whether " +
    "this model is a faithful, clean reconstruction good enough to publish in a " +
    "catalog. " +
    feature +
    " Set acceptable=false when the model is blobby/melted, missing a key feature " +
    "from the photo, broken/incomplete, or a featureless lump. Give score 0-100 " +
    "(100 = excellent). List concrete issues. Respond ONLY as JSON per the schema."
  );
}

/** Parse the model's JSON reply into a verdict. Exported for tests. Returns null
 *  when the text isn't usable JSON (caller treats that as "no verdict"). */
export function parseVerdict(text: string): QualityVerdict | null {
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    if (typeof raw !== "object" || raw === null) return null;
    const score = Math.max(0, Math.min(100, Math.round(Number(raw.score) || 0)));
    const issues = Array.isArray(raw.issues)
      ? raw.issues.filter((s): s is string => typeof s === "string").slice(0, 8)
      : [];
    return {
      ok: true,
      acceptable: Boolean(raw.acceptable),
      score,
      issues,
      reason: typeof raw.reason === "string" ? raw.reason.slice(0, 300) : "",
      note: `score ${score}, acceptable ${Boolean(raw.acceptable)}`,
    };
  } catch {
    return null;
  }
}

async function askQuality(
  key: string,
  photo: PhotoData,
  renders: Buffer[],
  type: string | null,
): Promise<QualityVerdict | null> {
  const parts: unknown[] = [
    { text: instruction(type) },
    { text: "Product photo:" },
    { inline_data: { mime_type: photo.mimeType, data: photo.data } },
  ];
  renders.forEach((buf, i) => {
    parts.push({ text: `Render ${VIEW_LABELS[i]}:` });
    parts.push({
      inline_data: { mime_type: "image/png", data: buf.toString("base64") },
    });
  });

  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 400,
        responseMimeType: "application/json",
        responseSchema: QUALITY_SCHEMA,
      },
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return parseVerdict(text);
}

/**
 * Render the model from several angles and ask the vision judge whether it's a
 * faithful, clean reconstruction of the photo. Never throws; on any failure returns
 * `{ ok: false, acceptable: true }` so the pipeline keeps the model (the gate just
 * doesn't fire). `vertices` are in the final oriented model frame (post-normalize).
 */
export async function assessQuality(opts: {
  vertices: number[][];
  photoUrl: string;
  type?: string | null;
}): Promise<QualityVerdict> {
  const fail = (note: string): QualityVerdict => ({
    ok: false,
    acceptable: true,
    score: 0,
    issues: [],
    reason: "",
    note,
  });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return fail("GEMINI_API_KEY not set");
  if (opts.vertices.length < 16) return fail("too few vertices");

  try {
    const photo = await fetchPhotoBase64(opts.photoUrl);
    if (!photo) return fail("photo fetch failed");
    const renders = await Promise.all(
      viewQuats().map((q) => renderView(opts.vertices, q)),
    );
    return (
      (await askQuality(key, photo, renders, opts.type ?? null)) ??
      fail("no/unparseable verdict")
    );
  } catch (err) {
    return fail(err instanceof Error ? err.message : "quality AI failed");
  }
}

/** Exposed for tests: render the multi-view candidates without a network call. */
export async function renderQualityViewsForTest(
  vertices: number[][],
): Promise<Buffer[]> {
  return Promise.all(viewQuats().map((q) => renderView(vertices, q)));
}
