"""Shared helpers for the parametric jewelry Blender pipeline.

Run inside the Blender Python interpreter, sent through the `blender-mcp`
MCP server's `execute_blender_code` tool. Do not run with system Python —
they need `bpy` and a live scene.

────────────────────────────────────────────────────────────────────────
Convention: piece-local +Z = body-outward
────────────────────────────────────────────────────────────────────────
Every shape script must export its mesh with the local +Z axis pointing
away from the body. This matches the placeholder torus in
`components/catalog/EquippedPieces.tsx` (which lies in XY plane, axis
through Z). The anchor rotations seeded from `prisma/seed-data/anchors.json`
already rotate +Z to point outward from skin, so jewelry rendered on an
anchor will sit correctly without per-piece tuning.

The exact "where is the origin?" rule per shape lives in each
`shape_*.py` docstring; the table below summarises:

  seamless_hoop   → centre of ring; ring in XY plane                  (+Z axis)
  horseshoe       → centre of arc midpoint, gap facing +Y             (+Z axis)
  curved_barbell  → "in" ball end; curve in YZ plane                  (+Z axis)
  straight_barbell→ "in" ball end; shaft along +Z                     (+Z axis)
  labret_stud     → centre of flat back disc; shaft+top toward +Z     (+Z axis)
  nose_stud_l     → inside elbow of L; gem/ball facing +Z             (+Z axis)

────────────────────────────────────────────────────────────────────────
Scale: real-world meters
────────────────────────────────────────────────────────────────────────
Models export at real scale (1 Blender unit = 1 m). A 1.2mm gauge × 8mm
hoop is a torus with major_radius=0.004 and minor_radius=0.0006. The
showroom renders body.glb at 1.7 m tall; jewelry must match that scale,
so `Jewelry.glbScale = 1.0` (default) is correct in `EquippedPieces`.

────────────────────────────────────────────────────────────────────────
Scene safety
────────────────────────────────────────────────────────────────────────
`enter_build_scene()` creates a fresh temporary scene and switches to it.
`exit_build_scene()` switches back and deletes the temp scene. The
caller's original scene (typically `body.blend`'s) is never mutated.

DO NOT save the .blend file after running the build pipeline — the
body.blend on disk should remain unchanged. Re-open it from
`art/source/body.blend` if you accidentally save.
"""

from __future__ import annotations

import os
import sys
from typing import Iterable

# Make the parent `_helpers` module importable.
_HELPERS_DIR = r"C:\Users\rusya\Desktop\pierc\scripts\blender"
if _HELPERS_DIR not in sys.path:
    sys.path.insert(0, _HELPERS_DIR)

import bpy  # noqa: E402

from _helpers import REPO_ROOT, repo_path, ensure_dir, tri_count  # noqa: E402

# ────────────────────────────────────────────────────────────────────────
# Paths
# ────────────────────────────────────────────────────────────────────────

JEWELRY_OUT_DIR = repo_path("art", "jewelry-out")
JEWELRY_MANIFEST = repo_path("prisma", "seed-data", "jewelry.json")


def output_path(slug: str) -> str:
    """Absolute path of a piece's exported `.glb`."""
    return os.path.join(JEWELRY_OUT_DIR, f"{slug}.glb")


# ────────────────────────────────────────────────────────────────────────
# Materials
# ────────────────────────────────────────────────────────────────────────

# Each entry: (r, g, b, metallic, roughness). Roughness is calibrated for
# small jewelry — too low (mirror) shows ugly seams under the showroom's
# default lighting; ~0.18 reads as a real polished surface.
MATERIAL_COLORS: dict[str, tuple[float, float, float, float, float]] = {
    "titanium": (0.92, 0.93, 0.95, 1.0, 0.18),
    "gold-585": (1.00, 0.78, 0.36, 1.0, 0.16),
    "rose-gold-585": (0.95, 0.70, 0.62, 1.0, 0.18),
    "black-pvd": (0.06, 0.06, 0.07, 1.0, 0.30),
}

