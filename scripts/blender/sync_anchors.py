"""
sync_anchors.py — propagate anchor empties from Blender to the web app, and
SEAT them correctly on the body: snap each anchor to the skin surface and derive
its rotation from the true (smoothed) surface normal.

WORKFLOW (the precise-placement loop):
  1. Open art/source/body.blend in Blender (you already have this).
  2. In the Outliner or 3D viewport, select an `anchor:*` empty.
     Tip: type 'a' in the Outliner search to filter, or expand the Empties.
  3. Move it: press G to grab, drag to roughly the desired spot on the body.
     You do NOT have to be pixel-perfect on the surface or fuss with rotation —
     this script snaps the position onto the skin and computes the rotation for
     you (post enters perpendicular to the skin).
  4. Save: Ctrl+S.
  5. Run THIS script:
       a. From terminal: `npm run anchors:sync`  (recommended — runs db:seed too)
       b. OR inside Blender: open the Text Editor, load this file,
          press Alt+P. Then run `npm run db:seed` yourself.

WHAT IT DOES
  • Reads every `anchor:<slug>` empty's world position from the .blend.
  • Re-imports the DEPLOYED `public/models/body/body.glb` and seats each anchor
    against THAT mesh — the exact geometry the renderer loads. (It does NOT
    re-export body.glb: an anchor edit doesn't change the body mesh, and the glb's
    baked empties are unused at runtime — re-exporting would only bloat the file by
    re-embedding textures uncompressed. If you ever change the BODY MESH itself,
    regenerate body.glb through its optimized export first, then run this.)
  • SNAPS each anchor's position onto the nearest skin surface (so an anchor that
    was eyeballed a few mm off — or accidentally snapped onto the hair mesh — lands
    exactly on the skin instead of floating).
  • DERIVES the post rotation so the piece's local +Z = the smoothed outward
    surface normal at that point (area-weighted over a small, adaptively-grown
    neighbourhood, so it is stable across sharp ear folds AND sparse spots like the
    ankle), in the renderer's exact three.js Euler('XYZ') convention. This replaces
    the old "rotation is hand-authored and never corrected" behaviour — the root
    cause of posts pointing at the wrong angle.
  • DERIVES the hoop orientation (`ringRotation`) so a ring HANGS (band-top up) and
    faces FRONT (+Z) — i.e. perpendicular to the body surface, the way a real hoop
    earring dangles. On the ear this is a clean circle hanging perpendicular to the
    pinna, not a ring lying flat in the ear's plane.
  • Converts Blender (Z-up) → glTF (Y-up) coords.
  • Updates `prisma/seed-data/anchors.json` (position + rotation + camera target;
    preserves name, place, side, fov, ringRotation — only the seated bits change).
  • Updates `components/scene/wireframe-room/anchors.ts` (CH2_VISIBLE_ANCHORS).

OPT-OUTS (so a deliberately hand-tuned anchor isn't "corrected" away):
  • An anchor whose `place` is internal (TONGUE) is left exactly as authored —
    its skin-surface normal is meaningless (the piece passes THROUGH the tissue).
  • Add `"lockRotation": true` to an anchor in anchors.json to keep its authored
    rotation (still snaps position). Add `"lockPosition": true` to keep position.
  • A rotation is only re-derived when the current one is more than ROT_THRESH_DEG
    off the true normal, so already-good / intentionally-close anchors are left
    byte-identical (keeps the diff + behaviour stable, and the pass idempotent).

It is idempotent — running it twice in a row makes no further changes.
"""

import bpy
import json
import math
import re
import sys
from pathlib import Path

from mathutils import Vector
from mathutils.kdtree import KDTree

# ───────────────────────────────────────────────────────────
# Project paths (resolved relative to this script's location).
HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent.parent  # scripts/blender/sync_anchors.py → repo root
ANCHORS_JSON = PROJECT_ROOT / "prisma" / "seed-data" / "anchors.json"
ANCHORS_TS = PROJECT_ROOT / "components" / "scene" / "wireframe-room" / "anchors.ts"
BODY_GLB = PROJECT_ROOT / "public" / "models" / "body" / "body.glb"

# ───────────────────────────────────────────────────────────
# Tuning.
ROT_THRESH_DEG = 12.0     # only re-derive rotation when current is >this off normal
RING_THRESH_DEG = 12.0    # only re-derive ringRotation when current faces >this off-camera
POS_THRESH_M = 0.0015     # only re-snap position when floating >1.5 mm off the skin
MAX_SNAP_M = 0.015        # never yank an anchor more than 15 mm (defensive)
SMOOTH_RADII = (0.004, 0.006, 0.008, 0.010, 0.012)  # grow the smoothing radius…
MIN_FACES = 6             # …until ≥ this many faces are averaged. Starting small
                          # keeps curved spots (ear folds) local; growing only when
                          # too few faces are in range stabilises sparse spots (the
                          # ankle/hip have ~1 face at 4 mm → a single noisy normal).
