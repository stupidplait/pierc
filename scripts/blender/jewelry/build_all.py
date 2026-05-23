"""Driver for the parametric jewelry pipeline.

Reads `prisma/seed-data/jewelry.json`, dispatches each piece to its
`shape_*.build()` function, and exports a Draco-compressed `.glb` to
`art/jewelry-out/<slug>.glb`.

Run via the `blender-mcp` MCP server's `execute_blender_code` tool.

Optional CLI-style filter (parsed from `sys.argv` after `--`):
    --only <slug>       build a single piece
    --shape <name>      build only pieces of one shape (e.g. seamless_hoop)
    --skip-existing     don't re-export pieces whose .glb is newer than
                         the manifest's `updatedAt` (rough mtime check)

────────────────────────────────────────────────────────────────────────
WARNING
────────────────────────────────────────────────────────────────────────
This script creates and removes temporary scenes inside the running
Blender session. Your active scene (typically `body.blend`) is never
mutated; the build always runs in a side scene that's deleted on exit.

DO NOT save the .blend file after a build run unless you want to
overwrite `body.blend` — re-open `art/source/body.blend` if unsure.
"""

from __future__ import annotations

import os
import sys
import time
import traceback

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

import bpy  # noqa: E402

from _jewelry_helpers import (  # noqa: E402
    JEWELRY_OUT_DIR,
    enter_build_scene,
    exit_build_scene,
    export_glb_draco,
    output_path,
    read_manifest,
    select_only,
    stats,
)

# ────────────────────────────────────────────────────────────────────────
# Shape dispatch table — extended in Tasks 4 and 5.
# ────────────────────────────────────────────────────────────────────────


def _load_shape(name: str):
    """Lazy-import a shape module by its `shape` field value."""
    import importlib

    mod_name = f"shape_{name}"
    if mod_name in sys.modules:
        # Force reload so iteration on shape scripts doesn't require Blender restart.
        return importlib.reload(sys.modules[mod_name])
    return importlib.import_module(mod_name)


KNOWN_SHAPES = {
    "seamless_hoop",
    "curved_barbell",
    "straight_barbell",
    "horseshoe",
    "labret_stud",
    "nose_stud_l",
}


# ────────────────────────────────────────────────────────────────────────
# Argument parsing (lightweight; argparse trips on Blender's own argv)
# ────────────────────────────────────────────────────────────────────────


def _parse_argv() -> dict:
    """Parse args after `--` (Blender convention) or treat all as ours."""
    argv = sys.argv[:]
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    elif argv and argv[0].endswith(("blender", "blender.exe")):
        argv = argv[1:]

    out = {"only": None, "shape": None, "skip_existing": False}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--only" and i + 1 < len(argv):
            out["only"] = argv[i + 1]
            i += 2
        elif a == "--shape" and i + 1 < len(argv):
            out["shape"] = argv[i + 1]
            i += 2
        elif a == "--skip-existing":
            out["skip_existing"] = True
            i += 1
        else:
            i += 1
    return out


# ────────────────────────────────────────────────────────────────────────
# Build one piece
# ────────────────────────────────────────────────────────────────────────


def build_piece(piece: dict) -> dict:
    """Build a single piece and export it. Returns a result row."""
    slug = piece["slug"]
    shape = piece["shape"]
    material_color = piece.get("materialColor", "titanium")
    out_path = output_path(slug)

    if shape not in KNOWN_SHAPES:
        return {
            "slug": slug,
            "ok": False,
            "error": f"unknown shape '{shape}' (known: {sorted(KNOWN_SHAPES)})",
        }

    original, temp = enter_build_scene(f"jb_{slug[:32]}")
    try:
        mod = _load_shape(shape)
        if not hasattr(mod, "build"):
            raise AttributeError(f"shape_{shape}.py is missing a `build()` function")

        obj = mod.build(piece.get("params", {}) or {}, material_color)
        select_only(obj)
        size = export_glb_draco(out_path, obj)
        s = stats(obj)
        return {
            "slug": slug,
            "ok": True,
            "path": out_path,
            "size": size,
            **s,
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "slug": slug,
            "ok": False,
            "error": f"{type(exc).__name__}: {exc}",
            "trace": traceback.format_exc(),
        }
    finally:
        exit_build_scene(original, temp)


# ────────────────────────────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────────────────────────────


def main() -> None:
    args = _parse_argv()
    manifest = read_manifest()

    if args["only"]:
        manifest = [p for p in manifest if p["slug"] == args["only"]]
        if not manifest:
            print(f"! No piece with slug '{args['only']}' in manifest")
            return
    if args["shape"]:
        manifest = [p for p in manifest if p["shape"] == args["shape"]]
        if not manifest:
            print(f"! No pieces with shape '{args['shape']}' in manifest")
            return

    if args["skip_existing"]:
        manifest = [
            p
            for p in manifest
            if not os.path.exists(output_path(p["slug"]))
        ]

    print(f"→ Building {len(manifest)} piece(s) into {JEWELRY_OUT_DIR}\n")

    t0 = time.time()
    ok_count = 0
    failures: list[dict] = []
    for piece in manifest:
        t1 = time.time()
        result = build_piece(piece)
        elapsed_ms = int((time.time() - t1) * 1000)
        if result["ok"]:
            ok_count += 1
            print(
                f"  ✓ {result['slug']:50s}  "
                f"{result['tris']:5d} tri  "
                f"{result['size']/1024:6.1f} KB  "
                f"{elapsed_ms:4d} ms"
            )
        else:
            failures.append(result)
            print(f"  ✗ {result['slug']:50s}  {result['error']}")

    total_s = time.time() - t0
    print(f"\n→ Done: {ok_count}/{len(manifest)} ok in {total_s:.1f}s")
    if failures:
        print("\n  Failures:")
        for f in failures:
            print(f"    {f['slug']}: {f['error']}")
            if "trace" in f:
                print(f.get("trace", "").rstrip())


if __name__ == "__main__":
    main()
else:
    # When `execute_blender_code` runs the file as a string, __name__
    # is not set to "__main__" — call main() unconditionally.
    main()