# Each entry: (r, g, b, transmission, ior, emissive_strength).
# Transmission > 0 plus low roughness gives the glass / crystal look.
GEM_COLORS: dict[str, tuple[float, float, float, float, float, float]] = {
    "clear": (1.00, 1.00, 1.00, 0.85, 1.5, 0.0),
    "pink": (1.00, 0.56, 0.77, 0.45, 1.5, 0.0),
    "blue": (0.45, 0.77, 1.00, 0.45, 1.5, 0.0),
    "opal-white": (0.95, 0.93, 0.84, 0.0, 1.5, 0.08),
}


def make_metal_material(name: str, color_key: str) -> bpy.types.Material:
    """Build a Principled-BSDF metal material from MATERIAL_COLORS."""
    if color_key not in MATERIAL_COLORS:
        raise KeyError(f"Unknown materialColor: {color_key}")
    r, g, b, metallic, roughness = MATERIAL_COLORS[color_key]

    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf is None:
        # Fallback: clear + add fresh.
        for n in list(mat.node_tree.nodes):
            mat.node_tree.nodes.remove(n)
        out = mat.node_tree.nodes.new("ShaderNodeOutputMaterial")
        bsdf = mat.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
        mat.node_tree.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def make_gem_material(name: str, color_key: str) -> bpy.types.Material:
    """Build a transmissive Principled-BSDF gem material from GEM_COLORS."""
    if color_key not in GEM_COLORS:
        raise KeyError(f"Unknown gem color: {color_key}")
    r, g, b, transmission, ior, emission = GEM_COLORS[color_key]

    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf is None:
        for n in list(mat.node_tree.nodes):
            mat.node_tree.nodes.remove(n)
        out = mat.node_tree.nodes.new("ShaderNodeOutputMaterial")
        bsdf = mat.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
        mat.node_tree.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 0.05
    # Blender 4.x renamed "Transmission" → "Transmission Weight".
    if "Transmission Weight" in bsdf.inputs:
        bsdf.inputs["Transmission Weight"].default_value = transmission
    elif "Transmission" in bsdf.inputs:
        bsdf.inputs["Transmission"].default_value = transmission
    if "IOR" in bsdf.inputs:
        bsdf.inputs["IOR"].default_value = ior
    # Emission pseudo-glow for opal.
    if "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (r, g, b, 1.0)
    elif "Emission" in bsdf.inputs:
        bsdf.inputs["Emission"].default_value = (r, g, b, 1.0)
    if "Emission Strength" in bsdf.inputs:
        bsdf.inputs["Emission Strength"].default_value = emission
    return mat


def assign_material(obj: bpy.types.Object, mat: bpy.types.Material) -> None:
    """Replace the object's material slot with `mat` (single-slot)."""
    obj.data.materials.clear()
    obj.data.materials.append(mat)


# ────────────────────────────────────────────────────────────────────────
# Scene management — non-destructive temp scene
# ────────────────────────────────────────────────────────────────────────


def enter_build_scene(name: str = "JewelryBuild") -> tuple[bpy.types.Scene, bpy.types.Scene]:
    """Create + activate an empty temp scene; return (original, temp).

    The caller's original scene is left fully intact — all build work
    happens in the temp scene, which is removed by `exit_build_scene`.
    """
    original = bpy.context.window.scene
    # Pick a unique name so repeated calls in one session don't collide.
    base = name
    n = 0
    while name in bpy.data.scenes:
        n += 1
        name = f"{base}_{n}"
    temp = bpy.data.scenes.new(name)
    bpy.context.window.scene = temp
    return original, temp


