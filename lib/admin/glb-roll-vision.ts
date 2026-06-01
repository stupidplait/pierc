/**
 * AI roll tiebreaker for STUD auto-placement.
 *
 * Geometry (lib/admin/glb-normalize.ts) recovers a stud's axis, attach point and
 * scale, and sets a baseline roll (decorative major-axis vertical) — but the roll
 * about +Z ("which way is up") on an ASYMMETRIC face is semantic, not geometric.
 * This module resolves it: render the model at a few candidate rolls, viewed
 * face-on (down +Z), and ask a vision model which one matches the product photo.
 *
 * Rendering is a tiny dependency-free software rasterizer (orthographic +Z splat
 * with a z-buffer + depth shading) → PNG via sharp. No headless WebGL, so it runs
 * on serverless. The vision call is Gemini Flash (free tier) over plain REST — no
 * SDK. Everything degrades gracefully: missing GEMINI_API_KEY, a fetch failure, or
 * an unparseable answer all return `{ ok: false }`, leaving the geometric baseline
 * roll in place. See docs / .env.example for GEMINI_API_KEY.
 */

import sharp from "sharp";

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";
const IMG = 256; // candidate thumbnail edge (px)
const LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const DEFAULT_CANDIDATES_DEG = [0, 90, 180, 270];

const ROLL_INSTRUCTION =
  "The first image is a product PHOTO of a piece of body jewelry (a stud). " +
  "The following labeled images are renders of a 3D model of the SAME piece, " +
  "each at a different upright rotation, all viewed face-on. Pick the render " +
  "whose orientation best matches how the piece appears in the photo — i.e. " +
  "which way the design is 'up'. Reply with ONLY the single letter of the " +
  "best-matching render.";

const HEAD_INSTRUCTION =
  "The first image is a product PHOTO of a piece of body jewelry (a stud), shown " +
  "from its decorative FRONT — the side that faces outward, away from the body " +
  "(the gem/ornament, not the flat back or the thin post). The following labeled " +
  "images are renders of a 3D model of the SAME piece, viewed from two opposite " +
  "sides. Pick the render that shows the SAME decorative front side as the photo. " +
  "Reply with ONLY the single letter of the best-matching render.";

export interface RollChoice {
  /** True only when a candidate was confidently chosen and should be baked. */
  ok: boolean;
  /** Roll to bake about +Z, in radians (0 when not applied). */
  angleRad: number;
  /** Diagnostic for logs / admin messaging. */
  note: string;
}

interface PlanarBounds {
  rMax: number; // max sqrt(x²+y²) — rotation-invariant, fixes a shared scale.
  zMin: number;
  zMax: number;
}

function planarBounds(vertices: number[][]): PlanarBounds {
  let rMax = 1e-6;
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const [x, y, z] of vertices) {
    const r = Math.hypot(x, y);
    if (r > rMax) rMax = r;
    if (z < zMin) zMin = z;
    if (z > zMax) zMax = z;
  }
  return { rMax, zMin, zMax };
}

/**
 * Render one candidate: roll the model by `roll` about +Z, project orthographically
 * down +Z (the outward face the wearer sees), splat each vertex with a depth z-test,
 * and shade by depth. Returns a grayscale PNG. `bounds` is shared across candidates
 * so they're directly comparable.
 */
async function renderCandidate(
  vertices: number[][],
  roll: number,
  bounds: PlanarBounds,
): Promise<Buffer> {
  const px = new Uint8Array(IMG * IMG); // grayscale, 0 = background
  const zbuf = new Float32Array(IMG * IMG).fill(-Infinity);
  const cos = Math.cos(roll);
  const sin = Math.sin(roll);
  const scale = (IMG * 0.45) / bounds.rMax;
  const zSpan = bounds.zMax - bounds.zMin || 1e-6;
  const rad = Math.max(1, Math.round(IMG / 110)); // splat radius for solidity

  for (const [vx, vy, vz] of vertices) {
    const x = vx * cos - vy * sin;
    const y = vx * sin + vy * cos;
    const sx = Math.round(IMG / 2 + x * scale);
    const sy = Math.round(IMG / 2 - y * scale); // image y grows downward
    const depth = (vz - bounds.zMin) / zSpan;
    const shade = Math.round(55 + 200 * depth);
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const ix = sx + dx;
        const iy = sy + dy;
        if (ix < 0 || iy < 0 || ix >= IMG || iy >= IMG) continue;
        const idx = iy * IMG + ix;
        if (vz > zbuf[idx]) {
          zbuf[idx] = vz;
          px[idx] = shade;
        }
      }
    }
  }

  return sharp(Buffer.from(px), { raw: { width: IMG, height: IMG, channels: 1 } })
    .png()
    .toBuffer();
}

interface PhotoData {
  data: string; // base64
  mimeType: string;
}

async function fetchPhotoBase64(url: string): Promise<PhotoData | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type") ?? "image/jpeg";
    if (!mimeType.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return { data: buf.toString("base64"), mimeType };
  } catch {
    return null;
  }
}

