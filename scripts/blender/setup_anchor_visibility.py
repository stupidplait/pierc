"""
setup_anchor_visibility.py — make `anchor:*` empties visible in Blender's
viewport so they're easy to find, click, and drag.

Run once after opening art/source/body.blend (e.g. on first launch, or when
you can't see/click the empties). Idempotent.

WHAT IT DOES
  • Sets `empty_display_type = 'SPHERE'`   so each anchor shows as a small
    wireframe sphere instead of the default 3-axis cross.
  • Sets `empty_display_size = 0.005`      (5 mm) — visible but not so big
    it occludes the body surface.
  • Sets `show_name = True`               so the anchor's slug floats next
    to it in the 3D viewport.
  • Color-codes via `color`               L = blue, R = red, CENTER = yellow,
    so left/right ears are unambiguous when zoomed in.

Run from Blender's Text Editor with Alt+P, or via:
    blender --background art/source/body.blend --python scripts/blender/setup_anchor_visibility.py --save
"""

import bpy

L_COLOR = (0.20, 0.55, 1.00, 1.0)   # cool blue
R_COLOR = (1.00, 0.30, 0.30, 1.0)   # warm red
C_COLOR = (1.00, 0.90, 0.20, 1.0)   # yellow

modified = 0
for obj in bpy.data.objects:
    if obj.type != "EMPTY" or not obj.name.startswith("anchor:"):
        continue
    obj.empty_display_type = "SPHERE"
    obj.empty_display_size = 0.005
    obj.show_name = True
    slug = obj.name.removeprefix("anchor:")
    if slug.startswith("left-"):
        obj.color = L_COLOR
    elif slug.startswith("right-"):
        obj.color = R_COLOR
    else:
        obj.color = C_COLOR
    modified += 1

# Use object color in viewport shading (overrides the default white)
for area in bpy.context.screen.areas if bpy.context.screen else []:
    if area.type == "VIEW_3D":
        for space in area.spaces:
            if space.type == "VIEW_3D":
                space.shading.color_type = "OBJECT"
                # Switch to wireframe-y / solid mode where colors show up
                if space.shading.type == "MATERIAL":
                    pass   # keep material preview if user already selected it
                # Hide overlay clutter that crowds the names
                space.overlay.show_relationship_lines = False

print(f"✓ Configured {modified} anchor empties (sphere markers + name labels)")
print(f"  L = blue, R = red, CENTER = yellow")
print(f"  Tip: tap N in the 3D viewport to open the sidebar with X/Y/Z transform fields")
print(f"       for finger-precise nudging once you've clicked an anchor.")
