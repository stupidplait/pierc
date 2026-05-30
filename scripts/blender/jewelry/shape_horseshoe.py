"""Horseshoe (circular barbell) — 270° wire arc with ball ends.

Origin: centre of the implied full circle (so the arc is symmetric around it).
Outward axis: +Z (ring lies in XY plane like the seamless hoop).
Gap orientation: opens in +Y (the two ball ends point upward in piece-local space).

Used for: septum, lip-medusa.

Params (all millimeters):
    diameterMm  — outer diameter of the implied circle (typical: 8, 10)
    gaugeMm     — wire thickness (typical: 1.2 = 16g, 1.6 = 14g)
    ballSizeMm  — ball end diameter (default: gauge * 2)
    gapDegrees  — opening at the top (default: 90 → 270° arc, the classic horseshoe)

Geometry:
    A NURBS curve sampled along a (360 - gapDegrees)° arc of the circle,
    centred at origin in the XY plane, gap along +Y. Beveled with a
    circular cross-section of `gaugeMm/2`. Ball ends added at the arc tips.
"""

from __future__ import annotations

import math
import sys
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

import bpy  # noqa: E402

from _jewelry_helpers import (  # noqa: E402
    add_attach_empty,
    add_uv_sphere,
    apply_transforms,
    assign_material,
    join_meshes,
    make_metal_material,
    mm,
    select_only,
    set_origin_to_world,
    shade_smooth,
)


def _build_arc(
    *,
    radius_mm: float,
    gauge_mm: float,
    gap_degrees: float,
) -> bpy.types.Object:
    """Build the 270° arc as a beveled mesh tube."""
    arc_degrees = 360.0 - gap_degrees
    n_points = 48  # smooth enough for 270°; bumps with arc length

    curve_data = bpy.data.curves.new(name="horseshoe_curve", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.bevel_depth = mm(gauge_mm / 2.0)
    curve_data.bevel_resolution = 4

    spline = curve_data.splines.new(type="POLY")
    spline.points.add(n_points - 1)  # already has 1

    R = mm(radius_mm)
    # Walk angle from `gap/2 + 90°` (right of gap) clockwise around the
    # bottom of the circle to `90° - gap/2` (left of gap). In radians:
    half_gap = math.radians(gap_degrees / 2.0)
    start = math.pi / 2.0 + half_gap  # left tip (angle measured from +X)
    end = math.pi / 2.0 - half_gap + 2 * math.pi  # walk forward (CCW)

    if arc_degrees > 0:
        for i in range(n_points):
            t = i / (n_points - 1)
            angle = start + (end - start) * t
            x = R * math.cos(angle)
            y = R * math.sin(angle)
            # PolySpline uses 4D coords (x,y,z,w); w is weight, usually 1.
            spline.points[i].co = (x, y, 0.0, 1.0)

    curve_obj = bpy.data.objects.new("horseshoe_shaft", curve_data)
    bpy.context.scene.collection.objects.link(curve_obj)

    select_only(curve_obj)
    bpy.ops.object.convert(target="MESH")
    mesh_obj = bpy.context.active_object
    shade_smooth(mesh_obj)
    return mesh_obj


def build(params: dict, material_color: str) -> tuple[bpy.types.Object, ...]:
    diameter_mm = float(params["diameterMm"])
    gauge_mm = float(params["gaugeMm"])
    ball_size_mm = float(params.get("ballSizeMm", max(2.5, gauge_mm * 1.6)))
    gap_degrees = float(params.get("gapDegrees", 90.0))

    radius_mm = (diameter_mm - gauge_mm) / 2.0

    arc = _build_arc(
        radius_mm=radius_mm,
        gauge_mm=gauge_mm,
        gap_degrees=gap_degrees,
    )

    # Position ball ends at the arc tips (left and right of the gap).
    half_gap_rad = math.radians(gap_degrees / 2.0)
    left_tip = (
        mm(radius_mm) * math.cos(math.pi / 2.0 + half_gap_rad),
        mm(radius_mm) * math.sin(math.pi / 2.0 + half_gap_rad),
        0.0,
    )
    right_tip = (
        mm(radius_mm) * math.cos(math.pi / 2.0 - half_gap_rad),
        mm(radius_mm) * math.sin(math.pi / 2.0 - half_gap_rad),
        0.0,
    )

    ball_l = add_uv_sphere(radius_mm=ball_size_mm / 2.0, location=left_tip)
    ball_r = add_uv_sphere(radius_mm=ball_size_mm / 2.0, location=right_tip)

    apply_transforms(arc)
    apply_transforms(ball_l)
    apply_transforms(ball_r)

    obj = join_meshes([arc, ball_l, ball_r])
    obj.name = "horseshoe"

    set_origin_to_world(obj, (0.0, 0.0, 0.0))

    mat = make_metal_material(f"metal_{material_color}", material_color)
    assign_material(obj, mat)

    # Attach points: ring center is `attach:primary` (used when type=RING for
    # septum / lip-medusa — the user wears the horseshoe through a single
    # piercing). The two ball tips are `attach:secondary` and `attach:tertiary`
    # only consumed when type=CIRCULAR_BARBELL (worn through 2 holes). For a
    # type=CIRCULAR_BARBELL horseshoe, the renderer reads both ball-tip
    # empties and the "ring center" empty is unused.
    attach_primary = add_attach_empty(
        "attach:primary", location=(0.0, 0.0, 0.0)
    )
    attach_secondary = add_attach_empty(
        "attach:secondary", location=left_tip
    )
    attach_tertiary = add_attach_empty(
        "attach:tertiary", location=right_tip
    )
    return obj, attach_primary, attach_secondary, attach_tertiary
