"""Seamless hoop / clicker.

Origin: centre of ring.
Outward axis: +Z (ring lies in the XY plane).

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
    )
    obj.name = "seamless_hoop"

    apply_transforms(obj)

    mat = make_metal_material(f"metal_{material_color}", material_color)
    assign_material(obj, mat)

    # Attach point: ring center, post outward = +Z (the empty's local +Z
    # points OUT of the ring face). For ORBITAL usage (one ring through 2
    # piercings), an additional `attach:secondary` would be added at the
    # opposite point of the torus; not yet supported.
    attach_primary = add_attach_empty(
        "attach:primary", location=(0.0, 0.0, 0.0)
    )

    return obj, attach_primary
