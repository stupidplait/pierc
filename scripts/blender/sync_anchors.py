"""
sync_anchors.py — propagate anchor empty positions from Blender to the web app.

WORKFLOW (the precise-placement loop):
  1. Open art/source/body.blend in Blender (you already have this).
  2. In the Outliner or 3D viewport, select an `anchor:*` empty.
     Tip: type 'a' in the Outliner search to filter, or expand the Empties.
  3. Move it: press G to grab, drag to the desired spot on the body surface.
     • G then X / Y / Z constrains to one axis.
     • Hold Ctrl while dragging for snap-to-grid.
     • For snap-to-face on the body mesh: enable the magnet (top of viewport)
       with snap mode = "Face Project" + snap target = "Active", then G.
  4. Save: Ctrl+S.
  5. Run THIS script:
       a. From terminal: `npm run anchors:sync`  (recommended — runs db:seed too)
       b. OR inside Blender: open the Text Editor, load this file,
          press Alt+P. Then run `npm run db:seed` yourself.
  6. Hard-reload the browser tab to bust the body.glb cache.

WHAT IT DOES
  • Reads every `anchor:<slug>` empty's world position.
  • Converts Blender (Z-up) → glTF (Y-up) coords.
  • Updates `prisma/seed-data/anchors.json` (positions + camera target;
    preserves rotation, name, place, side, fov — only the moved bits change).
  • Updates `components/scene/WireframeRoom.tsx` (CH2_VISIBLE_ANCHORS).
  • Re-exports `public/models/body/body.glb`.

It is idempotent — running it twice in a row makes no further changes.
"""

import bpy
import json
import os
import re
import sys
from pathlib import Path

# ───────────────────────────────────────────────────────────
# Project paths (resolved relative to this script's location).
HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent.parent  # scripts/blender/sync_anchors.py → repo root
ANCHORS_JSON = PROJECT_ROOT / "prisma" / "seed-data" / "anchors.json"
WIREFRAME_TSX = PROJECT_ROOT / "components" / "scene" / "WireframeRoom.tsx"
BODY_GLB = PROJECT_ROOT / "public" / "models" / "body" / "body.glb"

# ───────────────────────────────────────────────────────────
# 1. Read anchor empty positions from the current Blender scene.
# Blender world coords are Z-up. Our glTF export uses Y-up
# (export_yup=True), with the conversion: glTF.x = bl.x,
# glTF.y = bl.z, glTF.z = -bl.y. We mirror that here.

def blender_to_gltf(p):
    return {"x": round(p[0], 4), "y": round(p[2], 4), "z": round(-p[1], 4)}


anchors_in_blend = {}
for obj in bpy.data.objects:
    if obj.type == "EMPTY" and obj.name.startswith("anchor:"):
        slug = obj.name.removeprefix("anchor:")
        wp = obj.matrix_world.translation
        anchors_in_blend[slug] = blender_to_gltf((wp.x, wp.y, wp.z))

print(f"Read {len(anchors_in_blend)} anchor empties from Blender")

# ───────────────────────────────────────────────────────────
# 2. Update prisma/seed-data/anchors.json
# Preserve all existing metadata (rotation, name, place, side, fov);
# only replace position + camera target. Camera position SHIFTS by the
# same delta as the anchor, preserving any hand-tuned camera offset.

with open(ANCHORS_JSON, "r", encoding="utf-8") as f:
    anchors_doc = json.load(f)

updated_json = []
unchanged_json = []
unknown_in_blend = set(anchors_in_blend.keys())

