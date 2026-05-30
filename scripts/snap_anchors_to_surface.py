"""
Snap anchor points to body mesh surface.

This script analyzes all anchor: empties and snaps them to the nearest
vertex on the Body mesh, preserving anatomical intent while ensuring
precise geometric placement.

Usage in Blender:
    1. Open your body.blend file
    2. Run this script in Blender's Text Editor or via:
       blender body.blend --python snap_anchors_to_surface.py

Options:
    - SNAP_THRESHOLD: Only snap anchors further than this distance (mm)
    - PRESERVE_PERFECT: Don't touch anchors already < 1mm from surface
    - ALIGN_TO_NORMAL: Rotate anchors to match surface normal
"""

import bpy
import bmesh
from mathutils import Vector, kdtree
import json

# Configuration
SNAP_THRESHOLD = 1.0  # Only snap anchors > 1mm from surface
PRESERVE_PERFECT = True  # Don't touch anchors < 1mm
ALIGN_TO_NORMAL = False  # Rotate anchors to match surface normal (experimental)
DRY_RUN = False  # Set to True to preview changes without applying

def snap_anchors_to_surface():
    """Main function to snap all anchors to body surface."""

    # Get the body mesh
    body = bpy.data.objects.get("Body")
    if not body:
        print("❌ ERROR: Body mesh not found")
        return

    print(f"📐 Analyzing body mesh: {body.name}")
    print(f"   Vertices: {len(body.data.vertices)}")

    # Create a BMesh for analysis
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.verts.ensure_lookup_table()

    # Build KDTree for fast nearest-vertex lookup
    print("🔍 Building spatial index...")
    kd = kdtree.KDTree(len(bm.verts))
    for i, vert in enumerate(bm.verts):
        world_pos = body.matrix_world @ vert.co
        kd.insert(world_pos, i)
    kd.balance()

    # Get all anchor empties
    anchors = [obj for obj in bpy.data.objects if obj.name.startswith("anchor:")]
    print(f"🎯 Found {len(anchors)} anchor points")

    # Analyze and snap
    results = {
        "preserved": [],
        "snapped": [],
        "skipped": []
    }

    for anchor in anchors:
        anchor_name = anchor.name.replace("anchor:", "")
        anchor_pos = anchor.location.copy()

        # Find nearest vertex
        nearest_co, nearest_idx, nearest_dist = kd.find(anchor_pos)
        nearest_vert = bm.verts[nearest_idx]
        distance_mm = nearest_dist * 1000

        # Get surface normal
        world_normal = (body.matrix_world.to_3x3() @ nearest_vert.normal).normalized()

        # Decide whether to snap
        if PRESERVE_PERFECT and distance_mm < SNAP_THRESHOLD:
            results["preserved"].append({
                "name": anchor_name,
                "distance_mm": round(distance_mm, 2),
                "reason": "Already on surface"
            })
            print(f"  ✅ {anchor_name}: {distance_mm:.2f}mm (preserved)")
            continue

        # Snap to surface
        if not DRY_RUN:
            anchor.location = nearest_co

            # Optionally align rotation to surface normal
            if ALIGN_TO_NORMAL:
                # Point the anchor's Z-axis along the surface normal
                anchor.rotation_mode = 'QUATERNION'
                anchor.rotation_quaternion = world_normal.to_track_quat('Z', 'Y')

        results["snapped"].append({
            "name": anchor_name,
            "old_position": [round(p, 6) for p in anchor_pos],
            "new_position": [round(p, 6) for p in nearest_co],
            "distance_moved_mm": round(distance_mm, 2),
            "surface_normal": [round(n, 4) for n in world_normal]
        })

        status = "🔧 (DRY RUN)" if DRY_RUN else "🔧"
        print(f"  {status} {anchor_name}: {distance_mm:.2f}mm → snapped to surface")

    bm.free()

    # Print summary
    print("\n" + "="*60)
    print("📊 SUMMARY")
    print("="*60)
    print(f"✅ Preserved (< {SNAP_THRESHOLD}mm): {len(results['preserved'])}")
    print(f"🔧 Snapped to surface: {len(results['snapped'])}")
    print(f"⏭️  Skipped: {len(results['skipped'])}")

    if DRY_RUN:
        print("\n⚠️  DRY RUN MODE - No changes were applied")
        print("   Set DRY_RUN = False to apply changes")
    else:
        print("\n✅ Changes applied successfully")

    # Print detailed snapped anchors
    if results["snapped"]:
        print("\n" + "="*60)
        print("🔧 SNAPPED ANCHORS (sorted by distance)")
        print("="*60)
        sorted_snapped = sorted(results["snapped"], key=lambda x: x["distance_moved_mm"], reverse=True)
        for item in sorted_snapped:
            print(f"  • {item['name']}: moved {item['distance_moved_mm']}mm")

    # Export results to JSON
    output_path = bpy.path.abspath("//anchor_snap_results.json")
    try:
        with open(output_path, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\n💾 Results saved to: {output_path}")
    except Exception as e:
        print(f"\n⚠️  Could not save results: {e}")

    return results

# Run the script
if __name__ == "__main__":
    print("\n" + "="*60)
    print("🎯 ANCHOR SNAP TO SURFACE")
    print("="*60)
    print(f"Configuration:")
    print(f"  • Snap threshold: {SNAP_THRESHOLD}mm")
    print(f"  • Preserve perfect: {PRESERVE_PERFECT}")
    print(f"  • Align to normal: {ALIGN_TO_NORMAL}")
    print(f"  • Dry run: {DRY_RUN}")
    print("="*60 + "\n")

    results = snap_anchors_to_surface()

    print("\n" + "="*60)
    print("✅ SCRIPT COMPLETE")
    print("="*60)
