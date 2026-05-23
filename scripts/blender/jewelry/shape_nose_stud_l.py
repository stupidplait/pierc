"""Nose stud (L-bend) — short visible shaft + 90° elbow + lateral retainer.

Origin: the inside-of-the-elbow point (the corner where the L bends).
Outward axis: +Z (visible arm runs along +Z; gem/ball at the tip).

Used for: nostril.

Geometry (piece-local space):

         ▲ +Z    (gem/ball at the visible tip)
         │
         ●────┐               ← visible arm: cylinder z=0 → z=visibleLengthMm
         ┘    │
              │
              │ retainer arm: cylinder x=0 → x=insideLengthMm
              │ (sits inside the nostril)
              ●

Params (all millimeters):
    visibleLengthMm   — visible shaft length above the body surface (typical: 3–4)
    insideLengthMm    — hidden retainer length inside the nostril (typical: 5–6)
    gaugeMm           — shaft thickness (typical: 1.0 = 18g)
    topShape          — "ball" | "gem"
    topSizeMm         — top end diameter (default: gauge * 2.2)
    topGemColor       — required when topShape == "gem"
"""

from __future__ import annotations

import sys
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

import bpy  # noqa: E402
import math  # noqa: E402

from _jewelry_helpers import (  # noqa: E402
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


def _set_only_material(obj: bpy.types.Object, mat: bpy.types.Material) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def build(params: dict, material_color: str) -> bpy.types.Object:
    visible_length_mm = float(params.get("visibleLengthMm", 3.5))
    inside_length_mm = float(params.get("insideLengthMm", 5.5))
    gauge_mm = float(params.get("gaugeMm", 1.0))
    top_shape = str(params.get("topShape", "ball"))
    top_size_mm = float(params.get("topSizeMm", max(2.0, gauge_mm * 2.2)))
    top_gem_color = params.get("topGemColor")

    metal_mat = make_metal_material(f"metal_{material_color}", material_color)

    # Visible arm: cylinder along +Z, from z=0 (origin = elbow) to
    # z = visibleLengthMm. Centred at z = visibleLengthMm/2.
    visible_arm = add_cylinder(
        radius_mm=gauge_mm / 2.0,
        depth_mm=visible_length_mm,
        location=(0.0, 0.0, mm(visible_length_mm) / 2.0),
    )

    # Retainer arm: cylinder along +X, from x=0 to x=insideLengthMm.
    # Default cylinder is along Z; rotate 90° around Y to lay along X.
    retainer_arm = add_cylinder(
        radius_mm=gauge_mm / 2.0,
        depth_mm=inside_length_mm,
        location=(mm(inside_length_mm) / 2.0, 0.0, 0.0),
        rotation=(0.0, math.pi / 2.0, 0.0),
    )

    # Small filler ball at the elbow joint to round the corner.
    elbow = add_uv_sphere(
        radius_mm=gauge_mm / 2.0 * 1.05,
        location=(0.0, 0.0, 0.0),
    )

    # Tail ball at the inside end (so it doesn't poke out of the nostril
    # geometry as a sharp cylinder cap when seen from inside).
    tail = add_uv_sphere(
        radius_mm=gauge_mm / 2.0 * 1.05,
        location=(mm(inside_length_mm), 0.0, 0.0),
    )

    metal_parts = [visible_arm, retainer_arm, elbow, tail]
    for p in metal_parts:
        _set_only_material(p, metal_mat)

    # ── Top (visible end) ──
    top_z = mm(visible_length_mm) + mm(top_size_mm) / 2.0
    gem_part: bpy.types.Object | None = None
    if top_shape == "ball":
        top = add_uv_sphere(
            radius_mm=top_size_mm / 2.0,
            location=(0.0, 0.0, top_z),
        )
        _set_only_material(top, metal_mat)
        metal_parts.append(top)
    elif top_shape == "gem":
        if not top_gem_color:
            raise ValueError(
                "nose_stud_l topShape='gem' requires `topGemColor`"
            )
        gem = add_ico_sphere(
            radius_mm=top_size_mm / 2.0,
            subdivisions=2,
            location=(0.0, 0.0, top_z),
        )
        gem_mat = make_gem_material(f"gem_{top_gem_color}", top_gem_color)
        _set_only_material(gem, gem_mat)
        gem_part = gem
    else:
        raise ValueError(
            f"nose_stud_l: unknown topShape '{top_shape}' "
            "(expected 'ball' | 'gem')"
        )

    for o in metal_parts:
        apply_transforms(o)
    if gem_part is not None:
        apply_transforms(gem_part)

    deselect_all()
    all_parts = metal_parts + ([gem_part] if gem_part else [])
    obj = join_meshes(all_parts)
    obj.name = "nose_stud_l"

    set_origin_to_world(obj, (0.0, 0.0, 0.0))
    return obj
