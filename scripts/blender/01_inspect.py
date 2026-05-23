"""Task 1 — Inspect the loaded .blend and write a snapshot under art/inspect/.

Outputs:
  art/inspect/scene.json       — full machine-readable inventory.
  art/inspect/scene.md         — human-readable one-page summary.
  art/inspect/landmarks.json   — body bbox + shoulder/hip baselines + body mesh names,
                                 consumed by Tasks 2, 4, 5, 6.

The script is non-destructive: read-only on the scene.
"""

from __future__ import annotations

import sys
import os

# Make _helpers importable when this file is exec'd via execute_blender_code.
HELPERS_DIR = r"C:\Users\rusya\Desktop\pierc\scripts\blender"
if HELPERS_DIR not in sys.path:
    sys.path.insert(0, HELPERS_DIR)

import bpy  # noqa: E402

from _helpers import (  # noqa: E402
    bbox_world,
    dump_json,
    repo_path,
    tri_count,
    union_bbox,
    vert_count,
    world_xyz,
    write_text,
)


# ───── Body-mesh detection heuristics ─────
# Common conventions: CC3 / Character Creator → "CC_Base_Body", "CC_Game_Body".
# Generic conventions: "Body", "body", "SkinBody". Avoid hair/clothes/eyelash/teeth.

BODY_NAME_HINTS = (
    "cc_base_body",
    "cc_game_body",
    "skinbody",
    "basebody",
    "body",
)
NON_BODY_NAME_HINTS = (
    "hair", "eyelash", "eyebrow_mesh", "tearline", "occlusion",
    "tongue", "teeth", "eye", "cornea", "iris",
    "bra", "shirt", "pants", "shoes", "sock", "underwear",
    "clothes", "cloth", "outfit", "accessory", "earring", "jewelry",
    "nail",
)


def is_likely_body(name: str) -> bool:
    """Heuristic: name strongly suggests this mesh is THE body skin."""
    n = name.lower()
    if any(bad in n for bad in NON_BODY_NAME_HINTS):
        return False
    return any(hint in n for hint in BODY_NAME_HINTS)


def is_excluded(name: str) -> bool:
    """Heuristic: name strongly suggests this is NOT the body skin."""
    n = name.lower()
    return any(bad in n for bad in NON_BODY_NAME_HINTS)


# ───── Inventory walkers ─────


def collect_objects() -> list[dict]:
    rows = []
    for obj in bpy.data.objects:
        row = {
            "name": obj.name,
            "type": obj.type,
            "parent": obj.parent.name if obj.parent else None,
            "hidden_viewport": obj.hide_viewport,
            "hidden_render": obj.hide_render,
            "world_loc": world_xyz(obj),
            "collections": [c.name for c in obj.users_collection],
        }
        if obj.type == "MESH":
            row.update({
                "verts": vert_count(obj),
                "tris": tri_count(obj),
                "bbox": bbox_world(obj),
                "modifiers": [
                    {"name": m.name, "type": m.type} for m in obj.modifiers
                ],
                "materials": [
                    s.material.name if s.material else None
                    for s in obj.material_slots
                ],
                "shape_keys": (
                    [k.name for k in obj.data.shape_keys.key_blocks]
                    if obj.data and obj.data.shape_keys else []
                ),
                "armature_modifier_target": next(
                    (m.object.name for m in obj.modifiers
                     if m.type == "ARMATURE" and m.object),
                    None,
                ),
            })
        rows.append(row)
    return rows


def collect_collections() -> list[dict]:
    rows = []
    for coll in bpy.data.collections:
        rows.append({
            "name": coll.name,
            "objects": [o.name for o in coll.objects],
            "children": [c.name for c in coll.children],
        })
    return rows


def collect_armatures() -> list[dict]:
    rows = []
    for arm in bpy.data.armatures:
        users = [o.name for o in bpy.data.objects if o.data == arm]
        rows.append({
            "name": arm.name,
            "bone_count": len(arm.bones),
            "object_users": users,
        })
    return rows


def collect_materials() -> list[dict]:
    rows = []
    for mat in bpy.data.materials:
        image_refs = []
        if mat.use_nodes and mat.node_tree:
            for node in mat.node_tree.nodes:
                if node.type == "TEX_IMAGE" and node.image:
                    image_refs.append(node.image.name)
        rows.append({
            "name": mat.name,
            "use_nodes": mat.use_nodes,
            "images": image_refs,
        })
    return rows


def collect_images() -> list[dict]:
    rows = []
    for img in bpy.data.images:
        rows.append({
            "name": img.name,
            "size": list(img.size),
            "filepath": img.filepath,
            "packed": bool(img.packed_file),
        })
    return rows


# ───── Body candidate selection ─────


