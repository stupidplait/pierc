"""Curved barbell ("banana") — gently bowed shaft with two ball ends.

Origin: centre of the "in" ball (the anchor attachment point).
Outward axis: +Z (shaft runs from origin toward +Z; bow lifts in +Y).

Used for: navel, eyebrow.

Params (all millimeters):
    shaftLengthMm  — distance between ball centres along the chord (typical: 10, 12)
    gaugeMm        — shaft thickness (typical: 1.6 = 14g)
    ballSizeMm     — ball diameter (typical: 1.5–2× gauge, e.g. 3, 4)
    bowDepthMm     — apex-to-chord distance at midpoint (default: 1.5)

Geometry:
    The shaft is a cubic Bezier curve from (0, 0, 0) to (0, 0, length) with
    its midpoint pulled toward +Y by `bowDepthMm`. A circle of `gaugeMm/2`
    radius is swept along the curve via Blender's curve bevel; converted
    to mesh; UV-sphere balls are added at both endpoints. Origin is set
    on the "in" ball, matching the convention.
"""

from __future__ import annotations

import sys
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

import bpy  # noqa: E402

from _jewelry_helpers import (  # noqa: E402
    add_uv_sphere,
    apply_transforms,
    assign_material,
    deselect_all,
    join_meshes,
    make_metal_material,
    mm,
    select_only,
    set_origin_to_world,
    shade_smooth,
)


def _build_curved_shaft(
    *,
    length_mm: float,
    gauge_mm: float,
    bow_depth_mm: float,
) -> bpy.types.Object:
    """Build the curved shaft as a mesh tube (Bezier curve + bevel)."""
    curve_data = bpy.data.curves.new(name="curved_barbell_curve", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.bevel_depth = mm(gauge_mm / 2.0)
    curve_data.bevel_resolution = 4  # higher = rounder cross-section

    spline = curve_data.splines.new(type="BEZIER")
    spline.bezier_points.add(1)  # already has 1 point; add second

    p0 = spline.bezier_points[0]
    p1 = spline.bezier_points[1]

    # Endpoints in meters.
    L = mm(length_mm)
    D = mm(bow_depth_mm)

    p0.co = (0.0, 0.0, 0.0)
    p1.co = (0.0, 0.0, L)

    # Tangent handles: pull the midpoint toward +Y by ~bowDepth*2 so the
    # cubic Bezier midpoint sits at ~bowDepth above the chord.
    p0.handle_left = (0.0, D * 1.2, -L * 0.2)
    p0.handle_right = (0.0, D * 1.2, L * 0.33)
    p1.handle_left = (0.0, D * 1.2, L * 0.66)
    p1.handle_right = (0.0, D * 1.2, L * 1.2)

    curve_obj = bpy.data.objects.new("curved_shaft", curve_data)
    bpy.context.scene.collection.objects.link(curve_obj)

    select_only(curve_obj)
    bpy.ops.object.convert(target="MESH")  # converts the active object
    mesh_obj = bpy.context.active_object
    shade_smooth(mesh_obj)
    return mesh_obj


def build(params: dict, material_color: str) -> bpy.types.Object:
    shaft_length_mm = float(params["shaftLengthMm"])
    gauge_mm = float(params["gaugeMm"])
    ball_size_mm = float(params.get("ballSizeMm", max(2.5, gauge_mm * 1.8)))
    bow_depth_mm = float(params.get("bowDepthMm", 1.5))

    shaft = _build_curved_shaft(
        length_mm=shaft_length_mm,
        gauge_mm=gauge_mm,
        bow_depth_mm=bow_depth_mm,
    )

    ball_in = add_uv_sphere(
        radius_mm=ball_size_mm / 2.0,
        location=(0.0, 0.0, 0.0),
    )
    ball_out = add_uv_sphere(
        radius_mm=ball_size_mm / 2.0,
        location=(0.0, 0.0, mm(shaft_length_mm)),
    )

    apply_transforms(shaft)
    apply_transforms(ball_in)
    apply_transforms(ball_out)

    deselect_all()
    obj = join_meshes([ball_in, shaft, ball_out])
    obj.name = "curved_barbell"

    set_origin_to_world(obj, (0.0, 0.0, 0.0))

    mat = make_metal_material(f"metal_{material_color}", material_color)
    assign_material(obj, mat)
    return obj
