/**
 * Standalone smoke test for lib/admin/glb-normalize.ts geometry.
 * Run: npx tsx scripts/smoke-glb-normalize.ts
 *
 * Builds synthetic gltf-transform Documents (rings + studs, some tilted) and
 * asserts the recovered pose + attach point. No network, no Blender, no DB.
 */
import { Document } from "@gltf-transform/core";
import { normalizeRingDocument, normalizeStudDocument } from "../lib/admin/glb-normalize";

type V = [number, number, number];

function docFromVerts(verts: V[]): Document {
  const doc = new Document();
  const buf = doc.createBuffer();
  const arr = new Float32Array(verts.length * 3);
  verts.forEach((v, i) => {
    arr[i * 3] = v[0];
    arr[i * 3 + 1] = v[1];
    arr[i * 3 + 2] = v[2];
  });
  const pos = doc.createAccessor().setType("VEC3").setArray(arr).setBuffer(buf);
  const prim = doc.createPrimitive().setAttribute("POSITION", pos);
  const mesh = doc.createMesh().addPrimitive(prim);
  const node = doc.createNode().setMesh(mesh);
  const scene = doc.createScene().addChild(node);
  doc.getRoot().setDefaultScene(scene);
  return doc;
}

function readVerts(doc: Document): V[] {
  const out: V[] = [];
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION")!;
      const el = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, el);
        out.push([el[0], el[1], el[2]]);
      }
    }
  return out;
}

function rotX(v: V, t: number): V {
  const c = Math.cos(t), s = Math.sin(t);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}

function angDist(a: number, b: number): number {
  let d = Math.abs(a - b) % (2 * Math.PI);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d;
}

/** Torus in XY plane, optional local narrowing (thin wire), charm (radial bump),
 *  gap (missing arc), and a whole-shape tilt about X. */
function torus(opts: {
  R?: number; r?: number; major?: number; minor?: number; tilt?: number;
  narrowAt?: number | null; charmAt?: number | null; gapAt?: number | null;
}): V[] {
  const { R = 0.004, r = 0.0006, major = 72, minor = 16, tilt = 0,
    narrowAt = null, charmAt = null, gapAt = null } = opts;
  const verts: V[] = [];
  for (let i = 0; i < major; i++) {
    const phi = (i / major) * 2 * Math.PI;
    if (gapAt != null && angDist(phi, gapAt) < 0.35) continue; // missing arc
    let rl = r, Rl = R;
    if (narrowAt != null && angDist(phi, narrowAt) < 0.4) rl *= 0.35; // necked wire
    if (charmAt != null && angDist(phi, charmAt) < 0.4) Rl *= 1.7; // radial bump
    for (let j = 0; j < minor; j++) {
      const psi = (j / minor) * 2 * Math.PI;
      let v: V = [
        (Rl + rl * Math.cos(psi)) * Math.cos(phi),
        (Rl + rl * Math.cos(psi)) * Math.sin(phi),
        rl * Math.sin(psi),
      ];
      if (tilt) v = rotX(v, tilt);
      verts.push(v);
    }
  }
  return verts;
}

/** Elongated stud: thin post 0..L along +Z + spherical head at z=L; optional tilt. */
function stud(opts: { tilt?: number } = {}): V[] {
  const { tilt = 0 } = opts;
  const rp = 0.0005, L = 0.006, rh = 0.0016;
  const verts: V[] = [];
  for (let k = 0; k <= 24; k++) {
    const z = (k / 24) * L;
    for (let j = 0; j < 12; j++) {
      const a = (j / 12) * 2 * Math.PI;
      let v: V = [rp * Math.cos(a), rp * Math.sin(a), z];
      if (tilt) v = rotX(v, tilt);
      verts.push(v);
    }
  }
  for (let la = 0; la <= 12; la++) {
    const th = (la / 12) * Math.PI;
    for (let lo = 0; lo < 16; lo++) {
      const ph = (lo / 16) * 2 * Math.PI;
      let v: V = [
        rh * Math.sin(th) * Math.cos(ph),
        rh * Math.sin(th) * Math.sin(ph),
        L + rh * Math.cos(th),
      ];
      if (tilt) v = rotX(v, tilt);
      verts.push(v);
    }
  }
  return verts;
}