def pick_body_candidates(objects: list[dict]) -> dict:
    """Return body-mesh selection: confident match if any name hint hits,
    otherwise rank meshes by tri count and exclude non-body names.
    """
    meshes = [o for o in objects if o["type"] == "MESH"]
    confident = [o for o in meshes if is_likely_body(o["name"])]
    excluded = [o for o in meshes if is_excluded(o["name"])]

    # Rank fallback candidates by tri count (largest first), excluding
    # name-blacklisted meshes.
    fallback_pool = [o for o in meshes if not is_excluded(o["name"])]
    fallback_pool.sort(key=lambda o: o.get("tris", 0), reverse=True)

    return {
        "confident": [o["name"] for o in confident],
        "excluded": [o["name"] for o in excluded],
        "ranked_fallback": [
            {"name": o["name"], "tris": o.get("tris", 0)}
            for o in fallback_pool[:10]
        ],
    }


# ───── Landmark estimation ─────


def estimate_landmarks(body_bbox: dict, scene_unit: str) -> dict:
    """Compute shoulder and hip Y baselines from a body bbox.

    The body model is in Blender's Z-up world (vertical = Z). Heights:
      - shoulder ≈ top - 0.25 * height
      - hip      ≈ top - 0.55 * height
    Stored as Z values to match the world axis. Tasks 4–6 trim along Z.
    """
    z_min, z_max = body_bbox["min"][2], body_bbox["max"][2]
    height = z_max - z_min
    shoulder_z = z_max - 0.25 * height
    hip_z = z_max - 0.55 * height
    return {
        "axis_up": "Z",
        "scene_unit_system": scene_unit,
        "body_bbox_world": body_bbox,
        "body_height_m": round(height, 4),
        "shoulder_z": round(shoulder_z, 4),
        "hip_z": round(hip_z, 4),
        "head_band": [round(shoulder_z, 4), round(z_max, 4)],
        "torso_band": [round(hip_z, 4), round(shoulder_z, 4)],
        "other_band": [round(z_min, 4), round(hip_z, 4)],
    }


# ───── Markdown summary ─────


def _fmt_xyz(v):
    if v is None:
        return "—"
    return f"({v[0]:+.3f}, {v[1]:+.3f}, {v[2]:+.3f})"


def render_markdown(scene: dict) -> str:
    parts = []
    parts.append(f"# Scene snapshot — `{scene['blend_filepath']}`\n")
    parts.append(
        f"Blender {scene['blender_version']} · "
        f"unit system `{scene['scene']['unit_system']}` · "
        f"length unit `{scene['scene']['length_unit']}` · "
        f"axis up `Z` (Blender default)\n"
    )

    parts.append("## Totals\n")
    parts.append(
        f"- Objects: **{scene['totals']['objects']}** "
        f"({scene['totals']['meshes']} meshes, "
        f"{scene['totals']['armatures']} armatures, "
        f"{scene['totals']['lights']} lights, "
        f"{scene['totals']['cameras']} cameras, "
        f"{scene['totals']['empties']} empties, "
        f"{scene['totals']['other']} other)"
    )
    parts.append(f"- Total scene tris (eval): **{scene['totals']['tris']:,}**")
    parts.append(f"- Materials: {scene['totals']['materials']}")
    parts.append(f"- Images: {scene['totals']['images']}")
    parts.append("")

    parts.append("## Top 15 meshes by tri count\n")
    parts.append("| Mesh | Tris | Verts | Hidden | Modifiers |")
    parts.append("|---|---:|---:|---|---|")
    meshes = [o for o in scene["objects"] if o["type"] == "MESH"]
    meshes.sort(key=lambda o: o.get("tris", 0), reverse=True)
    for m in meshes[:15]:
        mods = ", ".join(f"{x['type']}" for x in m.get("modifiers", [])) or "—"
        hidden = "✓" if m["hidden_viewport"] else ""
        parts.append(
            f"| `{m['name']}` | {m['tris']:,} | {m['verts']:,} | {hidden} | {mods} |"
        )
    parts.append("")

    parts.append("## Body candidate selection\n")
    bc = scene["body_candidates"]
    if bc["confident"]:
        parts.append(f"- **Confident match (by name hint):** {', '.join(f'`{n}`' for n in bc['confident'])}")
    else:
        parts.append("- **Confident match:** none — falling back to largest non-clothes mesh")
    parts.append("")
    parts.append("**Top fallback candidates (largest non-blacklisted meshes):**\n")
    parts.append("| Name | Tris |")
    parts.append("|---|---:|")
    for c in bc["ranked_fallback"]:
        parts.append(f"| `{c['name']}` | {c['tris']:,} |")
    parts.append("")
    if bc["excluded"]:
        parts.append(f"\n*Excluded by name (clothes/hair/eyes/teeth/accessories): {len(bc['excluded'])} meshes — `{'`, `'.join(bc['excluded'][:8])}`{'...' if len(bc['excluded']) > 8 else ''}.*\n")

    parts.append("## Landmarks (Z-axis baselines)\n")
    lm = scene.get("landmarks")
    if lm:
        bb = lm["body_bbox_world"]
        parts.append(f"- Body bbox world: min `{_fmt_xyz(bb['min'])}`  max `{_fmt_xyz(bb['max'])}`  dims `{_fmt_xyz(bb['dims'])}`")
        parts.append(f"- Body height: **{lm['body_height_m']} m**")
        parts.append(f"- Shoulder Z: **{lm['shoulder_z']}**  ·  Hip Z: **{lm['hip_z']}**")
        parts.append(f"- Region trim bands (Z):")
        parts.append(f"  - HEAD  `[{lm['head_band'][0]}, {lm['head_band'][1]}]`")
        parts.append(f"  - TORSO `[{lm['torso_band'][0]}, {lm['torso_band'][1]}]`")
        parts.append(f"  - OTHER `[{lm['other_band'][0]}, {lm['other_band'][1]}]`")
    else:
        parts.append("- *Landmarks not computed (no body candidate found).*")
    parts.append("")

    parts.append("## Armatures\n")
    if scene["armatures"]:
        for a in scene["armatures"]:
            parts.append(f"- `{a['name']}` — {a['bone_count']} bones — used by: {', '.join(f'`{u}`' for u in a['object_users'])}")
    else:
        parts.append("- (none)")
    parts.append("")

    parts.append("## Collections\n")
    for c in scene["collections"]:
        parts.append(f"- `{c['name']}` — {len(c['objects'])} objects, {len(c['children'])} child collections")
    parts.append("")

    parts.append("## Images (textures)\n")
    parts.append(f"- {scene['totals']['images']} images, total est. {scene['totals'].get('image_pixels', 0):,} px²")
    return "\n".join(parts) + "\n"


