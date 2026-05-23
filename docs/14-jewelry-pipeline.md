# 14 — Parametric Jewelry Pipeline

How `~22` real `.glb` jewelry models get from a JSON manifest into the
`/catalog` showroom, end-to-end.

## Overview

```
prisma/seed-data/jewelry.json     ← source of truth (committed)
        │
        ├──► scripts/blender/jewelry/build_all.py            (run inside Blender via MCP)
        │     ├── _jewelry_helpers.py                        (shared utilities)
        │     ├── shape_seamless_hoop.py
        │     ├── shape_curved_barbell.py
        │     ├── shape_straight_barbell.py
        │     ├── shape_horseshoe.py
        │     ├── shape_labret_stud.py
        │     └── shape_nose_stud_l.py
        │
        ├──► art/jewelry-out/<slug>.glb                      (gitignored, real-scale meters)
        │
        ├──► npm run jewelry:upload                          (scripts/jewelry-upload.ts)
        │     └──► prisma/seed-data/jewelry-uploads.json     (committed: slug → blobUrl + hash)
        │
        └──► npm run db:seed
              └──► Jewelry rows with glbUrl set, status=PUBLISHED
                   └──► /catalog renders real models on body anchors
```

`npm run jewelry:rebuild` chains the last two steps so iterating after a
Blender build is one command.

## Manifest schema

Each entry in `prisma/seed-data/jewelry.json`:

```json
{
  "slug": "seamless-hoop-titanium-8mm-16g",
  "name": "Безшовное кольцо 8 мм · 1.2",
  "categorySlug": "earrings",
  "shape": "seamless_hoop",
  "params": {
    "diameterMm": 8,
    "gaugeMm": 1.2
  },
  "material": "Титан G23",
  "materialColor": "titanium",
  "gauge": 1.2,
  "size": 8,
  "color": "Серебристый",
  "stones": null,
  "price": 1500,
  "inStock": 5,
  "featured": true,
  "anchorSlugs": ["left-ear-lobe", "right-ear-lobe", "left-helix", "right-helix"]
}
```

| Field | Type | Notes |
|---|---|---|
| `slug` | string, unique | kebab-case, idempotent upsert key, future `/catalog/<slug>` URL |
| `name` | string | shown in admin + catalog (Russian) |
| `categorySlug` | enum | `earrings` \| `helix` \| `septum` \| `labret` \| `nostril` \| `eyebrow` \| `navel` \| `nipple` |
| `shape` | enum | `seamless_hoop` \| `curved_barbell` \| `straight_barbell` \| `horseshoe` \| `labret_stud` \| `nose_stud_l` |
| `params` | object | per-shape — only Blender reads it; see "Shape reference" below |
| `material` | string | display label, e.g. `"Титан G23"`, `"Золото 585"`, `"Розовое золото 585"` |
| `materialColor` | enum | PBR key consumed by Blender: `titanium` \| `gold-585` \| `rose-gold-585` \| `black-pvd` |
| `gauge` | number, mm | DB column |
| `size` | number, mm | DB column (interpretation per shape — usually diameter or shaft length) |
| `color` | string | display label, e.g. `"Серебристый"`, `"Золотой"`, `"Чёрный"` |
| `stones` | string \| null | display label, e.g. `"Циркон"`, `"Опал"`, or `null` for plain metal |
| `price` | number | RUB, displayed as integer |
| `inStock` | integer ≥ 0 | catalog availability |
| `featured` | boolean | bumps the piece to the top of category lists + landing carousel |
| `anchorSlugs` | string[] | which body anchors this piece can attach to (filtered to existing anchors at seed time) |

The seed loop in `prisma/seed.ts` upserts by `slug` and joins each piece
with the upload map (`jewelry-uploads.json`); pieces that don't yet have
an uploaded `.glb` stay `status: "DRAFT"` (invisible on `/catalog`),
flipping to `PUBLISHED` once the upload step runs.

## Shape reference

All shapes follow the **piece-local +Z = body-outward** convention and
export at real-world meters scale (1.7 m body height ⇒ 1.2 mm gauge ≈
0.0012 m). This matches the placeholder torus in
`components/catalog/EquippedPieces.tsx` so existing anchor rotations work
without retuning.

| Shape | Origin | Outward axis | Required params | Optional params |
|---|---|---|---|---|
| `seamless_hoop` | Centre of ring (XY plane) | +Z | `diameterMm`, `gaugeMm` | — |
| `curved_barbell` | Centre of "in" ball | +Z | `shaftLengthMm`, `gaugeMm` | `ballSizeMm`, `bowDepthMm` |
| `straight_barbell` | Centre of "in" ball | +Z | `shaftLengthMm`, `gaugeMm` | `ballSizeMm` |
| `horseshoe` | Centre of arc; gap faces +Y | +Z | `diameterMm`, `gaugeMm` | `ballSizeMm`, `gapDegrees` (default 90) |
| `labret_stud` | Body surface (disc-shaft junction) | +Z | `shaftLengthMm`, `gaugeMm`, `topShape` | `discDiameterMm`, `topSizeMm`, `topGemColor` |
| `nose_stud_l` | Inside of L elbow | +Z | `gaugeMm`, `topShape` | `visibleLengthMm`, `insideLengthMm`, `topSizeMm`, `topGemColor` |

`topShape` for `labret_stud` is `"ball"` \| `"disc"` \| `"gem"`.
`topShape` for `nose_stud_l` is `"ball"` \| `"gem"`.
When `topShape == "gem"`, `topGemColor` must be one of:
`"clear"` (transmissive), `"pink"`, `"blue"`, `"opal-white"` (slight emissive).

PBR materials are defined in `_jewelry_helpers.py::MATERIAL_COLORS` and
`GEM_COLORS`. Each metal entry is `(r, g, b, metallic, roughness)`; each
gem is `(r, g, b, transmission, ior, emissive_strength)`.