/** Disc-top stud: flat wide disc (normal +Z) + short post out the +Z face. */
function discStud(opts: { tilt?: number } = {}): V[] {
  const { tilt = 0 } = opts;
  const Rd = 0.004, hd = 0.0005, rp = 0.0005, L = 0.0018;
  const verts: V[] = [];
  for (let ring = 0; ring <= 8; ring++) {
    const rr = (ring / 8) * Rd;
    for (let j = 0; j < 28; j++) {
      const a = (j / 28) * 2 * Math.PI;
      for (const z of [-hd, hd]) {
        let v: V = [rr * Math.cos(a), rr * Math.sin(a), z];
        if (tilt) v = rotX(v, tilt);
        verts.push(v);
      }
    }
  }
  for (let k = 0; k <= 10; k++) {
    const z = hd + (k / 10) * L;
    for (let j = 0; j < 10; j++) {
      const a = (j / 10) * 2 * Math.PI;
      let v: V = [rp * Math.cos(a), rp * Math.sin(a), z];
      if (tilt) v = rotX(v, tilt);
      verts.push(v);
    }
  }
  return verts;
}

// Bin baked ring verts → which angle holds the thinnest / heaviest sector.
function bakedFeatureAngle(verts: V[], mode: "thin" | "heavy"): number {
  const N = 36;
  const outer = new Array(N).fill(0);
  const inner = new Array(N).fill(Infinity);
  for (const [x, y] of verts) {
    const pr = Math.hypot(x, y);
    const a = Math.atan2(y, x);
    const b = Math.min(N - 1, Math.floor(((a + Math.PI) / (2 * Math.PI)) * N));
    if (pr > outer[b]) outer[b] = pr;
    if (pr < inner[b]) inner[b] = pr;
  }
  const ringMax = Math.max(...outer, 1e-9);
  const thick = outer.map((o, b) => (inner[b] === Infinity ? 0 : o - inner[b]));
  const medThick = [...thick.filter((t) => t > 0)].sort((a, b) => a - b)[
    Math.floor(thick.filter((t) => t > 0).length / 2)
  ] || 1e-9;
  const medOuter = [...outer.filter((o) => o > 0.3 * ringMax)].sort((a, b) => a - b)[
    Math.floor(outer.filter((o) => o > 0.3 * ringMax).length / 2)
  ] || ringMax;
  let sx = 0, sy = 0;
  for (let b = 0; b < N; b++) {
    const empty = inner[b] === Infinity || outer[b] < 0.3 * ringMax;
    const w =
      mode === "thin"
        ? empty ? 1 : Math.max(0, (medThick - thick[b]) / medThick, (medOuter - outer[b]) / medOuter)
        : Math.max(0, (outer[b] - medOuter) / medOuter);
    if (w <= 0) continue;
    const a = ((b + 0.5) / N) * 2 * Math.PI - Math.PI;
    sx += w * Math.cos(a);
    sy += w * Math.sin(a);
  }
  return Math.atan2(sy, sx);
}

function extent(verts: V[], axis: 0 | 1 | 2): number {
  let lo = Infinity, hi = -Infinity;
  for (const v of verts) { lo = Math.min(lo, v[axis]); hi = Math.max(hi, v[axis]); }
  return hi - lo;
}

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (!cond) failures++;
}

const DEG = 180 / Math.PI;
const nearTop = (a: number) => angDist(a, Math.PI / 2) < (25 / DEG);
const nearBottom = (a: number) => angDist(a, -Math.PI / 2) < (25 / DEG);

