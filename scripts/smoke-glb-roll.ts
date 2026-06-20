/**
 * Smoke test for the AI roll plumbing (no network). Verifies the candidate
 * renderer differentiates orientations, the answer parser works, and chooseRoll
 * degrades gracefully without GEMINI_API_KEY.
 * Run: npx tsx scripts/smoke-glb-roll.ts
 */
import {
  renderRollCandidatesForTest,
  chooseRoll,
  parseRollAnswer,
} from "../lib/admin/glb-roll-vision";

(async () => {
  // Asymmetric face: a filled wedge (no rotational symmetry), so every roll about
  // +Z yields a distinct silhouette.
  const verts: number[][] = [];
  for (let ri = 1; ri <= 20; ri++) {
    const rr = ri * 0.0008;
    for (let ti = 0; ti <= 24; ti++) {
      const th = (ti / 24) * 2.2; // wedge spanning ~0..126°
      verts.push([rr * Math.cos(th), rr * Math.sin(th), 0.002]);
    }
  }

  const coarse = [0, 45, 90, 135, 180, 225, 270, 315];
  const imgs = await renderRollCandidatesForTest(verts, coarse);
  const distinct = new Set(imgs.map((b) => b.toString("base64"))).size;
  const parsed = parseRollAnswer("The best match is B.", 8);
  const noKey = await chooseRoll({ vertices: verts, photoUrl: "http://x", kind: "ring" });

  let fail = 0;
  const check = (n: string, ok: boolean, d = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
    if (!ok) fail++;
  };
  check("8 coarse renders", imgs.length === 8);
  check("renders differ across rolls", distinct >= 5, `distinct=${distinct}`);
  check("parseRollAnswer('B')===1", parsed === 1, `got ${parsed}`);
  check("no-key graceful {ok:false}", noKey.ok === false, noKey.note);

  console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILURE(S)"}`);
  process.exit(fail === 0 ? 0 : 1);
})();
