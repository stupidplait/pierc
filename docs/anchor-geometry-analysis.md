# Anchor Geometry Analysis Report

**Generated:** 2026-05-30  
**Method:** Blender MCP - Body mesh vertex analysis with KDTree nearest-neighbor search  
**Body Mesh:** 14,164 vertices

---

## Executive Summary

Analyzed all 45 anchor points against the actual body mesh geometry to determine placement accuracy.

### Quality Distribution

| Category | Count | Percentage | Distance Threshold | Status |
|----------|-------|------------|-------------------|--------|
| 🟢 **Perfect** | 9 | 20% | < 1mm | On surface |
| 🟡 **Close** | 24 | 53% | 1-3mm | Minor adjustment needed |
| 🔴 **Floating** | 12 | 27% | > 3mm | Requires repositioning |

**Overall Assessment:** 73% of anchors are within 3mm of the body surface (acceptable for most use cases), but 27% need significant adjustment.

---

## 🟢 Perfect Anchors (< 1mm from surface)

These anchors are precisely positioned on the body mesh:

| Anchor | Distance | Position | Surface Normal |
|--------|----------|----------|----------------|
| **lip-labret** | 0.42mm | (0.0, -0.072, 1.512) | (0.0, -0.68, -0.74) |
| **septum** | 0.58mm | (0.0, -0.082, 1.530) | (0.0, -0.89, -0.46) |
| **right-nostril** | 0.64mm | (-0.011, -0.080, 1.557) | (-0.85, -0.27, 0.46) |
| **left-nostril** | 0.65mm | (0.011, -0.080, 1.557) | (0.85, -0.27, 0.46) |
| **right-helix** | 0.75mm | (-0.085, 0.036, 1.588) | (-0.20, -0.94, -0.28) |
| **left-helix** | 0.77mm | (0.085, 0.036, 1.588) | (0.20, -0.94, -0.28) |
| **right-conch** | 0.79mm | (-0.077, 0.032, 1.571) | (0.43, -0.82, 0.38) |
| **left-conch** | 0.82mm | (0.077, 0.032, 1.571) | (-0.43, -0.82, 0.38) |
| **lip-medusa** | 0.52mm | (0.0, -0.080, 1.536) | (0.01, -0.87, 0.49) |

**Note:** Conch positions are perfect geometrically, but the anatomical analysis flagged them as potentially too high. This is a placement choice, not a geometry issue.

---

## 🟡 Close Anchors (1-3mm from surface)

These anchors are close but could benefit from snapping to the surface:

### Ear Piercings (1-2.7mm)
- **left-tragus**: 1.47mm
- **right-tragus**: 1.46mm
- **left-daith**: 1.86mm
- **right-daith**: 1.84mm
- **left-rook**: 1.96mm
- **right-rook**: 1.94mm
- **left-industrial**: 1.71mm
- **right-industrial**: 1.74mm
- **left-anti-tragus**: 2.69mm
- **right-anti-tragus**: 2.71mm
- **left-helix-posterior**: 2.05mm
- **right-helix-posterior**: 2.07mm
- **left-snug**: 2.11mm
- **right-snug**: 2.10mm

### Lobe Piercings (2-2.5mm)
- **left-ear-lobe**: 2.46mm
- **right-ear-lobe**: 2.46mm
- **left-ear-lobe-2**: 2.10mm
- **right-ear-lobe-2**: 2.12mm

### Face & Body (1-2.4mm)
- **left-eyebrow**: 1.26mm
- **right-eyebrow**: 1.27mm
- **left-nipple**: 1.01mm
- **right-nipple**: 1.00mm
- **navel**: 1.49mm
- **vertical-labret**: 2.37mm

---

## 🔴 Floating Anchors (> 3mm from surface)

These anchors require repositioning:

### Critical Issues (> 5mm)

