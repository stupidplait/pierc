"""Shared helpers for Blender pipeline scripts.

These run inside the Blender Python interpreter, sent through the
`blender-mcp` MCP server's `execute_blender_code` tool. Do not run them
with system Python — they need `bpy`, `mathutils`, and a live scene.
"""

from __future__ import annotations

import json
import os
from typing import Any

import bpy
import mathutils


REPO_ROOT = r"C:\Users\rusya\Desktop\pierc"


def repo_path(*parts: str) -> str:
    """Join paths under the project root using OS-native separators."""
    return os.path.join(REPO_ROOT, *parts)


def ensure_dir(path: str) -> None:
    """Create the directory holding `path` if missing."""
    os.makedirs(os.path.dirname(path), exist_ok=True)


def dump_json(path: str, obj: Any) -> None:
    """Write `obj` as UTF-8 JSON with 2-space indent. Creates parent dirs."""
    ensure_dir(path)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=2, ensure_ascii=False)


def write_text(path: str, text: str) -> None:
    """Write a UTF-8 text file. Creates parent dirs."""
    ensure_dir(path)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)


def tri_count(obj: bpy.types.Object) -> int:
    """Evaluated triangle count for a mesh object (after modifiers).

    Returns 0 for non-mesh objects.
    """
    if obj.type != "MESH":
        return 0
    deps = bpy.context.evaluated_depsgraph_get()
    obj_eval = obj.evaluated_get(deps)
    mesh = obj_eval.to_mesh()
    try:
        mesh.calc_loop_triangles()
        return len(mesh.loop_triangles)
    finally:
        obj_eval.to_mesh_clear()


def vert_count(obj: bpy.types.Object) -> int:
    """Vertex count of the un-evaluated mesh data (cheap)."""
    if obj.type != "MESH" or obj.data is None:
        return 0
    return len(obj.data.vertices)


def bbox_world(obj: bpy.types.Object) -> dict[str, list[float]] | None:
    """World-space axis-aligned bounding box for an object.

    Returns dict with min, max, dims, center (each a [x,y,z] list),
    or None for objects without bound_box (lights, empties parented to nothing).
    """
    if not hasattr(obj, "bound_box") or obj.bound_box is None:
        return None
    corners = [obj.matrix_world @ mathutils.Vector(c) for c in obj.bound_box]
    if not corners:
        return None
    xs, ys, zs = zip(*[(v.x, v.y, v.z) for v in corners])
    mn = [min(xs), min(ys), min(zs)]
    mx = [max(xs), max(ys), max(zs)]
    return {
        "min": mn,
        "max": mx,
        "dims": [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]],
        "center": [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2],
    }


def world_xyz(obj: bpy.types.Object) -> list[float]:
    """World-space translation (location) of `obj` as [x, y, z]."""
    t = obj.matrix_world.translation
    return [t.x, t.y, t.z]


def union_bbox(boxes: list[dict[str, list[float]]]) -> dict[str, list[float]] | None:
    """Union of multiple world-space bboxes (as returned by `bbox_world`)."""
    if not boxes:
        return None
    mn = [min(b["min"][i] for b in boxes) for i in range(3)]
    mx = [max(b["max"][i] for b in boxes) for i in range(3)]
    return {
        "min": mn,
        "max": mx,
        "dims": [mx[i] - mn[i] for i in range(3)],
        "center": [(mn[i] + mx[i]) / 2 for i in range(3)],
    }
