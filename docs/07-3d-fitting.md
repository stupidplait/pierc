# 07 — 3D Fitting

> **v1 status (Task 5).** The showroom is live at `/catalog`. The body is a **procedural mannequin** built from primitives (sphere head, cylinder neck/torso/hips, etc.) — a placeholder until a real body GLB is sourced. The 20 seeded anchor positions are tuned against this geometry; they'll be re-tuned in Task 15 when the real GLB lands. The data shape (`AnchorPoint.position` + `cameraPresets`) is unchanged between placeholder and real model.

## Body model

The 3D try-on uses **a single GLB** at `public/models/body/body.glb` — one CC3 / Character Creator 3 base baked in A-pose, exported with Draco mesh compression and Y-up, ~340 KB. It contains five meshes: `Body`, `Hair_30629`, `Eye`, `Teeth`, `Underwear_Bottoms`. The body parts use a flat neutral-gray Principled BSDF (`#cfcfcf`, roughness 0.75) for a mannequin aesthetic; only `Hair` keeps textures (1024² Opacity map for alpha-clip transparency, glTF `alphaMode: MASK`). The 29 anchor positions are also embedded as named glTF nodes (`anchor:left-ear-lobe`, etc.) so the runtime can read transforms directly from the GLB if it prefers — same data is mirrored in the DB for filter/UI metadata.

