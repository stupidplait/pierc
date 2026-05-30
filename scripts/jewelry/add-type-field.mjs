// One-shot: adds the new `type` field to every entry in
// `prisma/seed-data/jewelry.json`, derived from the existing `shape` field.
// All current 22 pieces are 1-anchor by design (no industrials yet),
// so the mapping is shape → 1-anchor type only:
//
//   seamless_hoop    → RING
//   horseshoe        → RING       (functionally 1-anchor for septum / lip-medusa)
//   labret_stud      → STUD
//   nose_stud_l      → STUD
//   curved_barbell   → STUD       (1-anchor for eyebrow / navel)
//   straight_barbell → STUD       (1-anchor for nipple)
//
// Multi-anchor BARBELL / CIRCULAR_BARBELL / ORBITAL / CHAIN_LADDER pieces
// will need to be added separately with explicit `bindings` (anchorSlugs
// arranged in order, length === expected attach-point count for the type).
// See docs/20-multi-anchor-jewelry.md.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const JSON_PATH = path.resolve("prisma/seed-data/jewelry.json");

const SHAPE_TO_TYPE = {
  seamless_hoop: "RING",
  horseshoe: "RING",
  labret_stud: "STUD",
  nose_stud_l: "STUD",
  curved_barbell: "STUD",
  straight_barbell: "STUD",
};

const raw = await readFile(JSON_PATH, "utf8");
const pieces = JSON.parse(raw);

let updated = 0;
for (const p of pieces) {
  if (p.type) continue; // already migrated; skip
  const t = SHAPE_TO_TYPE[p.shape];
  if (!t) {
    console.warn(`! ${p.slug}: unknown shape "${p.shape}", leaving type unset`);
    continue;
  }
  p.type = t;
  // Reorder so `type` lives just after `shape` for readability.
  const { shape, type, params, ...rest } = p;
  delete p.shape;
  delete p.type;
  delete p.params;
  Object.assign(p, { ...orderHead(rest), shape, type, params, ...orderTail(rest) });
  updated += 1;
  console.log(`  ${p.slug.padEnd(50)} → ${t}`);
}

function orderHead(o) {
  const { slug, name, categorySlug } = o;
  return { slug, name, categorySlug };
}

function orderTail(o) {
  // Strip the head fields; everything else is "tail".
  const { slug: _slug, name: _name, categorySlug: _categorySlug, ...rest } = o;
  // Reference the strippeds so eslint sees them used.
  void _slug;
  void _name;
  void _categorySlug;
  return rest;
}

await writeFile(JSON_PATH, JSON.stringify(pieces, null, 2) + "\n", "utf8");
console.log(`\n✓ Tagged ${updated} pieces with type. ${pieces.length - updated} already had type.`);
