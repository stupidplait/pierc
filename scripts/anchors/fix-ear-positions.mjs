// One-shot: rewrites ear anchor positions + side-view camera presets in
// prisma/seed-data/anchors.json based on anatomically correct landmarks
// derived from probing the body.glb mesh in Blender.
//
// Run once: `node scripts/anchors/fix-ear-positions.mjs`. After this, the
// fix is committed to the JSON; the script is kept only as a record/redo.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const JSON_PATH = path.resolve("prisma/seed-data/anchors.json");

// New positions in glTF coords (X = lateral, Y = up, Z = forward).
// Mapped from Blender world coords (Z-up) via: glTF.x = bl.x, glTF.y = bl.z, glTF.z = -bl.y.
// Sources: heatmap probe of Body in art/source/body.blend — the ear cartilage
// is at Blender Y +0.020..+0.045 (i.e. glTF Z -0.020..-0.045), Z 1.555..1.605.
// All anchors lie INSIDE this region so the dots sit on the ear surface.
const earPositions = {
  "left-ear-lobe":     { x:  0.075, y: 1.557, z: -0.025 },  // bottom of ear (lobe)
  "right-ear-lobe":    { x: -0.075, y: 1.557, z: -0.025 },
  "left-helix":        { x:  0.083, y: 1.598, z: -0.040 },  // upper-outer rim, peak lateral
  "right-helix":       { x: -0.083, y: 1.598, z: -0.040 },
  "left-tragus":       { x:  0.073, y: 1.580, z: -0.020 },  // front edge of ear cartilage
  "right-tragus":      { x: -0.073, y: 1.580, z: -0.020 },
  "left-conch":        { x:  0.073, y: 1.580, z: -0.030 },  // bowl center, recessed from rim
  "right-conch":       { x: -0.073, y: 1.580, z: -0.030 },
  "left-daith":        { x:  0.072, y: 1.585, z: -0.025 },  // inner curl, just above canal
  "right-daith":       { x: -0.072, y: 1.585, z: -0.025 },
  "left-rook":         { x:  0.080, y: 1.595, z: -0.032 },  // antihelix ridge, upper-inner
  "right-rook":        { x: -0.080, y: 1.595, z: -0.032 },
  "left-industrial":   { x:  0.080, y: 1.605, z: -0.030 },  // top of ear (bar entry)
  "right-industrial":  { x: -0.080, y: 1.605, z: -0.030 },
};

// Side-view camera offset: 30cm laterally, same height & forward as the anchor.
// This matches the original pattern in the JSON for ear anchors.
const CAM_OFFSET = 0.30;
const CAM_FOV    = 22;

const raw = await readFile(JSON_PATH, "utf8");
const anchors = JSON.parse(raw);

let updated = 0;
for (const a of anchors) {
  const newPos = earPositions[a.slug];
  if (!newPos) continue;

  a.position = { ...newPos };

  // Rebuild the side-view camera preset
  const lateralSign = a.side === "L" ? 1 : -1;
  a.cameraPresets = [
    {
      name: "Сбоку",
      position: {
        x: newPos.x + lateralSign * CAM_OFFSET,
        y: newPos.y,
        z: newPos.z,
      },
      target: { ...newPos },
      fov: CAM_FOV,
    },
  ];

  updated += 1;
  console.log(`  ${a.slug.padEnd(20)} -> pos=(${newPos.x.toFixed(3)}, ${newPos.y.toFixed(3)}, ${newPos.z.toFixed(3)})`);
}

await writeFile(JSON_PATH, JSON.stringify(anchors, null, 2) + "\n", "utf8");
console.log(`\n✓ Updated ${updated} ear anchors in ${JSON_PATH}`);
