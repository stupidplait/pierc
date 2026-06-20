# 20 — Multi-anchor jewelry system (Phase B)

**Status:** shipped May 2026

This doc is the canonical reference for how the catalog represents jewelry that
attaches at one OR several anchor points simultaneously — studs (1), barbells
(2), orbital rings (2), corset ladders (N).

It supersedes the implicit `_JewelryAnchors` M2M used in Phase A (which could
only model "this stud is compatible with these anchors") and introduces an
explicit junction table that also expresses "this industrial bar occupies
these two anchors at once".

## Why this exists

Phase A treated every jewelry piece as a single attach point: the catalog
stored a list of *compatible* anchors per piece, and at equip-time the user
picked one. That model breaks for any piece that physically pierces multiple
holes:

| Piece                         | Holes  | Phase-A model           | Phase-B model          |
| ----------------------------- | ------ | ----------------------- | ---------------------- |
| Lobe stud                     | 1      | ✅ compat list           | ✅ compat list, type=STUD |
| Septum horseshoe              | 1      | ✅ compat list           | ✅ compat list, type=RING |
| Industrial barbell            | 2      | ❌ approximated as 1     | ✅ fixed bindings, type=BARBELL |
| Orbital ring                  | 2      | ❌ approximated as 1     | ✅ fixed bindings, type=ORBITAL |
| Cheek dimples (paired studs)  | 2      | ❌ split into 2 catalog rows | ✅ fixed bindings, type=BARBELL or 2 STUD rows |
| Corset (vertical ladder)      | 4–12   | ❌ unsupported           | ✅ fixed bindings, type=CHAIN_LADDER |

Industry reference: Maria Tash's Tash Studio (3D try-on, public since 2023)
treats each pierceable point as one anchor and stores per-jewelry attachment
metadata so rings + studs render at anatomically correct positions with
gravity-aware physics. We mirror that point-anchor model.

## The data model

### Schema (Prisma)

```prisma
enum JewelryType {
  STUD              // 1 attach point, semantics="compat-list"
  RING              // 1 attach point, semantics="compat-list"
  BARBELL           // 2 attach points, semantics="fixed"
  CIRCULAR_BARBELL  // 2 attach points, semantics="fixed"
  ORBITAL           // 2 attach points, semantics="fixed"
  CHAIN_LADDER      // 2..N attach points, semantics="fixed"
}

model Jewelry {
  // … existing fields
  type            JewelryType            @default(STUD)
  anchorBindings  JewelryAnchorBinding[]
}

model JewelryAnchorBinding {
  id        String      @id @default(cuid())
  jewelry   Jewelry     @relation(fields: [jewelryId], references: [id], onDelete: Cascade)
  jewelryId String
  anchor    AnchorPoint @relation(fields: [anchorId], references: [id])
  anchorId  String
  /** 0-indexed: 0 → mesh's `attach:primary`, 1 → `attach:secondary`, … */
  order     Int         @default(0)
  createdAt DateTime    @default(now())

  @@unique([jewelryId, anchorId, order])
  @@index([jewelryId])
  @@index([anchorId])
}
```

`AnchorPoint.jewelryBindings` is the inverse relation. The old implicit M2M
relation `Jewelry.anchors AnchorPoint[]` was dropped during the Phase B push;
its data is regenerated from `prisma/seed-data/jewelry.json`.

### Two semantics, one table

The same `JewelryAnchorBinding` table is read two different ways, switched by
`Jewelry.type`:

#### `STUD` / `RING` — "compat-list" semantics

- Each row represents an alternative anchor the user can equip the piece on.
- All rows have `order = 0` (no ordering between them).
- One stud might have 6 rows: "wearable on left/right helix, left/right
  tragus, left/right conch."
- At equip time the user picks ONE anchor; the piece occupies just that one
  hole. Other compatibility-list anchors stay free for other jewelry.

#### `BARBELL` / `CIRCULAR_BARBELL` / `ORBITAL` / `CHAIN_LADDER` — "fixed" semantics

- All rows are equipped TOGETHER. The piece occupies every anchor in the
  list simultaneously.
