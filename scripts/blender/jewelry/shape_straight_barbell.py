"""Straight barbell — two ball ends joined by a straight shaft.

Origin: centre of the "in" ball (the one against the body).
Outward axis: +Z (shaft runs along +Z; "out" ball at z = shaftLengthMm).

Used for: nipple, tongue, industrial.

Params (all millimeters):
    shaftLengthMm  — distance between ball centres (typical: 14, 16)
    gaugeMm        — shaft thickness (typical: 1.6 = 14g)
    ballSizeMm     — ball diameter (typical: 1.5–2× gauge, e.g. 3, 4)

Anatomy:
    Real straight barbells thread the shaft through the body and the balls
    sit on either skin surface. The piece-local origin is at the "in" ball
    (where the anchor will be placed); the shaft + "out" ball stick out
    along +Z. Both balls are visible because piercings are typically thin
    skin/tissue.
"""

from __future__ import annotations

import sys
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

import bpy  # noqa: E402

from _jewelry_helpers import (  # noqa: E402
    add_cylinder,
    add_uv_sphere,
    apply_transforms,
    assign_material,
    join_meshes,
    make_metal_material,
    set_origin_to_world,
)


def build(params: dict, material_color: str) -> bpy.types.Object:
    shaft_length_mm = float(params["shaftLengthMm"])
    gauge_mm = float(params["gaugeMm"])
    ball_size_mm = float(params.get("ballSizeMm", max(2.5, gauge_mm * 1.8)))

    ball_radius_mm = ball_size_mm / 2.0
    shaft_radius_mm = gauge_mm / 2.0

    # "In" ball at origin.
    ball_in = add_uv_sphere(radius_mm=ball_radius_mm, location=(0.0, 0.0, 0.0))

    # Shaft: cylinder centred at z = shaftLengthMm/2, length = shaftLengthMm.
    # Default Blender cylinder is along Z, which is exactly what we want.
    shaft = add_cylinder(
        radius_mm=shaft_radius_mm,
        depth_mm=shaft_length_mm,
        location=(0.0, 0.0, shaft_length_mm / 2.0 / 1000.0),
    )

    # "Out" ball.
    ball_out = add_uv_sphere(
        radius_mm=ball_radius_mm,
        location=(0.0, 0.0, shaft_length_mm / 1000.0),
    )

    apply_transforms(ball_in)
    apply_transforms(shaft)
    apply_transforms(ball_out)

    obj = join_meshes([ball_in, shaft, ball_out])
    obj.name = "straight_barbell"

    set_origin_to_world(obj, (0.0, 0.0, 0.0))

    mat = make_metal_material(f"metal_{material_color}", material_color)
    assign_material(obj, mat)
    return obj