def exit_build_scene(original: bpy.types.Scene, temp: bpy.types.Scene) -> None:
    """Restore the original scene as active and delete the temp scene.

    Also purges every orphan datablock that Blender leaves behind after
    a scene is unlinked — without this, every build accumulates unused
    objects/meshes/materials in `bpy.data`.
    """
    bpy.context.window.scene = original

    # Unlink everything in the temp scene's objects FIRST so they don't
    # remain attached to a deleted scene.
    if temp.name in bpy.data.scenes:
        for obj in list(temp.collection.objects):
            try:
                temp.collection.objects.unlink(obj)
            except RuntimeError:
                pass
        bpy.data.scenes.remove(temp, do_unlink=True)

    # Canonical purge: walks the dependency graph thoroughly, equivalent
    # to "Purge Unused Data" in the Outliner. Available in Blender 2.90+.
    if hasattr(bpy.data, "orphans_purge"):
        bpy.data.orphans_purge(
            do_local_ids=True,
            do_linked_ids=True,
            do_recursive=True,
        )
    else:
        # Fallback for older Blenders: hand-rolled multi-pass loop.
        for _ in range(3):
            any_removed = False
            for collection in (
                bpy.data.objects,
                bpy.data.meshes,
                bpy.data.curves,
                bpy.data.materials,
                bpy.data.node_groups,
                bpy.data.images,
                bpy.data.textures,
            ):
                for item in list(collection):
                    if item.users == 0:
                        collection.remove(item)
                        any_removed = True
            if not any_removed:
                break


# ────────────────────────────────────────────────────────────────────────
# Object utilities
# ────────────────────────────────────────────────────────────────────────


def deselect_all() -> None:
    for obj in bpy.context.scene.objects:
        obj.select_set(False)


def select_only(obj: bpy.types.Object) -> None:
    deselect_all()
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_transforms(obj: bpy.types.Object) -> None:
    """Bake location/rotation/scale into the mesh data (origin stays)."""
    select_only(obj)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


def set_origin_to_world(obj: bpy.types.Object, world_location: tuple[float, float, float]) -> None:
    """Move the origin to the given world-space point, leaving geometry in place."""
    select_only(obj)
    cursor = bpy.context.scene.cursor.location.copy()
    bpy.context.scene.cursor.location = world_location
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.context.scene.cursor.location = cursor


def shade_smooth(obj: bpy.types.Object) -> None:
    """Smooth shading on all polygons."""
    if obj.type != "MESH":
        return
    for p in obj.data.polygons:
        p.use_smooth = True


def join_meshes(objs: Iterable[bpy.types.Object]) -> bpy.types.Object:
    """Join all listed meshes into the first one; return that join target."""
    objs_list = [o for o in objs if o.type == "MESH"]
    if not objs_list:
        raise ValueError("join_meshes needs at least one MESH object")
    if len(objs_list) == 1:
        return objs_list[0]
    target = objs_list[0]
    deselect_all()
    for o in objs_list:
        o.select_set(True)
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.join()
    return target


# ────────────────────────────────────────────────────────────────────────
# Mesh primitives (millimeter inputs → meter geometry)
# ────────────────────────────────────────────────────────────────────────


def mm(value_mm: float) -> float:
    """Convert millimeters to meters (the body model's units)."""
    return value_mm / 1000.0


