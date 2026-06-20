/**
 * Smoke test for setGlbAttachPoint: a mesh-less attach:primary node must SURVIVE
 * the meshopt re-encode + write/read round-trip (the helper deliberately skips
 * prune, which would delete it). Run: npx tsx scripts/smoke-glb-attach.ts
 */
import { NodeIO, Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { setGlbAttachPoint } from "../lib/admin/glb-pipeline";

(async () => {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });

  // Minimal indexed triangle mesh, no attach node.
  const doc = new Document();
  const buf = doc.createBuffer();
  const pos = doc
    .createAccessor()
    .setType("VEC3")
    .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
    .setBuffer(buf);
  const idx = doc
    .createAccessor()
    .setType("SCALAR")
    .setArray(new Uint32Array([0, 1, 2]))
    .setBuffer(buf);
  const prim = doc.createPrimitive().setAttribute("POSITION", pos).setIndices(idx);
  const mesh = doc.createMesh().addPrimitive(prim);
  const scene = doc.createScene().addChild(doc.createNode().setMesh(mesh));
  doc.getRoot().setDefaultScene(scene);
  const bytes = await io.writeBinary(doc);

  const P: [number, number, number] = [0.123, -0.045, 0.0067];
  const out = await setGlbAttachPoint(bytes, P);

  // Read back and find attach:primary.
  const rt = await io.readBinary(out);
  const node = rt.getRoot().listNodes().find((n) => n.getName() === "attach:primary");
  let fail = 0;
  const check = (n: string, ok: boolean, d = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
    if (!ok) fail++;
  };
  check("attach:primary node survives round-trip", !!node);
  if (node) {
    const t = node.getTranslation();
    const close = t.every((v, i) => Math.abs(v - P[i]) < 1e-4);
    check("translation matches picked point", close, `[${t.map((v) => v.toFixed(4)).join(", ")}]`);
  }
  // Idempotent update: calling again should MOVE the same node, not add a second.
  const out2 = await setGlbAttachPoint(out, [0, 0.5, 0]);
  const rt2 = await io.readBinary(out2);
  const attaches = rt2.getRoot().listNodes().filter((n) => n.getName() === "attach:primary");
  check("re-pick updates in place (single node)", attaches.length === 1, `count=${attaches.length}`);

  console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILURE(S)"}`);
  process.exit(fail === 0 ? 0 : 1);
})();