// ── RING cases ────────────────────────────────────────────────────────────
{
  const d = docFromVerts(torus({}));
  const r = normalizeRingDocument(d, { gauge: 1.2, size: 8 });
  check("ring/plain feature=none", r.note.includes("feature none"), r.note);
  check("ring/plain attach on +Y axis", Math.abs(r.attachLocal![0]) < 1e-4 && r.attachLocal![1] > 0);
}
{
  const d = docFromVerts(torus({ tilt: 0.5, narrowAt: 0 }));
  const r = normalizeRingDocument(d, { gauge: 1.2, size: 8 });
  const baked = readVerts(d);
  const ang = bakedFeatureAngle(baked, "thin");
  check("ring/narrowing detected", r.note.includes("feature narrowing"), r.note);
  check("ring/narrowing rolled to TOP (+Y)", nearTop(ang), `mount@${(ang * DEG).toFixed(0)}°`);
  check("ring/tilt orientation recovered (flat in XY)", extent(baked, 2) < 0.3 * extent(baked, 0),
    `zExt=${extent(baked, 2).toFixed(4)} xExt=${extent(baked, 0).toFixed(4)}`);
  // Symmetric wire-necking keeps the centerline at R (only thickness shrinks), so
  // the snapped marker sits on the band centerline (~R), not floating off it.
  check("ring/narrowing attach on band centerline", r.attachLocal![1] > 0.002 && r.attachLocal![1] < 0.005,
    `y=${r.attachLocal![1].toFixed(4)}`);
}
{
  const d = docFromVerts(torus({ charmAt: 0 }));
  const r = normalizeRingDocument(d, { gauge: 1.2, size: 8 });
  const ang = bakedFeatureAngle(readVerts(d), "heavy");
  check("ring/charm detected", r.note.includes("feature charm"), r.note);
  check("ring/charm hangs at BOTTOM (−Y)", nearBottom(ang), `charm@${(ang * DEG).toFixed(0)}°`);
}
{
  const d = docFromVerts(torus({ gapAt: 0 }));
  const r = normalizeRingDocument(d, { gauge: 1.2, size: 8 });
  const ang = bakedFeatureAngle(readVerts(d), "thin");
  check("ring/gap → mount at TOP (+Y)", r.note.includes("narrowing") && nearTop(ang),
    `${r.note} mount@${(ang * DEG).toFixed(0)}°`);
}

// ── STUD cases ────────────────────────────────────────────────────────────
{
  const d = docFromVerts(stud({ tilt: 0.4 }));
  const r = normalizeStudDocument(d, { gauge: 1.0, size: 6 });
  const baked = readVerts(d);
  // mean radius of the top 15% z (head) vs bottom 15% z (post)
  const zs = baked.map((v) => v[2]).sort((a, b) => a - b);
  const loZ = zs[Math.floor(zs.length * 0.15)], hiZ = zs[Math.floor(zs.length * 0.85)];
  const meanR = (sel: (z: number) => boolean) => {
    const rs = baked.filter((v) => sel(v[2])).map((v) => Math.hypot(v[0], v[1]));
    return rs.reduce((s, x) => s + x, 0) / Math.max(1, rs.length);
  };
  check("stud/not disc", !r.note.includes("(disc)"), r.note);
  check("stud/head at +Z (bulkier top)", meanR((z) => z >= hiZ) > meanR((z) => z <= loZ));
  check("stud/attach on axis", Math.abs(r.attachLocal![0]) < 5e-4 && Math.abs(r.attachLocal![1]) < 5e-4, JSON.stringify(r.attachLocal));
  check("stud/confidence reasonable", (r.confidence ?? 0) >= 0.4, `conf=${r.confidence}`);
}
{
  const d = docFromVerts(discStud({ tilt: 0.4 }));
  const r = normalizeStudDocument(d, { gauge: 1.0, size: 8 });
  const baked = readVerts(d);
  check("disc-stud/detected as disc", r.note.includes("(disc)"), r.note);
  check("disc-stud/outward axis = disc normal (thin Z, wide XY)",
    extent(baked, 2) < 0.5 * extent(baked, 0),
    `zExt=${extent(baked, 2).toFixed(4)} xExt=${extent(baked, 0).toFixed(4)}`);
}

console.log(`\n${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"}`);
process.exit(failures === 0 ? 0 : 1);
