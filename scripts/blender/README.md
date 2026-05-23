# Blender pipeline scripts

These Python scripts are sent to a **running Blender** session via the
[`blender-mcp`](https://github.com/ahujasid/blender-mcp) MCP server's
`execute_blender_code` tool. They use `bpy` and a live scene — **do not run
them with system Python**; they will not work outside Blender.

## Two pipelines

This directory holds two independent pipelines:

1. **Body pipeline** (`01_inspect.py` … `07_anchors_export.py`) — produces
   `public/models/body/body.glb` + `prisma/seed-data/anchors.json`. Operates
   on the open `art/source/body.blend`. **Run once when the body changes.**
2. **Jewelry pipeline** (`jewelry/`) — produces `art/jewelry-out/<slug>.glb`
   files from `prisma/seed-data/jewelry.json`. Operates in an isolated
   temp scene; **safe to run while body.blend is open**.

## Body pipeline order

| # | Script | Purpose | Output |
|---|---|---|---|
| 1 | `01_inspect.py` | Read-only scene inventory + landmark estimation. | `art/inspect/scene.{json,md}`, `art/inspect/landmarks.json` |
| 2 | `02_prepare.py` | Backup `.blend`, build a clean `Working` collection (rig stripped, transforms applied, scale to ~1.7 m). | Modified scene + `art/source/body.original.blend` |
| 3 | `03_anchors_audit.py` | Ensure every anchor slug is a named empty parented to the working mesh. | `art/inspect/anchors-audit.md` + empties in scene |
| 4 | `04_export_head.py` | Trim, decimate (30–60k tris), Draco export. | `public/models/body/head.glb` + `art/inspect/region-transforms.json` |
| 5 | `05_export_torso.py` | Same as 4 for torso. | `public/models/body/torso.glb` |
| 6 | `06_export_other.py` | Same as 4 for hips/legs. | `public/models/body/other.glb` |
| 7 | `07_anchors_export.py` | Compute anchor positions in each region's local space. | `prisma/seed-data/anchors.json` |

Tasks 2–7 build on Task 1's `landmarks.json`, so always re-run Task 1 if
the source `.blend` changes.

## Jewelry pipeline (`jewelry/`)

Parametric per-piece `.glb` exporter, driven by `prisma/seed-data/jewelry.json`.

| File | Purpose |
|---|---|
| `_jewelry_helpers.py` | Materials, primitives, scene utilities, manifest reader. Documents the **piece-local +Z = body-outward** convention. |
| `shape_*.py` | One module per shape, each exposing `build(params, material_color) -> bpy.types.Object`. Initial shape: `seamless_hoop`; Task 4 adds five more. |
| `build_all.py` | Driver: reads the manifest, dispatches to shape modules, exports Draco-compressed `.glb` to `art/jewelry-out/<slug>.glb`. CLI flags: `--only <slug>`, `--shape <name>`, `--skip-existing`. |

The jewelry pipeline runs in a temporary side-scene per piece, so `body.blend`
is never touched. Output is gitignored under `art/jewelry-out/`; uploaded to
Vercel Blob via `npm run jewelry:upload`; surfaced in the DB by `npm run db:seed`.

End-to-end: see [`docs/14-jewelry-pipeline.md`](../../docs/14-jewelry-pipeline.md).

## Helpers

`_helpers.py` defines `dump_json`, `write_text`, `tri_count`, `vert_count`,
`bbox_world`, `world_xyz`, `union_bbox`, plus `REPO_ROOT` and `repo_path()`.
Each script adds `scripts/blender/` to `sys.path` at the top and imports
helpers from this module.

## Driving from kiro-cli

The orchestration agent calls the MCP tool like this (per script):

```python
# pseudo
code = read_file("scripts/blender/01_inspect.py")
execute_blender_code(code=code)
```

Outputs go to disk under the project tree, so the agent can verify them
with normal file reads after each run.
