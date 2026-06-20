// Generate per-anchor RING orientations (AnchorPoint.ringRotation).
//
//   npx tsx -r dotenv/config scripts/anchors/generate-ring-rotations.mjs        # write JSON only
//   npx tsx -r dotenv/config scripts/anchors/generate-ring-rotations.mjs --db   # also UPDATE the DB
//
// The post `rotation` aims a piece's canonical +Z at the skin's outward normal —
// right for studs, wrong for hoops on laterally-facing anchors (ear/hip/ankle),
// where it lays the ring in the sagittal plane (edge-on from the front). This
// derives a hoop frame instead: band-top → world up (hangs down), hole-axis →
// forward-facing horizontal blended slightly toward the surface normal for a
// natural 3/4. MUST stay in sync with deriveRingRotation() in
// lib/catalog/place-jewelry.ts — same constant, same math.
//
// Output is a hand-tunable seed value: the renderer uses ringRotation when set
// and falls back to the identical runtime derive when null, so re-running this
// is safe and idempotent.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Euler, Matrix4, Quaternion, Vector3 } from "three";

const RING_OUTWARD_BLEND = 0.45; // keep in lockstep with place-jewelry.ts
const WORLD_UP = new Vector3(0, 1, 0);
const WORLD_FORWARD = new Vector3(0, 0, 1);
const round5 = (n) => Math.round(n * 1e5) / 1e5;

function deriveRingEuler(rot) {
  const R = new Matrix4().makeRotationFromEuler(
    new Euler(rot.x, rot.y, rot.z, "XYZ"),
  );
  const normal = new Vector3(0, 0, 1).applyMatrix4(R).normalize();
  const horiz = normal.clone().addScaledVector(WORLD_UP, -normal.dot(WORLD_UP));
  let facing;
  if (horiz.lengthSq() < 1e-6) {
    facing = WORLD_FORWARD.clone();
  } else {
    horiz.normalize();
    facing = WORLD_FORWARD.clone()
      .addScaledVector(horiz, RING_OUTWARD_BLEND)
      .normalize();
  }
  const zAxis = facing;
  const yAxis = WORLD_UP.clone();
  const xAxis = new Vector3().crossVectors(yAxis, zAxis).normalize();
  yAxis.crossVectors(zAxis, xAxis).normalize();
  const q = new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(xAxis, yAxis, zAxis),
  );
  const e = new Euler().setFromQuaternion(q, "XYZ");
  return { x: round5(e.x), y: round5(e.y), z: round5(e.z) };
}

async function main() {
  const writeDb = process.argv.includes("--db");
  const jsonPath = path.join(process.cwd(), "prisma", "seed-data", "anchors.json");
  const anchors = JSON.parse(await readFile(jsonPath, "utf-8"));

  for (const a of anchors) {
    a.ringRotation = deriveRingEuler(a.rotation);
  }
  await writeFile(jsonPath, JSON.stringify(anchors, null, 2) + "\n", "utf-8");
  console.log(`✓ wrote ringRotation for ${anchors.length} anchors → anchors.json`);

  if (writeDb) {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    try {
      let n = 0;
      for (const a of anchors) {
        // Raw SQL so this works even before `prisma generate` picks up the new
        // column (the column already exists via `db push`).
        await prisma.$executeRawUnsafe(
          'UPDATE "AnchorPoint" SET "ringRotation" = $1::jsonb WHERE "slug" = $2',
          JSON.stringify(a.ringRotation),
          a.slug,
        );
        n += 1;
      }
      console.log(`✓ updated ringRotation on ${n} AnchorPoint rows`);
    } finally {
      await prisma.$disconnect();
    }
  } else {
    console.log("(skipped DB — pass --db to also UPDATE AnchorPoint rows)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
