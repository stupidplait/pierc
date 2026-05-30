#!/usr/bin/env node
/**
 * Mirror lite-mode WASM model assets from upstream CDNs to our Vercel Blob.
 *
 * Self-hosting these assets means lite mode keeps working even if imgly's
 * or Google's CDN has an outage, and gives us version pinning across
 * deploys. See docs/15-lite-mode.md for the full strategy.
 *
 * What this script mirrors:
 *
 *   1. `@imgly/background-removal` chunks  (Task 3)
 *      • Source: https://staticimgly.com/@imgly/background-removal-data/<version>/dist/
 *      • Target: lite/imgly/<chunkHash> on Blob
 *      • Plus the resources.json manifest itself.
 *
 *   2. MediaPipe Face Landmarker model     (Task 4)
 *      • Source: https://storage.googleapis.com/mediapipe-models/...
 *      • Target: lite/mediapipe/face_landmarker.task on Blob
 *
 * Idempotency: each remote file is fetched and hashed in-memory, then
 * compared against the existing Blob (via @vercel/blob's `head()`). If the
 * existing Blob's `contentDisposition` carries the same hash tag, the
 * upload is skipped. Otherwise we (re)upload. Safe to re-run.
 *
 * Run with: npm run lite:wasm
 *
 * Requires BLOB_READ_WRITE_TOKEN in .env (same as scripts/jewelry-upload.ts).
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { put, head } from "@vercel/blob";

// ─────────────────────────────────────────────────────────────────────────
// Config (pinned upstream versions)
// ─────────────────────────────────────────────────────────────────────────

const IMGLY_VERSION = "1.7.0";
const IMGLY_CDN_BASE = `https://staticimgly.com/@imgly/background-removal-data/${IMGLY_VERSION}/dist/`;
const IMGLY_BLOB_PREFIX = "lite/imgly/";

const FACE_LANDMARKER_SOURCE_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const FACE_LANDMARKER_BLOB_KEY = "lite/mediapipe/face_landmarker.task";

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * Load .env from the repo root so BLOB_READ_WRITE_TOKEN is available.
 * Mirrors how `scripts/jewelry-upload.ts` is invoked via tsx -r dotenv/config;
 * here we do it inline so the script can run as plain `node`.
 */