# Anchors whose jewellery passes THROUGH the tissue rather than seating ON it —
# the nearest-skin normal is meaningless, so leave them exactly as authored.
INTERNAL_PLACES = {"TONGUE"}
# Mesh-name fragments that are NOT skin (so we never snap an anchor onto hair etc.)
NON_SKIN = ("hair", "underwear", "teeth", "eye", "lash", "cornea", "nail", "cloth", "wear")

# ───────────────────────────────────────────────────────────
# Coordinate conversion. Blender world coords are Z-up; body.glb is Y-up
# (export_yup), with glTF.x = bl.x, glTF.y = bl.z, glTF.z = -bl.y. This holds for
# both points and directions (it's a pure rotation, no offset).

def blender_to_gltf(p, nd=4):
    return {"x": round(p[0], nd), "y": round(p[2], nd), "z": round(-p[1], nd)}

def b2g_dir(v):
    return Vector((v.x, v.z, -v.y))

def clean(v, nd=5):
    r = round(v, nd)
    return int(r) if r == int(r) else r

# ───────────────────────────────────────────────────────────
# Skin surface model: every mesh that isn't hair/eyes/teeth/clothing. We build a
# face cache (world space) + a KDTree of face centres so we can snap and read
# normals against the exact geometry the renderer loads (the imported body.glb).

def skin_meshes(objs):
    return [
        o for o in objs
        if o.type == "MESH" and not any(k in o.name.lower() for k in NON_SKIN)
    ]

def build_cache(meshes):
    cen, nrm, ar = [], [], []
    for o in meshes:
        mw = o.matrix_world
        nmat = mw.inverted().transposed().to_3x3()
        for p in o.data.polygons:
            cen.append(mw @ p.center)
            nrm.append((nmat @ p.normal).normalized())
            ar.append(p.area)
    kd = KDTree(len(cen))
    for i, c in enumerate(cen):
        kd.insert(c, i)
    kd.balance()
    return {"meshes": meshes, "kd": kd, "cen": cen, "nrm": nrm, "ar": ar}

def closest_surface(cache, world_pt):
    """Nearest point on any cached skin mesh → (dist, location_world, face_normal_world)."""
    best = None
    for o in cache["meshes"]:
        mw = o.matrix_world
        ok, loc, n, idx = o.closest_point_on_mesh(mw.inverted() @ world_pt)
        if not ok:
            continue
        wl = mw @ loc
        d = (world_pt - wl).length
        if best is None or d < best[0]:
            nrm = (mw.inverted().transposed().to_3x3() @ n).normalized()
            best = (d, wl, nrm)
    return best

def smooth_normal(cache, loc_w, face_n):
    """Area-weighted average of nearby face normals, stable across the sharp folds
    of the ear (where a single face normal is discontinuous) AND across sparse
    regions like the ankle (where the smallest radius captures one noisy face).
    The radius grows through SMOOTH_RADII only until MIN_FACES faces are averaged,
    so dense/curved spots stay local while sparse spots get a stable sample."""
    kd, NRM, AR = cache["kd"], cache["nrm"], cache["ar"]
    best = None
    for R in SMOOTH_RADII:
        acc = Vector((0.0, 0.0, 0.0))
        tot = 0.0
        n = 0
        for (co, idx, dist) in kd.find_range(loc_w, R):
            w = AR[idx] * (1.0 - dist / R)
            acc += NRM[idx] * w
            tot += w
            n += 1
        if tot > 0.0:
            best = (acc / tot).normalized()
            if n >= MIN_FACES:
                break
    if best is None:
        return face_n
    return best if best.dot(face_n) > 0.0 else face_n

# ───────────────────────────────────────────────────────────
# Rotation derivation. Build a frame whose local +Z = outward normal and local
# +Y = world-up projected into the tangent plane (decorative top points up), then
# convert to a three.js Euler('XYZ') so it round-trips through the renderer's
# `new Euler(x, y, z, "XYZ")` exactly.

def _mat_to_euler_xyz(R):  # three.js Euler.setFromRotationMatrix, order 'XYZ'
    m11, m12, m13 = R[0]
    m21, m22, m23 = R[1]
    m31, m32, m33 = R[2]
    y = math.asin(max(-1.0, min(1.0, m13)))
    if abs(m13) < 0.9999999:
        x = math.atan2(-m23, m33)
        z = math.atan2(-m12, m11)
    else:
        x = math.atan2(m32, m22)
        z = 0.0
    return (x, y, z)

