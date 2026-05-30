// scripts/anchors/run-sync.mjs
//
// Wraps the full anchor-sync pipeline behind a single command:
//   1. Find the Blender executable (env BLENDER_EXE, then common paths).
//   2. Launch headless Blender to run scripts/blender/sync_anchors.py
//      against art/source/body.blend.
//   3. Run `npm run db:seed` to push the new positions to Postgres.
//
// USAGE:
//   npm run anchors:sync
//
// PREREQS:
//   • You've SAVED the .blend in Blender (Ctrl+S) so on-disk state matches
//     what's in your Blender session.
//   • Blender ≥ 4.0 is installed.

import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import os from "node:os";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w):/, "$1:"), "..", "..");
const BLEND_FILE = path.join(ROOT, "art", "source", "body.blend");
const SYNC_SCRIPT = path.join(ROOT, "scripts", "blender", "sync_anchors.py");

// ── 1. Locate Blender ────────────────────────────────────────
function findBlender() {
  if (process.env.BLENDER_EXE && existsSync(process.env.BLENDER_EXE)) {
    return process.env.BLENDER_EXE;
  }

  const isWin = process.platform === "win32";
  const candidates = isWin
    ? [
        // Most-recent first — installed under Program Files
        "C:\\Program Files\\Blender Foundation\\Blender 5.0\\blender.exe",
        "C:\\Program Files\\Blender Foundation\\Blender 4.4\\blender.exe",
        "C:\\Program Files\\Blender Foundation\\Blender 4.3\\blender.exe",
        "C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe",
        "C:\\Program Files\\Blender Foundation\\Blender 4.1\\blender.exe",
        "C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe",
      ]
    : [
        "/Applications/Blender.app/Contents/MacOS/Blender",
        "/usr/bin/blender",
        "/usr/local/bin/blender",
      ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  // Fallback for Windows: scan ~/Downloads for portable extracted Blenders.
  // Pattern: blender-X.Y.Z-...windows.amd64.../blender-X.Y.Z-.../blender.exe
  if (isWin) {
    const downloads = path.join(os.homedir(), "Downloads");
    const found = scanForBlender(downloads, 3);
    if (found) return found;
  }

  return null;
}

function scanForBlender(dir, depth) {
  if (depth < 0 || !existsSync(dir)) return null;
  try {
    const entries = readdirSync(dir);
    // Try direct hit first
    const exe = path.join(dir, "blender.exe");
    if (existsSync(exe)) {
      try {
        if (statSync(exe).isFile()) return exe;
      } catch {}
    }
    // Recurse into blender-named subdirs first (faster), then any subdir
    const sorted = entries.sort((a, b) => {
      const aMatch = /blender/i.test(a);
      const bMatch = /blender/i.test(b);
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return 0;
    });
    for (const name of sorted) {
      const sub = path.join(dir, name);
      try {
        if (!statSync(sub).isDirectory()) continue;
      } catch {
        continue;
      }
      const r = scanForBlender(sub, depth - 1);
      if (r) return r;
    }
  } catch {}
  return null;
}

const BLENDER = findBlender();
if (!BLENDER) {
  console.error("❌ Could not find Blender executable.");
  console.error("   Set the BLENDER_EXE environment variable to its full path:");
  console.error('     PowerShell:  $env:BLENDER_EXE = "C:\\Path\\To\\Blender\\blender.exe"');
  console.error("   Then re-run: npm run anchors:sync");
  process.exit(1);
}

if (!existsSync(BLEND_FILE)) {
  console.error(`❌ Blend file not found: ${BLEND_FILE}`);
  process.exit(1);
}
if (!existsSync(SYNC_SCRIPT)) {
  console.error(`❌ Sync script not found: ${SYNC_SCRIPT}`);
  process.exit(1);
}

console.log(`Using Blender: ${BLENDER}`);
console.log(`Reading:       ${BLEND_FILE}`);
console.log(`Running:       ${SYNC_SCRIPT}`);
console.log("");

// ── 2. Run Blender headless ──────────────────────────────────
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    // On Windows, .cmd and .bat shims need shell:true for spawn to find them.
    const isWinShim = process.platform === "win32" && /\.(cmd|bat)$/i.test(cmd);
    const p = spawn(cmd, args, {
      stdio: "inherit",
      shell: isWinShim,
      ...opts,
    });
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
    p.on("error", reject);
  });
}

try {
  await run(BLENDER, ["--background", BLEND_FILE, "--python", SYNC_SCRIPT]);
} catch (e) {
  console.error(`\n❌ Blender sync failed: ${e.message}`);
  console.error("   Make sure you've saved the .blend in your open Blender session (Ctrl+S).");
  process.exit(1);
}

// ── 3. Re-seed Postgres ──────────────────────────────────────
console.log("\n→ Running db:seed…");
const isWin = process.platform === "win32";
try {
  await run(isWin ? "npm.cmd" : "npm", ["run", "db:seed"], { cwd: ROOT });
} catch (e) {
  console.error(`\n❌ db:seed failed: ${e.message}`);
  process.exit(1);
}

console.log("\n✓ Done. Hard-reload the browser tab (Ctrl+Shift+R) to bust the body.glb cache.");