async function loadDotEnv() {
  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  const raw = await readFile(envPath, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip surrounding quotes if present.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

/** Fetch a URL into a Buffer, throwing on non-2xx. */
async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Fetch failed for ${url}: ${res.status} ${res.statusText}`);
  }
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

/**
 * Check whether a Blob already exists at `key` with the given hash. We
 * stash the hash in `contentDisposition` so HEAD requests can compare
 * without re-downloading the body.
 */
async function blobMatchesHash(key, hash) {
  const url = blobUrl(key);
  try {
    const meta = await head(url);
    // We tag uploads with `inline; filename="<hash>"` — extract and compare.
    const cd = meta.contentDisposition ?? "";
    const m = cd.match(/filename="?([a-f0-9]{64})"?/);
    return m?.[1] === hash;
  } catch {
    // 404 or any other error → assume missing, proceed to upload.
    return false;
  }
}

function blobUrl(key) {
  // The script doesn't actually need to compute Blob URLs — `head()` and
  // `put()` accept the key path directly when the token is set. But for
  // logging readability we expose this helper.
  return `https://4hfidxargsvlocxu.public.blob.vercel-storage.com/${key}`;
}

/** Upload a Buffer to Blob at the given key, tagging the hash for HEAD checks. */
async function uploadWithHash(key, buf, hash, contentType) {
  return put(key, buf, {
    access: "public",
    addRandomSuffix: false,
    contentType,
    contentDisposition: `inline; filename="${hash}"`,
  });
}

/** Mirror one file from a source URL to a Blob key. Skips if hash matches. */
async function mirrorFile({ sourceUrl, blobKey, contentType, label }) {
  const buf = await fetchBuffer(sourceUrl);
  const hash = sha256Hex(buf);

  if (await blobMatchesHash(blobKey, hash)) {
    return { skipped: true, label, size: buf.length };
  }

  await uploadWithHash(blobKey, buf, hash, contentType);
  return { skipped: false, label, size: buf.length };
}

// ─────────────────────────────────────────────────────────────────────────
// Imgly mirror
// ─────────────────────────────────────────────────────────────────────────

async function mirrorImgly() {
  console.log(`\n→ Mirroring @imgly/background-removal v${IMGLY_VERSION}…`);

  // 1. Fetch the manifest from imgly's CDN.
  const manifestUrl = `${IMGLY_CDN_BASE}resources.json`;
  const manifestBuf = await fetchBuffer(manifestUrl);
  const manifestText = manifestBuf.toString("utf-8");
  const manifest = JSON.parse(manifestText);

  // 2. Collect every unique chunk name across every entry.
  const chunkNames = new Set();
  let entryCount = 0;
  for (const entry of Object.values(manifest)) {
    entryCount += 1;
    for (const chunk of entry.chunks ?? []) {
      if (chunk?.name) chunkNames.add(chunk.name);
    }
  }
  console.log(
    `  Manifest has ${entryCount} entries, ${chunkNames.size} unique chunks.`,
  );

  // 3. Mirror each chunk in series (parallelism is bandwidth-bound and the
  //    whole pipeline is one-shot anyway).
  let uploaded = 0;
  let skipped = 0;
  const chunkArray = Array.from(chunkNames);
  for (let i = 0; i < chunkArray.length; i++) {
    const name = chunkArray[i];
    const result = await mirrorFile({
      sourceUrl: `${IMGLY_CDN_BASE}${name}`,
      blobKey: `${IMGLY_BLOB_PREFIX}${name}`,
      contentType: "application/octet-stream",
      label: `chunk ${i + 1}/${chunkArray.length}`,
    });
    if (result.skipped) {
      skipped += 1;
      console.log(
        `  · ${result.label.padEnd(20)} ${name.slice(0, 12)}…  ${(result.size / 1024).toFixed(0)} KB  skipped`,
      );
    } else {
      uploaded += 1;
      console.log(
        `  ✓ ${result.label.padEnd(20)} ${name.slice(0, 12)}…  ${(result.size / 1024).toFixed(0)} KB  uploaded`,
      );
    }
  }

  // 4. Mirror the manifest itself last (so partial runs don't leave it
  //    pointing at chunks that haven't been uploaded yet).
  const manifestHash = sha256Hex(manifestBuf);
  if (await blobMatchesHash(`${IMGLY_BLOB_PREFIX}resources.json`, manifestHash)) {
    skipped += 1;
    console.log(`  · resources.json     skipped`);
  } else {
    await uploadWithHash(
      `${IMGLY_BLOB_PREFIX}resources.json`,
      manifestBuf,
      manifestHash,
      "application/json",
    );
    uploaded += 1;
    console.log(`  ✓ resources.json     uploaded`);
  }

  console.log(`  → imgly: ${uploaded} uploaded, ${skipped} skipped`);
}

// ─────────────────────────────────────────────────────────────────────────
// MediaPipe mirror
// ─────────────────────────────────────────────────────────────────────────

async function mirrorMediaPipe() {
  console.log(`\n→ Mirroring MediaPipe Face Landmarker model…`);

  const result = await mirrorFile({
    sourceUrl: FACE_LANDMARKER_SOURCE_URL,
    blobKey: FACE_LANDMARKER_BLOB_KEY,
    contentType: "application/octet-stream",
    label: "face_landmarker.task",
  });

  if (result.skipped) {
    console.log(
      `  · ${result.label}  ${(result.size / 1024 / 1024).toFixed(1)} MB  skipped`,
    );
  } else {
    console.log(
      `  ✓ ${result.label}  ${(result.size / 1024 / 1024).toFixed(1)} MB  uploaded`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  await loadDotEnv();

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error(
      "✗ BLOB_READ_WRITE_TOKEN is not set in .env. The mirror step needs a\n" +
        "  Vercel Blob read-write token. Get one from the Vercel dashboard\n" +
        "  (Storage → Blob → .env.local) and re-run.\n",
    );
    process.exit(1);
  }

  await mirrorImgly();
  await mirrorMediaPipe();

  console.log(
    "\n→ Done. WASM assets mirrored to Vercel Blob.\n" +
      "  Lite mode and the admin sprite uploader will load from there at runtime.\n",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