def _euler_xyz_outz(x, y, z):  # three.js makeRotationFromEuler('XYZ') · (0,0,1)
    s1, c1 = math.sin(x), math.cos(x)
    s2, c2 = math.sin(y), math.cos(y)
    return Vector((s2, -c2 * s1, c1 * c2))

def derive_rotation(normal_world):
    """(euler_xyz, outward_dir_gltf) for a piece whose +Z should follow `normal_world`."""
    zc = b2g_dir(normal_world).normalized()
    up = Vector((0.0, 1.0, 0.0))
    if abs(zc.dot(up)) > 0.95:  # normal ~vertical → no lateral up cue
        up = Vector((0.0, 0.0, 1.0))
    yc = (up - zc * up.dot(zc)).normalized()
    xc = yc.cross(zc).normalized()
    R = [[xc.x, yc.x, zc.x], [xc.y, yc.y, zc.y], [xc.z, yc.z, zc.z]]
    return _mat_to_euler_xyz(R), zc

def rotation_error_deg(rot, out_gltf):
    oz = _euler_xyz_outz(rot["x"], rot["y"], rot["z"]).normalized()
    return math.degrees(math.acos(max(-1.0, min(1.0, oz.dot(out_gltf)))))

# ───────────────────────────────────────────────────────────
# 1. Read anchor empty world positions from the current (.blend) scene.
empties = {}
for obj in bpy.data.objects:
    if obj.type == "EMPTY" and obj.name.startswith("anchor:"):
        empties[obj.name.removeprefix("anchor:")] = obj
print(f"Read {len(empties)} anchor empties from Blender")

# ───────────────────────────────────────────────────────────
# 2. Re-import the DEPLOYED body.glb and seat every anchor against it.
if not BODY_GLB.exists():
    print(f"ERROR: {BODY_GLB} not found.")
    sys.exit(1)
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(BODY_GLB))
bpy.context.view_layer.update()
imported = [o for o in bpy.data.objects if o not in before]
glb_cache = build_cache(skin_meshes(imported))
if not glb_cache["cen"]:
    print("ERROR: imported body.glb has no skin mesh.")
    sys.exit(1)
print(f"Skin meshes (from body.glb): {', '.join(o.name for o in glb_cache['meshes'])}")

with open(ANCHORS_JSON, "r", encoding="utf-8") as f:
    anchors_doc = json.load(f)

final_pos_gltf = {}
moved_pos, fixed_rot, kept = [], [], []
unknown_in_blend = set(empties.keys())

for a in anchors_doc:
    slug = a["slug"]
    obj = empties.get(slug)
    final_pos_gltf[slug] = a["position"]
    if obj is None:
        continue
    unknown_in_blend.discard(slug)

    hit = closest_surface(glb_cache, obj.matrix_world.translation.copy())
    internal = (a.get("place") in INTERNAL_PLACES) or (hit is None)
    if internal:
        kept.append(slug)
        continue
    dist, loc_w, face_n = hit

    # ── position: snap onto the deployed (glb) surface.
    if a.get("lockPosition") is not True and POS_THRESH_M < dist < MAX_SNAP_M:
        new_pos = blender_to_gltf(loc_w)
        old_pos = a["position"]
        dx = round(new_pos["x"] - old_pos["x"], 4)
        dy = round(new_pos["y"] - old_pos["y"], 4)
        dz = round(new_pos["z"] - old_pos["z"], 4)
        if (dx, dy, dz) != (0.0, 0.0, 0.0):
            a["position"] = new_pos
            for cp in a.get("cameraPresets", []):
                if cp.get("target") is not None:
                    cp["target"] = dict(new_pos)
                if cp.get("position") is not None:
                    cp["position"]["x"] = round(cp["position"]["x"] + dx, 4)
                    cp["position"]["y"] = round(cp["position"]["y"] + dy, 4)
                    cp["position"]["z"] = round(cp["position"]["z"] + dz, 4)
            moved_pos.append(slug)
        final_pos_gltf[slug] = a["position"]

    # ── rotation: derive from the smoothed normal of the deployed (glb) surface.
    if a.get("lockRotation") is True:
        kept.append(slug)
        continue
    sn = smooth_normal(glb_cache, loc_w, face_n)
    (ex, ey, ez), out_gltf = derive_rotation(sn)
    if rotation_error_deg(a["rotation"], out_gltf) > ROT_THRESH_DEG:
        a["rotation"] = {"x": clean(ex), "y": clean(ey), "z": clean(ez)}
        fixed_rot.append(slug)
    else:
        kept.append(slug)