for a in anchors_doc:
    new_pos = anchors_in_blend.get(a["slug"])
    if new_pos is None:
        # Anchor exists in DB seed but not in .blend (shouldn't happen
        # unless you removed an empty). Leave it alone.
        unchanged_json.append(a["slug"])
        continue
    unknown_in_blend.discard(a["slug"])

    old_pos = a["position"]
    delta = {
        "x": round(new_pos["x"] - old_pos["x"], 4),
        "y": round(new_pos["y"] - old_pos["y"], 4),
        "z": round(new_pos["z"] - old_pos["z"], 4),
    }

    if delta["x"] == 0.0 and delta["y"] == 0.0 and delta["z"] == 0.0:
        unchanged_json.append(a["slug"])
        continue

    a["position"] = new_pos
    for cp in a.get("cameraPresets", []):
        cp["target"] = dict(new_pos)
        cp["position"]["x"] = round(cp["position"]["x"] + delta["x"], 4)
        cp["position"]["y"] = round(cp["position"]["y"] + delta["y"], 4)
        cp["position"]["z"] = round(cp["position"]["z"] + delta["z"], 4)
    updated_json.append(a["slug"])

with open(ANCHORS_JSON, "w", encoding="utf-8") as f:
    json.dump(anchors_doc, f, indent=2, ensure_ascii=False)
    f.write("\n")

print(f"  anchors.json: {len(updated_json)} updated, {len(unchanged_json)} unchanged")
if updated_json:
    print(f"    ↳ moved: {', '.join(updated_json)}")
if unknown_in_blend:
    print(f"  WARN: {len(unknown_in_blend)} empties in .blend with no JSON entry: {sorted(unknown_in_blend)}")

# ───────────────────────────────────────────────────────────
# 3. Update components/scene/WireframeRoom.tsx CH2_VISIBLE_ANCHORS
# Format of each entry:
#   { slug: "left-ear-lobe", name: "...", position: { x: 0.075, y: 1.557, z: -0.025 }, rotation: {...} },

with open(WIREFRAME_TSX, "r", encoding="utf-8") as f:
    src = f.read()

# Pattern: match any line that has a slug AND a position object.
# We rewrite the position object only.
LINE_RE = re.compile(
    r'(\{\s*slug:\s*"(?P<slug>[\w-]+)",[^\n]*?position:\s*\{)\s*'
    r'x:\s*-?[\d.]+,\s*y:\s*-?[\d.]+,\s*z:\s*-?[\d.]+\s*'
    r'(\})',
)


def fmt_num(n):
    # Match the existing style: at most 4 decimals, no trailing zeros.
    s = f"{n:.4f}".rstrip("0").rstrip(".")
    return s if s else "0"


def repl(m):
    slug = m.group("slug")
    pos = anchors_in_blend.get(slug)
    if pos is None:
        return m.group(0)  # leave unchanged
    new_obj = f' x: {fmt_num(pos["x"])}, y: {fmt_num(pos["y"])}, z: {fmt_num(pos["z"])} '
    return m.group(1) + new_obj + m.group(3)


new_src, replacements = LINE_RE.subn(repl, src)

if replacements > 0:
    if new_src != src:
        with open(WIREFRAME_TSX, "w", encoding="utf-8") as f:
            f.write(new_src)
        print(f"  WireframeRoom.tsx: rewrote {replacements} anchor entries")
    else:
        print(f"  WireframeRoom.tsx: {replacements} entries already in sync")
else:
    print(f"  WireframeRoom.tsx: no anchor entries matched (regex may need updating)")

# ───────────────────────────────────────────────────────────
# 4. Re-export body.glb
import time

t0 = time.time()
bpy.ops.export_scene.gltf(
    filepath=str(BODY_GLB),
    export_format="GLB",
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_apply=True,
    export_yup=True,
    export_animations=False,
    export_lights=False,
    export_cameras=False,
)
print(f"  body.glb: re-exported ({os.path.getsize(BODY_GLB)/1024:.0f} KB in {time.time()-t0:.2f}s)")

# ───────────────────────────────────────────────────────────
print()
print("✓ Sync complete. Next:")
print("    npm run db:seed       # push to Postgres")
print("    Ctrl+Shift+R browser  # bust GLB cache")
