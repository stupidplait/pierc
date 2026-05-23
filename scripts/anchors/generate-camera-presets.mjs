/**
 * Generate cameraPresets[0] for every anchor in
 * prisma/seed-data/anchors.json.
 *
 * For each place we pick a *fixed* camera-axis offset:
 *   - "Спереди" (front)  →  camera sits dist meters in +Z from the anchor
 *   - "Сбоку"   (side)   →  camera sits dist meters in ±X from the anchor
 *                          (+X for side="L", -X for side="R", 0 for CENTER
 *                           but no CENTER anchor uses Сбоку today)
 *
 * That deliberately ignores the anchor's local outward-normal (rotation field)
 * because for surfaces like the chin (labret), under the lower lip, the
 * outward normal points *down* — which would put the camera at chest height
 * looking up. Fixed front/side offsets give clean, predictable framings.
 *
 * Run:  node scripts/anchors/generate-camera-presets.mjs
 * Then: npm run db:seed   (so the DB picks up the new presets)
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(
  __dirname,
  "..",
  "..",
  "prisma",
  "seed-data",
  "anchors.json",
);

function round(n, digits = 5) {
  const m = 10 ** digits;
  return Math.round(n * m) / m;
}

// Per-place tuning.
//   axis  — "front" (+Z) or "side" (±X)
//   dist  — meters from anchor to camera
//   fov   — vertical field of view in degrees
//   name  — RU display label of the preset
const PLACE_CONFIG = {
  EAR:     { axis: "side",  dist: 0.30, fov: 22, name: "Сбоку" },
  NOSE:    { axis: "front", dist: 0.30, fov: 24, name: "Спереди" },
  LIPS:    { axis: "front", dist: 0.30, fov: 24, name: "Спереди" },
  EYEBROW: { axis: "front", dist: 0.30, fov: 24, name: "Спереди" },
  TONGUE:  { axis: "front", dist: 0.35, fov: 28, name: "Спереди" },
  NIPPLE:  { axis: "front", dist: 0.50, fov: 30, name: "Спереди" },
  NAVEL:   { axis: "front", dist: 0.50, fov: 30, name: "Спереди" },
  HIP:     { axis: "side",  dist: 0.45, fov: 30, name: "Сбоку" },
  ANKLE:   { axis: "side",  dist: 0.40, fov: 32, name: "Сбоку" },
};

const raw = readFileSync(FILE, "utf-8");
const data = JSON.parse(raw);

let updated = 0;
let skipped = 0;
for (const a of data) {
  const cfg = PLACE_CONFIG[a.place];
  if (!cfg) {
    console.warn(`  ! Unknown place "${a.place}" on ${a.slug} — skipped`);
    skipped += 1;
    continue;
  }

  const target = a.position;
  let position;
  if (cfg.axis === "front") {
    // glTF Y-up: +Z is the body's front-facing direction.
    position = {
      x: target.x,
      y: target.y,
      z: target.z + cfg.dist,
    };
  } else {
    // Side view. +X for L, -X for R, 0 for CENTER (rare for Сбоку).
    const sign = a.side === "L" ? +1 : a.side === "R" ? -1 : 0;
    if (sign === 0) {
      // Fallback: still aim from front so we don't clip into the body.
      position = {
        x: target.x,
        y: target.y,
        z: target.z + cfg.dist,
      };
    } else {
      position = {
        x: target.x + sign * cfg.dist,
        y: target.y,
        z: target.z,
      };
    }
  }

  a.cameraPresets = [
    {
      name: cfg.name,
      position: { x: round(position.x), y: round(position.y), z: round(position.z) },
      target:   { x: round(target.x),   y: round(target.y),   z: round(target.z) },
      fov: cfg.fov,
    },
  ];
  updated += 1;
}

writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n", "utf-8");
console.log(`Updated ${updated} / ${data.length} anchors  (skipped: ${skipped})`);
console.log(`Wrote: ${FILE}`);