- `order` matters: row 0 → mesh's `attach:primary` empty, row 1 →
  `attach:secondary`, etc.
- Different placements (left vs right ear industrial; orbital on helix
  vs lobe) are **separate `Jewelry` rows**, each with its own fixed
  bindings.
- Length must equal the type's expected attach-point count (validated in
  both `prisma/seed.ts` and `lib/admin/jewelry-actions.ts`).

### Validation rules (kept in sync between seed + admin form)

```
type             | min | max | semantics
-----------------+-----+-----+-------------
STUD             |  1  |  ∞  | compat-list
RING             |  1  |  ∞  | compat-list
BARBELL          |  2  |  2  | fixed
CIRCULAR_BARBELL |  2  |  2  | fixed
ORBITAL          |  2  |  2  | fixed
CHAIN_LADDER     |  2  |  8  | fixed
```

The admin form's "Анкеры (где можно носить)" multi-select lists every
`AnchorPoint`; the user picks N items. The submit-time validator (in
`lib/admin/jewelry-actions.ts → upsertJewelry`) checks N against the type's
rule and returns a friendly Russian error if it doesn't match.

## The mesh side: `attach:*` empties

Every jewelry GLB ships with one or more named empty nodes:

```
attach:primary    — required. mesh-local origin of the FIRST attach point.
                    Used by the renderer for both 1-anchor and N-anchor cases.
attach:secondary  — required for 2-anchor types. Mesh-local origin of the
                    SECOND attach point.
attach:tertiary, attach:quaternary, …
                  — for CHAIN_LADDER, additional rungs, in order.
```

### Convention

- Each empty's local `+Z` axis = body-outward direction at that attach point.
- `attach:primary` should sit where the post enters the skin (or, for hoops,
  on the band at the top — `(0, +majorR, 0)` — where the ring crosses the
  piercing, so the hoop hangs down from the anchor).
- Mesh origin should coincide with `attach:primary` whenever possible — that
  way the renderer's 1-anchor fallback (mesh at anchor.position with
  anchor.rotation) lines up with the more precise empty-based math.

### Parametric pipeline

`scripts/blender/jewelry/_jewelry_helpers.py` exposes:

```python
def add_attach_empty(name, *, location=(0, 0, 0), rotation=(0, 0, 0)):
    bpy.ops.object.empty_add(type="PLAIN_AXES", ...)
    obj.empty_display_size = 0.004
    return obj
```

