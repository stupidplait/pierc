// One-shot: append the Phase A "missing anchor" set to
// `prisma/seed-data/anchors.json` with sensible default positions.
//
// Positions are chosen relative to the EXISTING anchor placements so the
// new ones land in roughly the right spot — fine to fine-tune in Blender
// and re-sync via `npm run anchors:sync`.
//
// Coordinates are in glTF (Y-up) frame: +X = lateral, +Y = up, +Z = forward.
// See docs/20-multi-anchor-jewelry.md and the chat history for the
// anatomy reference.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const JSON_PATH = path.resolve("prisma/seed-data/anchors.json");

// Standard side-view camera offsets — same offsets used by the existing ear
// anchors so framing is consistent.
const SIDE_OFFSET = 0.30; // 30 cm laterally
const FRONT_OFFSET = 0.30; // 30 cm forward of face
const SIDE_FOV = 22;
const FRONT_FOV = 24;
const HEAD_FRONT_FOV = 30;

// Helper: build a side-view camera preset (L = +X, R = −X).
function sidePreset(pos, side) {
  const sign = side === "L" ? 1 : -1;
  return [
    {
      name: "Сбоку",
      position: { x: pos.x + sign * SIDE_OFFSET, y: pos.y, z: pos.z },
      target: { ...pos },
      fov: SIDE_FOV,
    },
  ];
}

function frontPreset(pos, fov = FRONT_FOV) {
  return [
    {
      name: "Спереди",
      position: { x: pos.x, y: pos.y, z: pos.z + FRONT_OFFSET },
      target: { ...pos },
      fov,
    },
  ];
}

// ───────────────────────────────────────────────────────────────────────
// New anchors. Each: { slug, name, place, side, position, rotation, cameraPresets }.
// Rotation defaults are conservative — the renderer mostly uses these for
// jewelry orientation; for ear anchors the existing left-rook rotation is
// reused since they're all "facing outward laterally".
// ───────────────────────────────────────────────────────────────────────

const EAR_LATERAL_ROT_L = { x: 0.028, y: 0.788, z: 0 }; // copied from left-rook
const EAR_LATERAL_ROT_R = { x: 0.028, y: -0.788, z: 0 };
const FACE_FORWARD_ROT = { x: 0, y: 0, z: 0 };