## Re-export workflow

### Adding a new piece (no new shape)

Just add a manifest entry. Slug must be unique.

```bash
# 1. Open art/source/body.blend in Blender (BlenderMCP addon connected).
# 2. Edit prisma/seed-data/jewelry.json, append the new piece.
# 3. Build the new piece via the MCP execute_blender_code tool:
#       (sys.argv = ["build_all.py", "--", "--only", "<new-slug>"])
#       (exec build_all.py inside Blender)
# 4. Upload + seed:
npm run jewelry:rebuild
# 5. Open /catalog — the piece is live.
```

### Changing an existing piece's params

Same flow. Hash-based dedup in `jewelry-upload.ts` notices the file
changed, deletes the old blob, uploads the new one, updates
`jewelry-uploads.json`. The seed picks up the new URL.

### Adding a new shape

1. Create `scripts/blender/jewelry/shape_<name>.py` with a
   `def build(params: dict, material_color: str) -> bpy.types.Object`
   function. The returned object must:
   - have its origin at the convention-correct point (see the table)
   - have local +Z pointing the convention-correct direction
   - be at real-world meters scale (use `mm()` helper)
   - have at least one material slot assigned

2. Add the shape's name to `KNOWN_SHAPES` in `build_all.py`.

3. Document the shape's row in this file's "Shape reference" table.

4. Add at least one manifest entry that uses it.

5. Build via Blender MCP and verify the bbox.

`_jewelry_helpers.py` exports the API surface — see its module docstring
for the convention rationale and the function reference. Common
primitives: `add_torus`, `add_uv_sphere`, `add_ico_sphere`, `add_cylinder`,
all in mm input. Mesh utilities: `apply_transforms`, `set_origin_to_world`,
`join_meshes`. Materials: `make_metal_material`, `make_gem_material`.
Export: `export_glb_draco`. Scene safety: `enter_build_scene` /
`exit_build_scene` (see "Scene safety" below).

## Scene safety

The jewelry pipeline runs in **temporary side scenes**, never touching the
user's active scene (typically `body.blend`). Each call to `build_piece()`:

1. `enter_build_scene("jb_<slug>")` — creates and activates a new empty scene.
2. The shape script builds its mesh into that scene.
3. `export_glb_draco(...)` writes the `.glb` to `art/jewelry-out/`.
4. `exit_build_scene(...)` — switches the active scene back to the
   original, removes the temp scene, then runs `bpy.data.orphans_purge()`
   to clean up unreferenced objects, meshes, materials, and curves.

After running `build_all.py` for 22 pieces, the body scene's object count
returns to its baseline — no leaks. Do not call `bpy.ops.wm.save_mainfile()`
from a build script; if you accidentally save Blender after a failed build,
re-open `art/source/body.blend`.

## Prerequisites

| Tool | Purpose | Required for |
|---|---|---|
| Blender 3.6+ | runs the shape scripts | `build_all.py` |
| `blender-mcp` addon | exposes `execute_blender_code` to Kiro CLI | `build_all.py` |
| `BLOB_READ_WRITE_TOKEN` in `.env` | Vercel Blob upload | `npm run jewelry:upload` |
| Neon Postgres + `DATABASE_URL` | DB seed | `npm run db:seed` |

If `BLOB_READ_WRITE_TOKEN` is unset, `npm run jewelry:upload` exits with a
clear error message; the seed still runs and creates `Jewelry` rows
(`status: "DRAFT"`, `glbUrl: null`) so the admin UI lists the pieces with
the pink-torus placeholder until the upload step completes.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Piece appears 25× too big or too small on `/catalog` | `Jewelry.glbScale` is wrong | Default is `1` for the parametric pipeline. If the piece was uploaded by the Tripo3D path, set `glbScale = 0.025`. |
| Piece appears at the wrong angle on the body | Anchor rotation doesn't match shape's outward axis | Confirm the shape exports with local +Z = body-outward. The anchor's stored rotation maps that to world space. |
| Piece is missing from `/catalog` | `status: "DRAFT"` (no upload yet) or wrong `anchorSlugs` | Run `npm run jewelry:rebuild`; check `anchorSlugs` matches existing slugs in `prisma/seed-data/anchors.json`. |
| `npm run jewelry:upload` exits with token error | `BLOB_READ_WRITE_TOKEN` is empty | Get a Vercel Blob R/W token from the Vercel dashboard (Storage → Blob → `.env.local`) and set it in `.env`. |
| Build script fails with "unknown shape" | Manifest's `shape` field doesn't match a `shape_*.py` module | Check the slug in `KNOWN_SHAPES` (`build_all.py`) and that `shape_<name>.py` exists. |
| Re-running `npm run jewelry:upload` re-uploads everything | Hash drift (manifest changed but `jewelry-uploads.json` wasn't committed yet) | Commit `jewelry-uploads.json` after each successful upload. |
| Repeated builds in one Blender session leak objects | Old Blender (< 2.90) or `bpy.data.orphans_purge` unavailable | Manual fallback path runs automatically; minor leak is harmless but can be cleaned up by closing+reopening Blender. |

## Inventory

The current 22-piece catalog covers all 8 categories (`earrings`, `helix`,
`septum`, `labret`, `nostril`, `eyebrow`, `navel`, `nipple`) with at least
2 pieces each. Three are featured (`seamless-hoop-titanium-8mm-16g`,
`labret-titanium-pink-gem-8mm-16g`, `nose-stud-l-gold585-opal-18g`) and
appear at the top of category lists + the landing-page carousel.

Total disk: ~210 KB Draco-compressed, ~1 MB uncompressed. Well under any
Vercel Blob tier limit.