Source `.blend` is kept locally under `art/source/` (gitignored). The export pipeline lives in `scripts/blender/` and runs via the [`blender-mcp`](https://github.com/ahujasid/blender-mcp) MCP server.

### Anchor categorization — `place` + `side`

Anchors are grouped by **anatomical place** (not by HEAD/TORSO/OTHER region — there's no region split anymore). Each anchor has a `place` (one of nine) and a `side`. The picker UI uses `place` as the primary tab strip; `side` enables sub-labels for paired anchors.

| `place` | Anchor slugs | RU |
|---|---|---|
| `EAR` (×L/R) | lobe, helix, tragus, conch, daith, rook, industrial | мочка, хеликс, козелок, конха, дейс, рук, индастриал |
| `NOSE` | left-nostril, right-nostril, septum | ноздри, септум |
| `LIPS` | lip-medusa, lip-labret | медуза, лабрет |
| `EYEBROW` (×L/R) | eyebrow | бровь |
| `TONGUE` | tongue | язык |
| `NIPPLE` (×L/R) | nipple | сосок |
| `NAVEL` | navel | пупок |
| `HIP` (×L/R) | hip | бедро |
| `ANKLE` (×L/R) | ankle | лодыжка |

Total: 29 anchors. `surface-*` is admin-defined and not seeded.

> **v1 deviation:** the original spec proposed splitting the body into three regional GLBs (`head.glb`, `torso.glb`, `other.glb`) loaded one at a time, with region tabs. With ~28k tris on the body alone — well under one mobile-friendly GLB budget — splitting added pipeline complexity without a payload win. The single-GLB choice is final; if mobile fps degrades on a fully-equipped look, jewelry GLBs can be lazy-loaded per anchor (the body doesn't need to split).

## Anchor points

Each anchor (e.g., `left-ear-lobe`) is a row in `AnchorPoint` with:
- `place` — one of `EAR / NOSE / LIPS / EYEBROW / TONGUE / NIPPLE / NAVEL / HIP / ANKLE`. Drives the picker tab strip.
- `side` — `L`, `R`, or `CENTER`. Used to show "Левое / Правое" sub-labels for paired anchors and to mirror across the YZ plane on the body.
- `position` — XYZ in `body.glb` local space (Y-up, +Z out of screen). Same coordinates as the matching glTF empty node.
- `rotation` — default jewelry orientation (Euler XYZ in radians). For most anchors `+Z` points outward (perpendicular to skin); `tongue` is `+Z` straight up because tongue jewelry is a vertical post.
- `cameraPresets` — list of named camera framings (front, side, ¾, etc.). Anchor's first preset is the default focus view.

In the scene, anchors are rendered as small **glowing markers** by `<AnchorDots>`:
- White dots by default; emissive hot-pink (`#fe017e`) when active.
- Scale up on hover (desktop).
- Selected dot pulses softly (`useFrame` driven sin-wave scale) to confirm focus.
- Dimmed (alpha 0.35) when another anchor is selected, so the focused one stands out.

On click/tap, the dot becomes the active anchor and the camera smoothly tweens to its first preset.

## Camera behaviour

When an anchor is active, `<CameraRig>` interpolates two values per frame:
- `camera.position` toward the preset's position (lerp factor `0.08`).
- An internal `lookAt` point toward the preset's target. `camera.lookAt(currentLook)` is called every frame.

`fov` snaps to the preset's value on selection (the projection matrix is updated once, not lerped — FOV lerping looks gauzy).

When no anchor is selected, the camera tweens back to a default "see the whole body" view (`position: (0, 1.25, 1.6)`, `target: (0, 1.05, 0)`, `fov: 35`).

> **v1 deviation:** the original spec proposed `OrbitControls` with strict ±15° azimuth/polar limits around the active preset. v1 ships **no `OrbitControls`** — the camera is purely curated, snapping between presets. Users can't lose framing because they can't move the camera at all. If user testing reveals the lock feels too rigid, a small `±15°` opt-in nudge can be added later.

### UX rationale (still valid)

Free orbit feels powerful but is actually worse for product-fit decisions:
- Users get lost and can't compare angles.
- The piercing can be hidden by limbs / hair.
- Performance suffers from arbitrary view directions.

High-end product configurators (Apple product pages, IKEA Place) use the same locked-preset + small-nudge pattern.

## Multi-jewelry try-on

The viewer renders **several jewelries simultaneously** to preview a complete look. Constraints:

- **One piece per anchor.** Placing a new jewelry on an already-occupied anchor replaces the previous piece.
- **Soft cap of 6 simultaneous pieces.** Configured in `lib/catalog/types.ts` as `SOFT_CAP = 6`. Equip buttons on the 7th piece are disabled with a tooltip; a banner explains the cap.
- **Sidebar tray.** A side panel on desktop, stacked below the 3D viewport on mobile. Lists currently-fitted pieces with per-item remove (×) and an `X/6` counter.
- **Filtered jewelry list.** Below the tray, the same sidebar shows jewelry compatible with the active anchor (or all jewelry if no anchor is selected). Each row has `Примерить` / `Снять` buttons.

> **v1 deviation:** the original spec proposed an explicit `Добавить ещё` button that opens a separate inline picker. Since the always-visible filtered list already serves that role, the dedicated button isn't needed. If the catalog grows and the sidebar feels heavy, a collapsed picker can be reintroduced.

## Component shape (current)

```ts
// lib/catalog/types.ts
type EquippedMap = Record<string, string>;  // anchorId -> jewelryId
const SOFT_CAP = 6;

// components/catalog/Showroom.tsx (client)
<Showroom
  anchors={anchors}                          // AnchorWire[] (with positions + cameraPresets)
  jewelry={jewelry}                          // JewelryWire[] (PUBLISHED only)
  initialSelectedId={initialSelectedId}      // server-parsed from ?anchor
  initialEquipped={initialEquipped}          // server-parsed from ?eq
/>
```

Internally:

```
<Showroom>
  <ShowroomScene>          (dynamic import, ssr:false)
    <Canvas>
      <Mannequin />        procedural body
      <AnchorDots />       20 clickable dots
      <EquippedPieces />   placeholder torus per equipped anchor
      <CameraRig />        tweens position + lookAt + fov
    </Canvas>
  </ShowroomScene>
  <CatalogSidebar>         combobox + tray + filtered list
</Showroom>
```

When a jewelry has a real `glbUrl` (Task 8), `<EquippedPieces>` will switch from the placeholder torus to a `<primitive object={gltf.scene} />` instance, scale-calibrated by `gauge` / `size`.

## URL state

Shareable looks are encoded in the query string:

```
/catalog?anchor=left-ear-lobe&eq=left-ear-lobe:abc,right-helix:xyz
```

| Param | Purpose |
|---|---|
| `anchor` | Anchor slug currently focused. Drives the camera + the sidebar's filtered list. |
| `eq` | Comma-separated `<anchorSlug>:<jewelryId>` pairs. Order is irrelevant; capped at 6. |
| `view=grid` | Render `<CatalogGridFallback>` (the 2D card grid) instead of the 3D scene. Used when WebGL is unavailable or the user prefers a flat list. |

The same `eq` param can feed the booking flow (`/book?items=...`) once Task 11 lands — a fully composed look survives a refresh, can be shared, and is bookable in one click.

The detail page `/catalog/[id]` deep-links into the showroom by emitting:

```
/catalog?anchor=<primaryAnchorSlug>&eq=<primaryAnchorSlug>:<jewelryId>
```

…using the jewelry's first compatible anchor as the "primary" focus.

## Mobile performance recipe (target)

| Optimization | Detail |
|---|---|
| Mesh compression | Draco or Meshopt on every GLB (when real GLBs land) |
| Textures | KTX2 / Basis Universal, max 1024² |
| Lighting | 3-light setup (warm key, cool fill, brand rim); no realtime shadows or HDR env |
| DPR clamp | `<Canvas dpr={[1, 1.75]}>` — caps device pixel ratio (active in v1) |
| Lazy loading | Showroom scene is dynamically imported with `ssr:false` (active in v1); jewelry GLBs will lazy-load with `<Suspense>` skeletons |
| Concurrent loads | 1 body model + up to 6 jewelry GLBs |
| Frame loop | `frameloop="demand"` (planned for Task 15) — only re-render on interaction or transition |

A simple FPS check during the camera animation can downgrade to a static-photo carousel if the device drops below ~24 fps. Tracked for Task 15.

## WebGL capability check

v1 has an **opt-in fallback**: `?view=grid` in the URL renders the 2D card grid (`<CatalogGridFallback>`). A toggle button in the corner of the 3D viewport links there.

An **automatic** WebGL2 capability check is tracked for Task 15:

```ts
const canvas = document.createElement('canvas');
const supportsWebGL2 = !!canvas.getContext('webgl2');
```

If unsupported:
- The showroom auto-renders the grid fallback with a banner: `3D не загрузилось — показываем простой каталог.`
- On `/catalog/[id]`, the photo gallery + attributes are already useful without 3D.
- On `/` Chapter 2 (Task 13), the 3D scene falls back to the chosen jewelries' photos + a `Перейти в каталог` CTA.

## Phase 2 — photo-upload lite mode

For phones that fail the WebGL check or perform poorly, Phase 2 will offer:
- User uploads a selfie.
- MediaPipe Face Landmarker maps the face.
- Jewelry photo (2D) is overlaid at the chosen anchor in the user's photo.

Lower fidelity, but works on virtually any device. Out of v1 scope; the schema (`Jewelry.photos`, `AnchorPoint.position` in 2D image space later) doesn't need changes.