# ── ringRotation pass: orient a HOOP to hang (band-top up) and FACE the anchor's
# catalog camera, so on a laterally-viewed anchor (the whole ear family) a hoop
# reads as a clean circle instead of edge-on. Pure data (camera preset + anchor
# position) — no mesh needed. Front-viewed anchors already face their camera, so
# the threshold leaves them untouched; only the lateral ones (ear/hip/ankle) move.
WORLD_FORWARD = (0.0, 0.0, 1.0)
fixed_ring = []
for a in anchors_doc:
    if a.get("place") in INTERNAL_PLACES or a.get("lockRingRotation") is True:
        continue
    # A hoop hangs FRONT-FACING (perpendicular to the body surface, like a real
    # earring): hole-axis = world FRONT (+Z), band-top = world up. On the ear this
    # is a circle dangling perpendicular to the pinna — NOT a ring lying flat in the
    # ear's plane (which is what an earlier "face the lateral camera" attempt did,
    # making ear hoops read as running ALONG the ear).
    zc = Vector(WORLD_FORWARD)                              # world front (+Z)
    xc = Vector((0.0, 1.0, 0.0)).cross(zc).normalized()
    yc = zc.cross(xc).normalized()
    rex, rey, rez = _mat_to_euler_xyz([[xc.x, yc.x, zc.x], [xc.y, yc.y, zc.y], [xc.z, yc.z, zc.z]])
    cur = a.get("ringRotation")
    if cur is not None:
        ch = _euler_xyz_outz(cur["x"], cur["y"], cur["z"])
        ch = Vector((ch.x, 0.0, ch.z))
        if ch.length > 1e-6 and math.degrees(math.acos(max(-1.0, min(1.0, ch.normalized().dot(zc))))) <= RING_THRESH_DEG:
            continue  # already hangs front-facing
    a["ringRotation"] = {"x": clean(rex), "y": clean(rey), "z": clean(rez)}
    fixed_ring.append(a["slug"])

# Clean up the re-imported glb copy (meshes + its baked anchor empties).
for o in imported:
    try:
        bpy.data.objects.remove(o, do_unlink=True)
    except Exception:
        pass

with open(ANCHORS_JSON, "w", encoding="utf-8") as f:
    json.dump(anchors_doc, f, indent=2, ensure_ascii=False)
    f.write("\n")

print(f"  anchors.json: {len(moved_pos)} re-snapped, {len(fixed_rot)} re-oriented (post), {len(fixed_ring)} re-faced (hoop), {len(kept)} kept")
if moved_pos:
    print(f"    ↳ snapped: {', '.join(moved_pos)}")
if fixed_rot:
    print(f"    ↳ re-oriented (post normal): {', '.join(fixed_rot)}")
if fixed_ring:
    print(f"    ↳ re-faced (hoop→front): {', '.join(fixed_ring)}")
if unknown_in_blend:
    print(f"  WARN: {len(unknown_in_blend)} empties in .blend with no JSON entry: {sorted(unknown_in_blend)}")

# ───────────────────────────────────────────────────────────
# 3. Update components/scene/wireframe-room/anchors.ts CH2_VISIBLE_ANCHORS
# (positions only — the wireframe room doesn't consume per-anchor rotation).
with open(ANCHORS_TS, "r", encoding="utf-8") as f:
    src = f.read()

LINE_RE = re.compile(
    r'(\{\s*slug:\s*"(?P<slug>[\w-]+)",[^\n]*?position:\s*\{)\s*'
    r'x:\s*-?[\d.]+,\s*y:\s*-?[\d.]+,\s*z:\s*-?[\d.]+\s*'
    r'(\})',
)

def fmt_num(n):
    s = f"{n:.4f}".rstrip("0").rstrip(".")
    return s if s else "0"

def repl(m):
    slug = m.group("slug")
    pos = final_pos_gltf.get(slug)
    if pos is None:
        return m.group(0)
    new_obj = f' x: {fmt_num(pos["x"])}, y: {fmt_num(pos["y"])}, z: {fmt_num(pos["z"])} '
    return m.group(1) + new_obj + m.group(3)

new_src, replacements = LINE_RE.subn(repl, src)
if replacements > 0 and new_src != src:
    with open(ANCHORS_TS, "w", encoding="utf-8") as f:
        f.write(new_src)
    print(f"  anchors.ts: rewrote {replacements} anchor entries")
elif replacements > 0:
    print(f"  anchors.ts: {replacements} entries already in sync")
else:
    print("  anchors.ts: no anchor entries matched (regex may need updating)")

# ───────────────────────────────────────────────────────────
print()
print("✓ Sync complete. Next:")
print("    npm run db:seed       # push to Postgres")
