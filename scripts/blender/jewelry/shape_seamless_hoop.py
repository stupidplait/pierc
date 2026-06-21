"""Seamless hoop / clicker.

Origin: centre of ring.
Outward axis: glTF +Z (the renderer's body-outward / ring HOLE axis).
attach:primary: glTF +Y (top of the band) — where the hoop crosses the piercing.

IMPORTANT — Blender→glTF axis flip. The exporter (export_yup=True) maps Blender
+Z → glTF +Y. So a torus left in Blender's default XY plane (hole Blender +Z)
exports with hole-axis glTF +Y — i.e. the ring lies FLAT, which the catalog camera
sees edge-on (a flat sliver). To land the hole on glTF +Z (what the RING convention
in lib/catalog/place-jewelry.ts expects), we STAND THE RING UP: rotate the torus
+90° about X so its hole points Blender -Y → glTF +Z, and put the band-top attach
at Blender +Z → glTF +Y.

Params (all millimeters):
    diameterMm  — outer diameter of the ring (typical: 6, 8, 10, 12)
    gaugeMm     — wire thickness (typical: 1.2 = 16g, 1.6 = 14g, 2.0 = 12g)

Anatomy:
    The torus's major radius is `(diameterMm - gaugeMm) / 2` so the
    OUTER diameter matches the manifest. A 8mm × 1.2mm hoop has its
    outermost edge at ±4mm and innermost at ±2.8mm — matching how
    physical hoops are sized in piercing supplier catalogs.
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
    add_torus,
    apply_transforms,
    assign_material,
    make_metal_material,
)


def build(params: dict, material_color: str) -> tuple[bpy.types.Object, ...]:
    diameter_mm = float(params["diameterMm"])
    gauge_mm = float(params["gaugeMm"])

    # Major radius is to the centre of the wire, not the outer edge.
    major_r_mm = (diameter_mm - gauge_mm) / 2.0
    minor_r_mm = gauge_mm / 2.0

    obj = add_torus(
        major_r_mm=major_r_mm,
        minor_r_mm=minor_r_mm,
        major_segments=48,
        minor_segments=12,
        # Stand the ring UP: the default torus lies in Blender's XY plane (hole
        # Blender +Z → glTF +Y, lying flat). Rotating +90° about X aims the hole
        # along Blender -Y → glTF +Z — the renderer's hole/outward axis.
        rotation=(math.radians(90.0), 0.0, 0.0),
    )
    obj.name = "seamless_hoop"

    apply_transforms(obj)  # bake the rotation into the mesh

    mat = make_metal_material(f"metal_{material_color}", material_color)
    assign_material(obj, mat)

    # Attach point: TOP of the band, at Blender +Z·major_r → glTF +Y after the yup
    # export — where the hoop crosses the piercing. The renderer seats this point on
    # the anchor (and, for ear-cartilage anchors flagged hoopSeat="captive", centers
    # the ring there instead of hanging it). For ORBITAL usage (one ring through 2
    # piercings) an `attach:secondary` at the opposite point would be added; n/a yet.
    attach_primary = add_attach_empty(
        "attach:primary", location=(0.0, 0.0, major_r_mm / 1000.0)
    )

    return obj, attach_primary
