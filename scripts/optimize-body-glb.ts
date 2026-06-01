/**
 * One-shot: recompress the embedded textures in public/models/body/body.glb.
 *
 * The mannequin ships four PNG textures, dominated by a 2048×2048 eyelash map
 * (~1.5 MB) and a 1024×1024 tongue map (~0.5 MB) — absurd for a body shown at
 * small scale in the catalog showroom. We cap every texture at 512px and
 * re-encode as WebP, then re-write the Draco-compressed geometry untouched.
 *
 * Run once:  npx tsx scripts/optimize-body-glb.ts
 * The original is backed up to body.glb.bak the first time.
 */
import { existsSync } from "node:fs";
import { copyFile, stat } from "node:fs/promises";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { textureCompress } from "@gltf-transform/functions";
import draco3d from "draco3d";
import sharp from "sharp";

const GLB = path.resolve("public/models/body/body.glb");
const BAK = `${GLB}.bak`;
const MAX_TEXTURE_SIZE = 512;

async function main() {
  if (!existsSync(GLB)) throw new Error(`not found: ${GLB}`);

  if (!existsSync(BAK)) {
    await copyFile(GLB, BAK);
    console.log(`backed up → ${path.basename(BAK)}`);
  }

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      "draco3d.decoder": await draco3d.createDecoderModule(),
      "draco3d.encoder": await draco3d.createEncoderModule(),
    });

  const doc = await io.read(GLB);

  // Log textures before.
  for (const tex of doc.getRoot().listTextures()) {
    const size = tex.getSize();
    const bytes = tex.getImage()?.byteLength ?? 0;
    console.log(
      `  before: ${tex.getName() || "(unnamed)"} ${size?.[0]}×${size?.[1]} ` +
        `${tex.getMimeType()} ${(bytes / 1024).toFixed(0)}KB`,
    );
  }

  // Downscale (cap longest edge) + re-encode every texture to WebP via sharp.
  await doc.transform(
    textureCompress({
      encoder: sharp,
      targetFormat: "webp",
      resize: [MAX_TEXTURE_SIZE, MAX_TEXTURE_SIZE],
      quality: 80,
    }),
  );

  for (const tex of doc.getRoot().listTextures()) {
    const size = tex.getSize();
    const bytes = tex.getImage()?.byteLength ?? 0;
    console.log(
      `  after:  ${tex.getName() || "(unnamed)"} ${size?.[0]}×${size?.[1]} ` +
        `${tex.getMimeType()} ${(bytes / 1024).toFixed(0)}KB`,
    );
  }

  await io.write(GLB, doc);

  const before = (await stat(BAK)).size;
  const after = (await stat(GLB)).size;
  console.log(
    `\n${path.basename(GLB)}: ${(before / 1024 / 1024).toFixed(2)}MB → ` +
      `${(after / 1024 / 1024).toFixed(2)}MB ` +
      `(−${(100 * (1 - after / before)).toFixed(0)}%)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