def add_torus(
    *,
    major_r_mm: float,
    minor_r_mm: float,
    major_segments: int = 48,
    minor_segments: int = 12,
    location: tuple[float, float, float] = (0.0, 0.0, 0.0),
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    """Add a torus and return the new object. Default lies in XY plane."""
    bpy.ops.mesh.primitive_torus_add(
        major_radius=mm(major_r_mm),
        minor_radius=mm(minor_r_mm),
        major_segments=major_segments,
        minor_segments=minor_segments,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.active_object
    shade_smooth(obj)
    return obj


def add_uv_sphere(
    *,
    radius_mm: float,
    segments: int = 24,
    rings: int = 16,
    location: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=mm(radius_mm),
        segments=segments,
        ring_count=rings,
        location=location,
    )
    obj = bpy.context.active_object
    shade_smooth(obj)
    return obj


def add_ico_sphere(
    *,
    radius_mm: float,
    subdivisions: int = 2,
    location: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(
        radius=mm(radius_mm),
        subdivisions=subdivisions,
        location=location,
    )
    obj = bpy.context.active_object
    # Ico-spheres look better faceted (gem facets), so don't smooth-shade.
    return obj


def add_cylinder(
    *,
    radius_mm: float,
    depth_mm: float,
    vertices: int = 24,
    location: tuple[float, float, float] = (0.0, 0.0, 0.0),
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        radius=mm(radius_mm),
        depth=mm(depth_mm),
        vertices=vertices,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.active_object
    # Cylinder side: smooth. Caps: flat. We auto-smooth by angle for the right look.
    shade_smooth(obj)
    if hasattr(obj.data, "use_auto_smooth"):
        # Blender < 4.1
        obj.data.use_auto_smooth = True
        obj.data.auto_smooth_angle = 0.785398  # 45°
    return obj


# ────────────────────────────────────────────────────────────────────────
# Attach-point empties — Phase B multi-anchor jewelry system.
# ────────────────────────────────────────────────────────────────────────


def add_attach_empty(
    name: str,
    *,
    location: tuple[float, float, float] = (0.0, 0.0, 0.0),
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    """Add a named empty marking a jewelry attach point.

    Convention (see docs/20-multi-anchor-jewelry.md):
      • The empty's local +Z axis points OUTWARD from the body, matching
        the piece's piece-local +Z convention.
      • `attach:primary` corresponds to JewelryAnchorBinding.order == 0.
      • `attach:secondary` corresponds to order == 1, etc.

    The renderer (components/catalog/EquippedPieces.tsx) traverses the
    loaded glTF, finds these empties by name, reads their world
    positions, and computes the rigid transform that maps them onto
    the equipped anchors.
    """
    bpy.ops.object.empty_add(
        type="PLAIN_AXES",
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.empty_display_size = 0.004  # 4 mm — visible but not loud in the viewport
    obj.show_name = False  # exporter doesn't need the label
    return obj


# ────────────────────────────────────────────────────────────────────────
# Export
# ────────────────────────────────────────────────────────────────────────


def export_glb_draco(
    path: str,
    root_obj: bpy.types.Object,
    *extras: bpy.types.Object,
) -> int:
    """Export `root_obj` (and any `extras` like attach:* empties) to `.glb`
    with Draco mesh compression.

    Convention: pass the main mesh first, then any additional objects
    (empties, attach points) that should ride along in the same GLB.
    All listed objects are selected; export uses `use_selection=True`.

    Returns the exported filesize in bytes.
    """
    ensure_dir(path)
    deselect_all()
    root_obj.select_set(True)
    for x in extras:
        x.select_set(True)
    bpy.context.view_layer.objects.active = root_obj
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,  # match three.js / glTF default
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_animations=False,
        export_lights=False,
        export_cameras=False,
        # Empties have no mesh data but glTF nodes carry the names we
        # rely on (`attach:primary`, `attach:secondary`). The default
        # export_extras=False is fine — we just need the node, not custom
        # properties.
    )
    return os.path.getsize(path)


def stats(obj: bpy.types.Object) -> dict[str, int]:
    """Quick mesh stats: tris, verts, materials."""
    return {
        "tris": tri_count(obj),
        "verts": len(obj.data.vertices) if obj.type == "MESH" else 0,
        "materials": len(obj.data.materials) if obj.type == "MESH" else 0,
    }


# ────────────────────────────────────────────────────────────────────────
# Manifest reader
# ────────────────────────────────────────────────────────────────────────


def read_manifest() -> list[dict]:
    """Load and return the parsed jewelry.json manifest."""
    import json

    with open(JEWELRY_MANIFEST, "r", encoding="utf-8") as fh:
        return json.load(fh)


# Re-export for shape modules.
__all__ = [
    "JEWELRY_OUT_DIR",
    "JEWELRY_MANIFEST",
    "MATERIAL_COLORS",
    "GEM_COLORS",
    "REPO_ROOT",
    "add_cylinder",
    "add_ico_sphere",
    "add_torus",
    "add_uv_sphere",
    "add_attach_empty",
    "apply_transforms",
    "assign_material",
    "deselect_all",
    "enter_build_scene",
    "exit_build_scene",
    "export_glb_draco",
    "join_meshes",
    "make_gem_material",
    "make_metal_material",
    "mm",
    "output_path",
    "read_manifest",
    "select_only",
    "set_origin_to_world",
    "shade_smooth",
    "stats",
]
