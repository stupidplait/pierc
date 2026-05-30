"""Labret stud — flat back disc + shaft + threadless top end.

Origin: body surface (the disc-shaft junction).
Outward axis: +Z (disc behind body in -Z, shaft + top in +Z).

Used for: labret, helix, ear-lobes — the workhorse piercing piece.

Params (all millimeters):
    shaftLengthMm     — visible shaft length from body surface to top base (typical: 6, 8, 10)
    gaugeMm           — shaft thickness (typical: 1.2 = 16g)
    discDiameterMm    — back disc diameter (typical: 3–4)
    topShape          — "ball" | "disc" | "gem"
    topSizeMm         — top end diameter (default: gauge * 2.5)
    topGemColor       — required when topShape == "gem"; one of GEM_COLORS keys

Geometry:
    Disc:  cylinder of radius `discDiameterMm/2` and height ~0.6 mm,
           sitting BEHIND the body surface (z = -0.6 mm to z = 0).
    Shaft: cylinder of radius `gaugeMm/2`, from z=0 to z=shaftLengthMm.
    Top:   per `topShape`:
             "ball" → UV sphere at z=shaftLengthMm + topSize/2
             "disc" → flat cylinder of height ~0.5 mm at z=shaftLengthMm
             "gem"  → low-poly icosphere with transmissive material

When topShape='gem' the gem is joined into the same mesh as the metal
parts, but with a second material slot — Blender's `object.join` preserves
per-face material assignments. Exported `.glb` therefore has a single
mesh with two PBR materials (metal + gem).
"""

from __future__ import annotations

import sys
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

import bpy  # noqa: E402

from _jewelry_helpers import (  # noqa: E402
    add_attach_empty,
    add_cylinder,
    add_ico_sphere,
    add_uv_sphere,
    apply_transforms,
    deselect_all,
    join_meshes,
    make_gem_material,
    make_metal_material,
    mm,
    set_origin_to_world,
)

DISC_THICKNESS_MM = 0.6
DISC_TOP_THICKNESS_MM = 0.5


def _set_only_material(obj: bpy.types.Object, mat: bpy.types.Material) -> None:
    """Replace all material slots with a single slot pointing at `mat`."""
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def build(params: dict, material_color: str) -> bpy.types.Object:
    shaft_length_mm = float(params["shaftLengthMm"])
    gauge_mm = float(params["gaugeMm"])
    disc_diameter_mm = float(
        params.get("discDiameterMm", max(3.0, gauge_mm * 2.5))
    )
    top_shape = str(params.get("topShape", "ball"))
    top_size_mm = float(params.get("topSizeMm", max(2.5, gauge_mm * 2.2)))
    top_gem_color = params.get("topGemColor")

    metal_mat = make_metal_material(f"metal_{material_color}", material_color)

    # ── Back disc (behind body surface) ──
    disc = add_cylinder(
        radius_mm=disc_diameter_mm / 2.0,
        depth_mm=DISC_THICKNESS_MM,
        location=(0.0, 0.0, -mm(DISC_THICKNESS_MM) / 2.0),
    )

    # ── Shaft ──
    shaft = add_cylinder(
        radius_mm=gauge_mm / 2.0,
        depth_mm=shaft_length_mm,
        location=(0.0, 0.0, mm(shaft_length_mm) / 2.0),
    )

    # Each metal part gets the SAME metal material so they merge into a
    # single material slot on join.
    _set_only_material(disc, metal_mat)
    _set_only_material(shaft, metal_mat)
    metal_parts = [disc, shaft]

    # ── Top end ──
    gem_part: bpy.types.Object | None = None
    if top_shape == "ball":
        top = add_uv_sphere(
            radius_mm=top_size_mm / 2.0,
            location=(0.0, 0.0, mm(shaft_length_mm) + mm(top_size_mm) / 2.0),
        )
        _set_only_material(top, metal_mat)
        metal_parts.append(top)
    elif top_shape == "disc":
        top = add_cylinder(
            radius_mm=top_size_mm / 2.0,
            depth_mm=DISC_TOP_THICKNESS_MM,
            location=(
                0.0,
                0.0,
                mm(shaft_length_mm) + mm(DISC_TOP_THICKNESS_MM) / 2.0,
            ),
        )
        _set_only_material(top, metal_mat)
        metal_parts.append(top)
    elif top_shape == "gem":
        if not top_gem_color:
            raise ValueError(
                "labret_stud topShape='gem' requires `topGemColor` "
                "(one of: clear, pink, blue, opal-white)"
            )
        gem = add_ico_sphere(
            radius_mm=top_size_mm / 2.0,
            subdivisions=2,
            location=(0.0, 0.0, mm(shaft_length_mm) + mm(top_size_mm) / 2.0),
        )
        gem_mat = make_gem_material(f"gem_{top_gem_color}", top_gem_color)
        _set_only_material(gem, gem_mat)
        gem_part = gem
    else:
        raise ValueError(
            f"labret_stud: unknown topShape '{top_shape}' "
            "(expected 'ball' | 'disc' | 'gem')"
        )

    # Apply transforms on every part before joining so all geometry is in
    # world coords.
    for o in metal_parts:
        apply_transforms(o)
    if gem_part is not None:
        apply_transforms(gem_part)

    deselect_all()

    # Build the join order: metal parts first, then gem (so material slot
    # 0 = metal, slot 1 = gem). Blender's join keeps per-face material
    # references intact; the resulting mesh has 2 slots.
    all_parts = metal_parts + ([gem_part] if gem_part else [])
    obj = join_meshes(all_parts)
    obj.name = "labret_stud"

    set_origin_to_world(obj, (0.0, 0.0, 0.0))

    # Attach point: body surface (origin), post going outward = +Z.
    attach_primary = add_attach_empty(
        "attach:primary", location=(0.0, 0.0, 0.0)
    )
    return obj, attach_primary