# ───── Entry point ─────


def main() -> dict:
    objects = collect_objects()
    collections = collect_collections()
    armatures = collect_armatures()
    materials = collect_materials()
    images = collect_images()
    body_candidates = pick_body_candidates(objects)

    type_counts = {"MESH": 0, "ARMATURE": 0, "LIGHT": 0, "CAMERA": 0, "EMPTY": 0, "OTHER": 0}
    total_tris = 0
    for o in objects:
        type_counts[o["type"] if o["type"] in type_counts else "OTHER"] += 1
        if o["type"] == "MESH":
            total_tris += o.get("tris", 0)

    image_pixels = sum(max(1, img["size"][0]) * max(1, img["size"][1]) for img in images)

    # Pick the body bbox: prefer confident match, else top fallback that isn't suspiciously small.
    body_obj_name = None
    if body_candidates["confident"]:
        body_obj_name = body_candidates["confident"][0]
    elif body_candidates["ranked_fallback"]:
        body_obj_name = body_candidates["ranked_fallback"][0]["name"]
    body_bbox = None
    if body_obj_name:
        body_obj = bpy.data.objects.get(body_obj_name)
        if body_obj is not None:
            body_bbox = bbox_world(body_obj)

    landmarks = None
    if body_bbox:
        landmarks = estimate_landmarks(body_bbox, bpy.context.scene.unit_settings.system)

    scene_data = {
        "blender_version": bpy.app.version_string,
        "blend_filepath": bpy.data.filepath,
        "scene": {
            "name": bpy.context.scene.name,
            "unit_system": bpy.context.scene.unit_settings.system,
            "length_unit": bpy.context.scene.unit_settings.length_unit,
            "scale_length": bpy.context.scene.unit_settings.scale_length,
        },
        "totals": {
            "objects": len(objects),
            "meshes": type_counts["MESH"],
            "armatures": type_counts["ARMATURE"],
            "lights": type_counts["LIGHT"],
            "cameras": type_counts["CAMERA"],
            "empties": type_counts["EMPTY"],
            "other": type_counts["OTHER"],
            "tris": total_tris,
            "materials": len(materials),
            "images": len(images),
            "image_pixels": image_pixels,
        },
        "objects": objects,
        "collections": collections,
        "armatures": armatures,
        "materials": materials,
        "images": images,
        "body_candidates": body_candidates,
        "body_object_used_for_landmarks": body_obj_name,
        "landmarks": landmarks,
    }

    dump_json(repo_path("art", "inspect", "scene.json"), scene_data)
    write_text(repo_path("art", "inspect", "scene.md"), render_markdown(scene_data))

    if landmarks:
        landmarks_doc = {
            "body_object": body_obj_name,
            "axis_up": "Z",
            **landmarks,
        }
        dump_json(repo_path("art", "inspect", "landmarks.json"), landmarks_doc)

    print("=" * 60)
    print(f"INSPECT DONE — Blender {bpy.app.version_string}")
    print(f"  blend: {bpy.data.filepath or '(unsaved)'}")
    print(f"  objects: {len(objects)} ({type_counts['MESH']} meshes, "
          f"{type_counts['ARMATURE']} armatures, {type_counts['LIGHT']} lights)")
    print(f"  total tris (eval): {total_tris:,}")
    print(f"  body candidate: {body_obj_name}")
    if landmarks:
        print(f"  body height: {landmarks['body_height_m']} m  ·  "
              f"shoulder Z={landmarks['shoulder_z']}  ·  hip Z={landmarks['hip_z']}")
    print("  wrote: art/inspect/scene.json, scene.md, landmarks.json")
    print("=" * 60)
    return scene_data


main()