| Anchor | Distance | Issue | Recommendation |
|--------|----------|-------|----------------|
| **left-hip** | 9.47mm | Far from surface | Snap to hip bone surface |
| **right-hip** | 9.47mm | Far from surface | Snap to hip bone surface |
| **tongue** | 8.75mm | Inside mouth cavity | Move to tongue surface or remove |
| **left-ear-lobe-3** | 5.94mm | Floating above lobe | Snap to lobe surface |
| **right-ear-lobe-3** | 5.96mm | Floating above lobe | Snap to lobe surface |
| **monroe-left** | 5.70mm | Floating above lip | Snap to upper lip surface |
| **madonna-right** | 5.70mm | Floating above lip | Snap to upper lip surface |
| **left-ankle** | 5.62mm | Below surface | Raise to ankle bone |
| **right-ankle** | 5.62mm | Below surface | Raise to ankle bone |

### Moderate Issues (3-5mm)

| Anchor | Distance | Issue | Recommendation |
|--------|----------|-------|----------------|
| **nose-bridge** | 4.97mm | Floating above nose | Snap to bridge surface |
| **left-helix-forward** | 3.19mm | Slightly floating | Snap to helix curve |
| **right-helix-forward** | 3.21mm | Slightly floating | Snap to helix curve |

---

## Surface Normal Analysis

Surface normals indicate the direction jewelry should point. Key findings:

### Correctly Oriented
- **Nostrils**: Normals point outward at ~45° (0.85, -0.27, 0.46) ✅
- **Helix**: Normals point outward/downward (-0.20, -0.94, -0.28) ✅
- **Labret**: Normal points forward/down (0.0, -0.68, -0.74) ✅
- **Nipples**: Normals point outward/up (0.48, -0.36, 0.80) ✅

### Needs Review
- **Conch**: Normals point inward (-0.43, -0.82, 0.38) - This is correct for conch anatomy
- **Tragus**: Normals point strongly outward (0.94, -0.28, 0.20) - Verify jewelry angle

---

## Recommendations

### Immediate Actions

1. **Snap floating anchors to surface** (12 anchors)
   - Use Blender's "Snap to Surface" or run automated snap script
   - Priority: hips, tongue, lobe-3, monroe/madonna, ankles

2. **Fine-tune close anchors** (24 anchors)
   - Optional but recommended for pixel-perfect placement
   - Can be done in batch with snap script

3. **Verify tongue anchor**
   - Currently 8.75mm inside the mouth
   - Either snap to tongue surface or remove if not needed

### Automated Fix Script

I can create a Python script to:
- Snap all anchors to nearest body surface vertex
- Preserve anatomical placement (don't move perfect anchors)
- Align anchor rotation to surface normal
- Generate before/after comparison

### Manual Review Needed

After snapping, verify these anatomically:
- **Conch** (currently flagged as "too high" in anatomical analysis)
- **Snug** (verify no overlap with helix)
- **Vertical labret** (clarify if it's a separate piercing or multi-anchor)

---

## Coordinate System Reference

- **Y-axis**: Vertical (up/down) - Y: 0 = ground, Y: 1.6 = head
- **X-axis**: Horizontal (left/right) - X: 0 = center, +X = left, -X = right
- **Z-axis**: Depth (forward/back) - Z: 0 = back, +Z = front (face)
- **Units**: Meters

---

## Visualization

Color-coded spheres have been added to the Blender scene:
- 🟢 **Green spheres (2mm)**: Perfect placement (< 1mm)
- 🟡 **Yellow spheres (3mm)**: Close placement (1-3mm)
- 🔴 **Red spheres (4mm)**: Floating (> 3mm)

Sphere names: `viz_anchor_[anchor-name]`

---

## Next Steps

**Option A: Automated Snap**
Run a script to snap all anchors to the nearest body surface vertex while preserving anatomical intent.

**Option B: Manual Adjustment**
Use the visualization spheres to manually adjust red and yellow anchors in Blender.

**Option C: Selective Fix**
Only fix the 12 floating anchors (> 3mm), leave close anchors as-is.

---

**Analysis Method:**
- KDTree nearest-neighbor search on 14,164 body vertices
- Distance measured in 3D Euclidean space
- Surface normals extracted from nearest vertex
- All measurements in world space coordinates

**Tools Used:**
- Blender MCP (Model Context Protocol)
- BMesh API for geometry analysis
- KDTree for spatial queries