const NEW_ANCHORS = [
  // ── Ear: forward / posterior helix (industrial endpoints) ─────────
  {
    slug: "left-helix-forward",
    name: "Передний хеликс (левый)",
    place: "EAR",
    side: "L",
    position: { x: 0.078, y: 1.61, z: -0.022 },
    rotation: EAR_LATERAL_ROT_L,
  },
  {
    slug: "right-helix-forward",
    name: "Передний хеликс (правый)",
    place: "EAR",
    side: "R",
    position: { x: -0.078, y: 1.61, z: -0.022 },
    rotation: EAR_LATERAL_ROT_R,
  },
  {
    slug: "left-helix-posterior",
    name: "Задний хеликс (левый)",
    place: "EAR",
    side: "L",
    position: { x: 0.078, y: 1.61, z: -0.058 },
    rotation: EAR_LATERAL_ROT_L,
  },
  {
    slug: "right-helix-posterior",
    name: "Задний хеликс (правый)",
    place: "EAR",
    side: "R",
    position: { x: -0.078, y: 1.61, z: -0.058 },
    rotation: EAR_LATERAL_ROT_R,
  },
  // ── Ear: anti-tragus (opposite tragus, just above lobe) ────────────
  {
    slug: "left-anti-tragus",
    name: "Антикозелок (левый)",
    place: "EAR",
    side: "L",
    position: { x: 0.075, y: 1.568, z: -0.018 },
    rotation: EAR_LATERAL_ROT_L,
  },
  {
    slug: "right-anti-tragus",
    name: "Антикозелок (правый)",
    place: "EAR",
    side: "R",
    position: { x: -0.075, y: 1.568, z: -0.018 },
    rotation: EAR_LATERAL_ROT_R,
  },
  // ── Ear: snug (antihelix outer fold, between rook and helix rim) ──
  {
    slug: "left-snug",
    name: "Снаг (левый)",
    place: "EAR",
    side: "L",
    position: { x: 0.082, y: 1.592, z: -0.038 },
    rotation: EAR_LATERAL_ROT_L,
  },
  {
    slug: "right-snug",
    name: "Снаг (правый)",
    place: "EAR",
    side: "R",
    position: { x: -0.082, y: 1.592, z: -0.038 },
    rotation: EAR_LATERAL_ROT_R,
  },
  // ── Lobe stacks (2nd + 3rd, ~6 mm spacing) ─────────────────────────
  {
    slug: "left-ear-lobe-2",
    name: "Левая мочка (2-я)",
    place: "EAR",
    side: "L",
    position: { x: 0.077, y: 1.563, z: -0.022 },
    rotation: EAR_LATERAL_ROT_L,
  },
  {
    slug: "right-ear-lobe-2",
    name: "Правая мочка (2-я)",
    place: "EAR",
    side: "R",
    position: { x: -0.077, y: 1.563, z: -0.022 },
    rotation: EAR_LATERAL_ROT_R,
  },
  {
    slug: "left-ear-lobe-3",
    name: "Левая мочка (3-я)",
    place: "EAR",
    side: "L",
    position: { x: 0.078, y: 1.569, z: -0.02 },
    rotation: EAR_LATERAL_ROT_L,
  },
  {
    slug: "right-ear-lobe-3",
    name: "Правая мочка (3-я)",
    place: "EAR",
    side: "R",
    position: { x: -0.078, y: 1.569, z: -0.02 },
    rotation: EAR_LATERAL_ROT_R,
  },
  // ── Nose bridge (between eyes, top of nose) ────────────────────────
  {
    slug: "nose-bridge",
    name: "Бридж (переносица)",
    place: "NOSE",
    side: "CENTER",
    position: { x: 0, y: 1.605, z: 0.075 },
    rotation: FACE_FORWARD_ROT,
  },
  // ── Lips: monroe / madonna (off-center upper lip) ──────────────────
  {
    slug: "monroe-left",
    name: "Монро",
    place: "LIPS",
    side: "L",
    position: { x: 0.02, y: 1.54, z: 0.078 },
    rotation: FACE_FORWARD_ROT,
  },
  {
    slug: "madonna-right",
    name: "Мадонна",
    place: "LIPS",
    side: "R",
    position: { x: -0.02, y: 1.54, z: 0.078 },
    rotation: FACE_FORWARD_ROT,
  },
  // ── Lips: vertical labret ──────────────────────────────────────────
  {
    slug: "vertical-labret",
    name: "Вертикальный лабрет",
    place: "LIPS",
    side: "CENTER",
    position: { x: 0, y: 1.503, z: 0.073 },
    rotation: { x: 1.296, y: -0.265, z: 0 }, // copied from lip-labret
  },
  // ── Cheek (dimples) ────────────────────────────────────────────────
  // NOTE: anchors.json + Prisma BodyPlace enum don't currently include CHEEK.
  // To keep the seed valid without a schema bump, we skip cheek anchors here
  // and revisit when we add CHEEK to the BodyPlace enum.
];

const raw = await readFile(JSON_PATH, "utf8");
const existing = JSON.parse(raw);
const knownSlugs = new Set(existing.map((a) => a.slug));

let added = 0;
let skipped = 0;
for (const a of NEW_ANCHORS) {
  if (knownSlugs.has(a.slug)) {
    console.log(`  skip ${a.slug} (already exists)`);
    skipped += 1;
    continue;
  }
  // Camera preset: side view for ear/hip/ankle, front view for face features.
  const cameraPresets =
    a.place === "EAR"
      ? sidePreset(a.position, a.side)
      : frontPreset(
          a.position,
          a.place === "NOSE" || a.place === "LIPS"
            ? FRONT_FOV
            : HEAD_FRONT_FOV,
        );

  existing.push({
    slug: a.slug,
    name: a.name,
    place: a.place,
    side: a.side,
    position: a.position,
    rotation: a.rotation,
    cameraPresets,
    auto: true,
  });
  console.log(
    `  + ${a.slug.padEnd(28)} ${a.place.padEnd(7)} ${a.side.padEnd(6)} pos=(${a.position.x.toFixed(3)}, ${a.position.y.toFixed(3)}, ${a.position.z.toFixed(3)})`,
  );
  added += 1;
}

await writeFile(JSON_PATH, JSON.stringify(existing, null, 2) + "\n", "utf8");
console.log(`\n✓ Added ${added} new anchors, skipped ${skipped}, total now ${existing.length}.`);
