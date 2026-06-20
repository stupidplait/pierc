// Pull-worker for the local self-hosted 3D-generation fallback.
// See docs/22-local-fallback.md. Runs on YOUR machine (no public inbound needed):
// it reaches OUT to the deployed app, claims queued `local` jobs, generates a
// `.glb`, and posts it back. Dependency-free — Node 18+ built-ins only.
//
// ── Setup ───────────────────────────────────────────────────────────────────────
//   APP_URL              base URL of the deployed app (e.g. https://pierc-one.vercel.app)
//   LOCAL_WORKER_SECRET  must match the app's env (Bearer auth on both endpoints)
//   GENERATOR            "fal" (managed, easiest) | "command" (local model)  [default: command]
//
//   GENERATOR=fal  → set FAL_KEY (https://fal.ai/dashboard/keys). Uses fal-ai/triposr
//                    by default; override with FAL_MODEL (e.g. fal-ai/trellis,
//                    fal-ai/hunyuan3d/v2). NOTE: this is managed inference, not
//                    zero-cost — it's the no-GPU way to exercise the whole pipeline.
//   GENERATOR=command → set GENERATE_CMD, a shell command that turns an input image
//                    into a .glb. Use {in} for the downloaded image path and {out}
//                    for the .glb to write, e.g.:
//                      GENERATE_CMD="python scripts/local-worker/generate_triposr.py {in} {out}"
//                    This is the TRUE credit-zero path (your own GPU + TripoSR / SF3D
//                    / TRELLIS). Set LOCAL_3D_WORKER=1 in the app once this runs.
//
//   POLL_INTERVAL_MS     idle poll cadence (default 5000)
//
//   Run:  node scripts/local-worker/worker.mjs

import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const SECRET = process.env.LOCAL_WORKER_SECRET;
const GENERATOR = process.env.GENERATOR || "command";
const GENERATE_CMD = process.env.GENERATE_CMD;
const FAL_KEY = process.env.FAL_KEY;
const FAL_MODEL = process.env.FAL_MODEL || "fal-ai/triposr";
const POLL_MS = Number(process.env.POLL_INTERVAL_MS || 5000);

if (!SECRET) {
  console.error("LOCAL_WORKER_SECRET is required.");
  process.exit(1);
}
if (GENERATOR === "command" && !GENERATE_CMD) {
  console.error("GENERATOR=command requires GENERATE_CMD (use {in} / {out}).");
  process.exit(1);
}
if (GENERATOR === "fal" && !FAL_KEY) {
  console.error("GENERATOR=fal requires FAL_KEY.");
  process.exit(1);
}

const auth = { authorization: `Bearer ${SECRET}` };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Claim the oldest unclaimed local job, or null. */
async function claim() {
  const res = await fetch(`${APP_URL}/api/local-jobs/claim`, {
    method: "POST",
    headers: auth,
  });
  if (!res.ok) throw new Error(`claim → HTTP ${res.status}`);
  const body = await res.json();
  return body.job ?? null; // { id, jewelryId, providerJobId, photoUrls } | null
}

/** POST the result back (a .glb file or an error string). */
async function postResult(id, { glb, error }) {
  const form = new FormData();
  if (error) {
    form.set("error", error.slice(0, 500));
  } else {
    form.set("glb", new Blob([glb], { type: "model/gltf-binary" }), "model.glb");
  }
  const res = await fetch(`${APP_URL}/api/local-jobs/${id}/result`, {
    method: "POST",
    headers: auth,
    body: form,
  });
  if (!res.ok) throw new Error(`result → HTTP ${res.status} ${await res.text()}`);
}

// ── Generators ──────────────────────────────────────────────────────────────────

/** Managed: hand the public photo URL to a fal.ai image-to-3D model, download the
 *  resulting .glb. Returns the bytes. */
async function generateFal(imageUrl) {
  const res = await fetch(`https://fal.run/${FAL_MODEL}`, {
    method: "POST",
    headers: { authorization: `Key ${FAL_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl }),
  });
  if (!res.ok) throw new Error(`fal ${FAL_MODEL} → HTTP ${res.status} ${await res.text()}`);
  const out = await res.json();
  // Output shape varies by model: model_mesh.url | model_glb.url | mesh.url | a URL string.
  const url =
    out?.model_mesh?.url ||
    out?.model_glb?.url ||
    out?.mesh?.url ||
    out?.glb?.url ||
    (typeof out?.model_mesh === "string" ? out.model_mesh : null) ||
    findGlbUrl(out);
  if (!url) throw new Error(`fal: no .glb url in response (${JSON.stringify(out).slice(0, 300)})`);
  const glbRes = await fetch(url);
  if (!glbRes.ok) throw new Error(`download glb → HTTP ${glbRes.status}`);
  return Buffer.from(await glbRes.arrayBuffer());
}

/** Best-effort scan for any *.glb URL anywhere in a JSON response. */
function findGlbUrl(obj) {
  let found = null;
  const walk = (v) => {
    if (found) return;
    if (typeof v === "string" && /^https?:\/\/.*\.glb(\?|$)/i.test(v)) found = v;
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(obj);
  return found;
}

/** Local: download the photo, run GENERATE_CMD ({in}→image, {out}→.glb), read it back. */
async function generateCommand(imageUrl) {
  const dir = await mkdtemp(join(tmpdir(), "pierc-worker-"));
  try {
    const inPath = join(dir, "input.png");
    const outPath = join(dir, "model.glb");
    const img = await fetch(imageUrl);
    if (!img.ok) throw new Error(`download photo → HTTP ${img.status}`);
    await writeFile(inPath, Buffer.from(await img.arrayBuffer()));

    const cmd = GENERATE_CMD.replaceAll("{in}", inPath).replaceAll("{out}", outPath);
    console.log(`  $ ${cmd}`);
    execSync(cmd, { stdio: "inherit" });

    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function generate(imageUrl) {
  return GENERATOR === "fal"
    ? generateFal(imageUrl)
    : generateCommand(imageUrl);
}

// ── Main loop ─────────────────────────────────────────────────────────────────

async function tick() {
  const job = await claim();
  if (!job) return false;
  console.log(`claimed ${job.id} (jewelry ${job.jewelryId})`);
  try {
    const photo = job.photoUrls?.[0];
    if (!photo) throw new Error("job has no input photo");
    const glb = await generate(photo);
    await postResult(job.id, { glb });
    console.log(`✓ ${job.id} — ${glb.length} bytes uploaded`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`✗ ${job.id} — ${msg}`);
    await postResult(job.id, { error: msg }).catch(() => {});
  }
  return true;
}

console.log(
  `local-worker → ${APP_URL}  generator=${GENERATOR}` +
    (GENERATOR === "fal" ? ` model=${FAL_MODEL}` : ""),
);
for (;;) {
  try {
    const worked = await tick();
    if (!worked) await sleep(POLL_MS);
  } catch (err) {
    console.error(`loop error: ${err instanceof Error ? err.message : err}`);
    await sleep(POLL_MS);
  }
}
