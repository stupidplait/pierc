#!/usr/bin/env tsx
/**
 * Upload all `.glb` files in `art/jewelry-out/` to Vercel Blob and record
 * the resulting URLs in `prisma/seed-data/jewelry-uploads.json`.
 *
 * Idempotent: each piece is hashed (SHA-256 of file bytes); if the upload
 * map already has the same hash for that slug, the file is skipped. When
 * the hash differs, the previous blob is deleted before the new one is
 * uploaded so we don't accumulate orphans.
 *
 * Run with:  npm run jewelry:upload
 */

import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { put, del } from "@vercel/blob";

// ─────────────────────────────────────────────────────────────────────────
// Paths + types
// ─────────────────────────────────────────────────────────────────────────

const REPO_ROOT = process.cwd();
const JEWELRY_OUT_DIR = path.join(REPO_ROOT, "art", "jewelry-out");
const UPLOAD_MAP_PATH = path.join(
  REPO_ROOT,
  "prisma",
  "seed-data",
  "jewelry-uploads.json",
);

interface JewelryUpload {
  blobUrl: string;
  hash: string;
  size: number;
  uploadedAt: string;
  thumbUrl?: string;
}

type UploadMap = Record<string, JewelryUpload>;

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function readUploadMap(): Promise<UploadMap> {
  if (!existsSync(UPLOAD_MAP_PATH)) return {};
  const raw = await readFile(UPLOAD_MAP_PATH, "utf-8");
  if (raw.trim().length === 0) return {};
  return JSON.parse(raw) as UploadMap;
}

async function writeUploadMap(map: UploadMap): Promise<void> {
  // Sort keys so the diff stays stable across runs.
  const sorted: UploadMap = {};
  for (const slug of Object.keys(map).sort()) sorted[slug] = map[slug];
  await writeFile(UPLOAD_MAP_PATH, JSON.stringify(sorted, null, 2) + "\n", "utf-8");
}

function blobKey(slug: string, hash: string): string {
  return `jewelry/seed/${slug}-${hash.slice(0, 8)}.glb`;
}

// ─────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error(
      "✗ BLOB_READ_WRITE_TOKEN is not set in .env. The upload step needs a\n" +
        "  Vercel Blob read-write token to push .glb files. Get one from\n" +
        "  the Vercel dashboard (Storage → Blob → .env.local) and re-run.\n",
    );
    process.exit(1);
  }

  if (!existsSync(JEWELRY_OUT_DIR)) {
    console.error(
      `✗ Build output directory missing: ${JEWELRY_OUT_DIR}\n` +
        "  Run the Blender pipeline first (see scripts/blender/jewelry/build_all.py).",
    );
    process.exit(1);
  }

  const entries = await readdir(JEWELRY_OUT_DIR);
  const glbFiles = entries.filter((f) => f.endsWith(".glb"));
  if (glbFiles.length === 0) {
    console.error(
      `✗ No .glb files in ${JEWELRY_OUT_DIR}.\n` +
        "  Run the Blender pipeline first (see scripts/blender/jewelry/build_all.py).",
    );
    process.exit(1);
  }

  const map = await readUploadMap();
  let uploaded = 0;
  let skipped = 0;
  let replaced = 0;

  for (const file of glbFiles) {
    const slug = file.replace(/\.glb$/, "");
    const filePath = path.join(JEWELRY_OUT_DIR, file);
    const buf = await readFile(filePath);
    const hash = sha256(buf);
    const stats = await stat(filePath);

    const prev = map[slug];
    if (prev && prev.hash === hash) {
      skipped += 1;
      console.log(`  · ${slug.padEnd(50)} skipped (hash match)`);
      continue;
    }

    // Different hash → drop the old blob first to avoid accumulation.
    if (prev?.blobUrl) {
      try {
        await del(prev.blobUrl);
        replaced += 1;
      } catch (err) {
        console.warn(
          `  ! ${slug}: failed to delete previous blob (${prev.blobUrl}): ${
            err instanceof Error ? err.message : err
          }. Continuing.`,
        );
      }
    }

    const blob = await put(blobKey(slug, hash), buf, {
      access: "public",
      addRandomSuffix: false,
      contentType: "model/gltf-binary",
    });

    map[slug] = {
      blobUrl: blob.url,
      hash,
      size: stats.size,
      uploadedAt: new Date().toISOString(),
    };
    uploaded += 1;
    console.log(
      `  ✓ ${slug.padEnd(50)} ${(stats.size / 1024).toFixed(1).padStart(6)} KB  ${blob.url}`,
    );
  }

  // Detect orphans — slugs in the upload map with no matching .glb file.
  // Don't auto-prune (manual catalog pieces might have been removed
  // intentionally for staging); just warn so the human notices.
  const onDisk = new Set(glbFiles.map((f) => f.replace(/\.glb$/, "")));
  const orphans = Object.keys(map).filter((s) => !onDisk.has(s));
  if (orphans.length > 0) {
    console.log(
      `\n  ⚠ ${orphans.length} slug(s) in upload map without a built .glb:`,
    );
    for (const o of orphans) console.log(`      ${o}`);
    console.log(
      "    These remain hosted on Blob until you delete them manually.",
    );
  }

  await writeUploadMap(map);

  console.log(
    `\n→ Done: ${uploaded} uploaded, ${replaced} replaced, ${skipped} skipped.\n` +
      `  Upload map: ${path.relative(REPO_ROOT, UPLOAD_MAP_PATH)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