/** Extract the chosen render label (A/B/…) from the model's reply → index, or -1. */
export function parseRollAnswer(text: string, count: number): number {
  const upper = text.toUpperCase();
  for (let i = 0; i < count; i++) {
    // Match the label as a standalone token (not part of a word).
    if (new RegExp(`\\b${LABELS[i]}\\b`).test(upper)) return i;
  }
  return -1;
}

async function askGemini(
  key: string,
  photo: PhotoData,
  candidates: Buffer[],
  instruction: string,
): Promise<number> {
  const parts: unknown[] = [
    { text: instruction },
    { inline_data: { mime_type: photo.mimeType, data: photo.data } },
  ];
  candidates.forEach((buf, i) => {
    parts.push({ text: `Render ${LABELS[i]}:` });
    parts.push({ inline_data: { mime_type: "image/png", data: buf.toString("base64") } });
  });

  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0, maxOutputTokens: 8 },
    }),
  });
  if (!res.ok) return -1;
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return parseRollAnswer(text, candidates.length);
}

/**
 * Choose the roll that best matches the product photo. Renders the candidates
 * locally, then asks Gemini. Returns `{ ok: false }` (caller keeps the geometric
 * baseline) whenever the key is missing or anything fails.
 */
export async function chooseRoll(opts: {
  vertices: number[][];
  photoUrl: string;
  candidatesDeg?: number[];
}): Promise<RollChoice> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, angleRad: 0, note: "GEMINI_API_KEY not set" };
  if (opts.vertices.length < 16) {
    return { ok: false, angleRad: 0, note: "too few vertices" };
  }

  try {
    const deg = (opts.candidatesDeg ?? DEFAULT_CANDIDATES_DEG).slice(0, LABELS.length);
    const bounds = planarBounds(opts.vertices);
    const [photo, ...renders] = await Promise.all([
      fetchPhotoBase64(opts.photoUrl),
      ...deg.map((d) => renderCandidate(opts.vertices, (d * Math.PI) / 180, bounds)),
    ]);
    if (!photo) return { ok: false, angleRad: 0, note: "photo fetch failed" };

    const picked = await askGemini(
      key,
      photo as PhotoData,
      renders as Buffer[],
      ROLL_INSTRUCTION,
    );
    if (picked < 0) return { ok: false, angleRad: 0, note: "no clear pick" };

    return {
      ok: true,
      angleRad: (deg[picked] * Math.PI) / 180,
      note: `AI picked ${LABELS[picked]} (${deg[picked]}°)`,
    };
  } catch (err) {
    return {
      ok: false,
      angleRad: 0,
      note: err instanceof Error ? err.message : "roll AI failed",
    };
  }
}

export interface HeadChoice {
  /** True when a confident decision was made (key set, photo + render OK). */
  ok: boolean;
  /** True when the head/post direction should be flipped (180° about X). */
  flip: boolean;
  /** Diagnostic for logs / admin messaging. */
  note: string;
}

/**
 * Resolve the stud's head DIRECTION (which end faces out) against the product
 * photo. The geometric normalize guesses the bulkier end is the decorative head
 * and points it +Z, but for a simple stud (gem ≈ post, or a wide flat back) that
 * guess can land the gem facing INTO the body. We render the model from the front
 * (down +Z) and from the back (180° about X, viewed down +Z) and ask the vision
 * model which one shows the same decorative side as the photo; if the back wins,
 * the caller flips the geometry (and mirrors attach:primary's Z). Degrades to
 * `{ ok:false, flip:false }` whenever the key is missing or anything fails, so
 * the geometric orientation is kept.
 */
export async function chooseHeadDirection(opts: {
  vertices: number[][];
  photoUrl: string;
}): Promise<HeadChoice> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, flip: false, note: "GEMINI_API_KEY not set" };
  if (opts.vertices.length < 16) {
    return { ok: false, flip: false, note: "too few vertices" };
  }

  try {
    // 180° about X: (x,y,z) → (x,−y,−z) — shows the opposite face down +Z.
    const flipped = opts.vertices.map(
      ([x, y, z]) => [x, -y, -z] as [number, number, number],
    );
    const [photo, front, back] = await Promise.all([
      fetchPhotoBase64(opts.photoUrl),
      renderCandidate(opts.vertices, 0, planarBounds(opts.vertices)),
      renderCandidate(flipped, 0, planarBounds(flipped)),
    ]);
    if (!photo) return { ok: false, flip: false, note: "photo fetch failed" };

    // Render A (index 0) = front (as-is); B (index 1) = back (flipped).
    const picked = await askGemini(key, photo, [front, back], HEAD_INSTRUCTION);
    if (picked < 0) return { ok: false, flip: false, note: "no clear pick" };

    return {
      ok: true,
      flip: picked === 1,
      note: picked === 1 ? "AI flipped head" : "AI kept head",
    };
  } catch (err) {
    return {
      ok: false,
      flip: false,
      note: err instanceof Error ? err.message : "head AI failed",
    };
  }
}

/** Exposed for tests: render candidates without calling the network. */
export async function renderRollCandidatesForTest(
  vertices: number[][],
  candidatesDeg: number[],
): Promise<Buffer[]> {
  const bounds = planarBounds(vertices);
  return Promise.all(
    candidatesDeg.map((d) => renderCandidate(vertices, (d * Math.PI) / 180, bounds)),
  );
}