Each shape script's `build()` returns a tuple `(mesh, attach_primary[,
attach_secondary[, attach_tertiary]])`; `build_all.py` selects all of them
and exports together via `export_glb_draco(path, mesh, *extras)`.

Per shape:

| Shape              | attach:primary               | attach:secondary           | attach:tertiary            |
|--------------------|------------------------------|----------------------------|----------------------------|
| `seamless_hoop`    | top of band (0, +majorR, 0)  | —                          | —                          |
| `horseshoe`        | ring center (0,0,0)          | left ball-tip              | right ball-tip             |
| `straight_barbell` | "in" ball (0,0,0)            | "out" ball (0,0,L)         | —                          |
| `curved_barbell`   | "in" ball (0,0,0)            | "out" ball (0,0,L)         | —                          |
| `labret_stud`      | body surface (0,0,0)         | —                          | —                          |
| `nose_stud_l`      | elbow (0,0,0)                | —                          | —                          |

`horseshoe` carries 3 empties because the same shape is used for two distinct
types: when worn through a single hole (RING — septum / lip-medusa) the
renderer reads only `attach:primary`; when worn through 2 holes
(CIRCULAR_BARBELL) the renderer reads `secondary` + `tertiary` and ignores
`primary`.

### AI-generated GLBs

AI generation (Replicate, Tripo3D) produces meshes with arbitrary geometry
and no attach metadata. Two consequences:

1. **AI is restricted to STUD / RING and straight/curved BARBELL** (the
   `isAiGeneratableType` allow-list in `lib/catalog/types.ts`). For a BARBELL,
   `normalizeBarbellDocument` (`lib/admin/glb-normalize.ts`) recovers the two ball
   ends via PCA and injects `attach:primary`/`attach:secondary`; the multi-anchor
   renderer derives scale from the two-anchor span (no `glbScale`). The remaining
   multi-anchor types — `CIRCULAR_BARBELL` (horseshoe), `ORBITAL`, `CHAIN_LADDER` —
   need endpoint placement AI can't reliably produce (a horseshoe's tips are at the
   gap, not the PCA extremes), so they stay parametric-only. Enforced in both UI
   (`<JewelryModelManager>` hides the auto-gen panel) and server
   (`startJewelryGeneration` rejects them with a 4xx).
2. **AI GLBs without `attach:primary` use the legacy fallback:** mesh placed
   at `anchor.position` with `anchor.rotation`. This is fine if the mesh's
   origin happens to be near the post tip; for AI pieces where that isn't
   true, an admin-side point-picker is the future improvement (see "Future
   work" below).

See [`docs/18-replicate-3d.md`](./18-replicate-3d.md) for the full AI
pipeline.

## The renderer

`components/catalog/EquippedPieces.tsx`:

1. **Group equipped entries by jewelryId.** The equipped map is
   `{ anchorId: jewelryId }`; multi-anchor pieces have multiple entries
   pointing to the same jewelry. We bucket them via `groupEquipped()` so
   each piece renders ONCE regardless of how many anchors it occupies.
2. **Resolve attach empties.** `readAttachLocals()` traverses the cloned GLB
   scene, finds every `attach:*` node, and returns their local positions in
   order primary → secondary → … (first missing name terminates).
3. **Compute the placement transform.**

   - **1 anchor equipped:** apply `anchor.rotation` and translate so
     `attach:primary` (if present) lands exactly on `anchor.position`.
     Falls back to legacy "place mesh at anchor" when no empty exists.
   - **2+ anchors equipped:** compute the rigid transform that maps
     `attach[0..N-1]` onto `anchor[0..N-1].position`:

     ```ts
     const meshDir   = meshAttachB.sub(meshAttachA);
     const worldDir  = worldAnchorB.sub(worldAnchorA);
     const scale     = worldDir.length() / meshDir.length();
     const rotation  = new Quaternion().setFromUnitVectors(
       meshDir.normalize(),
       worldDir.normalize()
     );
     const position  = worldAnchorA.sub(
       meshAttachA.applyQuaternion(rotation).multiplyScalar(scale)
     );
     ```

     For N>2 the math uses just the first two attach points. The remaining
     attach points are advisory (renderer doesn't enforce them); chain
     ladder rendering is a future task.

The single rotational DOF around the bar axis is left free — fine for
rotationally symmetric barbells. For asymmetric pieces (e.g. orbitals with a
gem on one side), add an `attach:up` reference vector and constrain the third
DOF to align with `worldUp`.

## Camera framing

`components/catalog/CameraRig.tsx`:

- Single-anchor: legacy behaviour — tween to `anchor.cameraPresets[0]`.
- Multi-anchor (when an anchor is part of an equipped multi-anchor jewelry's
  binding set): centre on the centroid of all endpoints, scale the preset's
  camera-distance up so the bbox fits the frustum at the configured FOV.

The selected anchor still drives WHICH preset's angle/FOV is used — the
multi-anchor case just rebases the position on the centroid and pulls the
camera back. No backwards compatibility break: `equippedAnchorsForFraming`
and `equippedJewelry` are optional props.

## UX surfaces

### Catalog sidebar (`components/catalog/CatalogSidebar.tsx`)

Each jewelry row in the list shows a "N проколов" badge under the name when
`piercingCount > 1`. The badge text uses Russian pluralisation (1 прокол / 2
прокола / 5 проколов) via `piercingCountLabel()` in `lib/i18n/ru.ts`.

### Booking flow (`components/booking/JewelryStep.tsx`)

The same badge appears on each booking-step jewelry row. Customer sees "this
piece = 2 piercings" before they confirm.

### Admin form (`components/admin/JewelryForm.tsx`)

A "Тип украшения" dropdown lists all 6 enum values with Russian labels and a
hint line under the field explaining the semantics:

- "Тип «Пирсинг в одной точке». Можно отметить несколько анкеров — клиент сам
  выберет, куда надевать." (compat-list types)
- "Тип «Через несколько проколов». Анкеры — это фиксированные концы изделия
  (например, 2 точки для индастриала). Порядок имеет значение." (fixed types)

The "Анкеры (где можно носить)" multi-select section header copies the same
content; we don't add a separate "ordered list" UI yet — the admin checks
items in the order they should bind (primary first), and the server uses the
form's natural submission order. (When more sophisticated ordering UI is
needed, switch the section to a sortable list.)

## How to add a real multi-anchor piece

1. **Add the anchors** the piece will occupy to `prisma/seed-data/anchors.json`
   if they don't exist. For an industrial bar that's typically two new
   anchors per ear: `left-helix-forward-bar` + `left-helix-posterior-bar`.
   See [`docs/07-3d-fitting.md`](./07-3d-fitting.md) for the anchor placement
   workflow.
2. **Decide the type.** Industrial = `BARBELL`. Orbital ring = `ORBITAL`.
   Septum-clicker through 2 holes = `CIRCULAR_BARBELL`.
3. **Add the piece to `prisma/seed-data/jewelry.json`:**

   ```json
   {
     "slug": "industrial-titanium-32mm-14g-left",
     "name": "Индастриал титан · 32 мм · 1.6 (левый)",
     "categorySlug": "helix",
     "shape": "straight_barbell",
     "type": "BARBELL",
     "params": { "shaftLengthMm": 32, "gaugeMm": 1.6, "ballSizeMm": 4 },
     "material": "Титан G23",
     "materialColor": "titanium",
     "gauge": 1.6, "size": 32, "color": "Серебристый", "stones": null,
     "price": 2400, "inStock": 3, "featured": false,
     "anchorSlugs": [
       "left-helix-forward-bar",
       "left-helix-posterior-bar"
     ]
   }
   ```

   `anchorSlugs` order = bindings order. First entry → `attach:primary`,
   second → `attach:secondary`.

4. **Build + upload + seed:**

   ```bash
   # Inside Blender (with the parametric pipeline):
   bpy.ops.script.python_file_run({"filepath":
     "scripts/blender/jewelry/build_all.py"})

   # Then in your terminal:
   npm run jewelry:upload
   npm run db:seed
   ```

5. **Smoke test.** Open `/catalog`, click `left-helix-forward-bar`, the new
   piece should appear in the right-hand list with a "2 прокола" badge. Click
   "Примерить" — the bar should render between both anchors. Camera should
   pull back to fit both endpoints.

## Future work

- ✅ **3D point-picker for AI-generated GLBs — DONE.** `GlbInspector` has a
  "Поставить точку" mode (click-to-set gizmo) backed by `setJewelryAttachPoint` →
  `setGlbAttachPoint`; for multi-anchor (BARBELL) pieces a Конец 1 / Конец 2 toggle
  chooses whether the pick writes `attach:primary` or `attach:secondary`.
- ✅ **Constrained third DOF (`attach:up`) — DONE.** `readAttachUp` +
  `placeMultiAnchor` (lib/catalog/place-jewelry.ts) roll the piece about the bar so
  a GLB's optional `attach:up` reference aligns with world up — for asymmetric
  multi-anchor pieces. With no `attach:up` node the roll is left free (fine for
  symmetric bars).
- **CHAIN_LADDER per-segment rendering.** Currently the renderer uses just
  the first two attach points for any 2+ binding piece. A real corset
  rendering would render N-1 short barbell segments, each spanning two
  consecutive anchors. Defer until a corset piece is actually requested.
- **Phase A anchors expansion.** This Phase B handled architecture; the
  catalog still has only 29 anchors. The natural Phase A follow-on is
  adding the missing anchors (forward-helix, anti-tragus, snug, lobe-2,
  lobe-3, monroe, snake-bites, cheek, bridge) which then unlocks real
  multi-anchor catalog entries. See the chat history for the full proposed
  inventory.
