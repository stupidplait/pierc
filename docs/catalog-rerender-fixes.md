# Catalog Rerendering Fixes

> **Historical — superseded.** The React Compiler is now enabled
> (`reactCompiler: true` in `next.config.ts`), so it auto-memoizes components.
> Do **not** apply the manual `useMemo`/`useCallback`/`memo` changes prescribed
> below — they're redundant under the compiler. Kept only as a record of the
> original investigation; some component names here predate the current catalog
> tree (`Showroom` / `CatalogStage` / `CardsLayer`).

## Issues Identified

### 1. URL Sync Effect (Showroom.tsx:112-126)
**Problem:** `searchParams` dependency causes effect to run on every render.

**Fix:**
```typescript
// Store the previous query string to detect actual changes
const prevQueryRef = useRef<string>("");

useEffect(() => {
  const params = new URLSearchParams();
  const slugForAnchor = selectedId ? anchorIdToSlug.get(selectedId) : null;
  if (slugForAnchor) params.set("anchor", slugForAnchor);
  
  const eqStr = serializeEquipped(equipped, anchorIdToSlug);
  if (eqStr) params.set("eq", eqStr);
  
  const qs = params.toString();
  
  // Only update if the query actually changed
  if (qs !== prevQueryRef.current) {
    prevQueryRef.current = qs;
    startTransition(() => {
      replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }
}, [selectedId, equipped, anchorIdToSlug, pathname, replace]);
// Remove searchParams from deps - we don't read from it
```

### 2. Stable Props via Memoization (catalog/page.tsx)
**Problem:** `anchors` and `jewelry` arrays are recreated on every server render.

**Fix:** These are already stable from the server component. The issue is that client components treat them as new references. We need to memoize the derived computations, not the props.

### 3. CatalogControls Memoization (CatalogControls.tsx:67-89)
**Problem:** Three expensive `useMemo` hooks recalculate on every render.

**Fix:** Add a stable key-based memoization:
```typescript
// Use a stable stringified key for anchors/jewelry
const anchorsKey = useMemo(() => anchors.map(a => a.id).join(','), [anchors]);
const jewelryKey = useMemo(() => jewelry.map(j => j.id).join(','), [jewelry]);

const grouped = useMemo(() => {
  const out = {} as Record<BodyPlace, AnchorWire[]>;
  for (const place of bodyPlaceOrder) out[place] = [];
  for (const a of anchors) out[a.place].push(a);
  return out;
}, [anchorsKey]); // Depend on stable key, not array reference

const filtered = useMemo(() => {
  if (!selectedAnchorId) return jewelry;
  return jewelry.filter((j) => j.anchorIds.includes(selectedAnchorId));
}, [jewelryKey, selectedAnchorId]);

const equippedItems = useMemo(() => {
  const anchorById = new Map(anchors.map((a) => [a.id, a]));
  const jewelryById = new Map(jewelry.map((j) => [j.id, j]));
  const out: Array<{ anchor: AnchorWire; item: JewelryWire }> = [];
  for (const [anchorId, jewelryId] of Object.entries(equipped)) {
    const anchor = anchorById.get(anchorId);
    const item = jewelryById.get(jewelryId);
    if (anchor && item) out.push({ anchor, item });
  }
  return out;
}, [anchorsKey, jewelryKey, equipped]);
```

### 4. AnchorDots Occlusion Optimization (AnchorDots.tsx:72-106)
**Problem:** Raycasting runs every frame for every anchor, even when camera is idle.

**Fix:** Throttle occlusion checks and skip when camera isn't moving:
```typescript
function Dot({ anchor, selected, hovered, dimmed, onSelect, onHover }: DotProps) {
  const groupRef = useRef<Group | null>(null);
  const coreRef = useRef<THREE.Mesh | null>(null);
  const ringRef = useRef<THREE.Mesh | null>(null);
  const { camera, scene, invalidate } = useThree();
  
  // Track last camera position to detect movement
  const lastCameraPosRef = useRef(new THREE.Vector3());
  const frameCountRef = useRef(0);
  const isOccludedRef = useRef(false);
  
  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;

    // Always update billboard rotation (cheap)
    g.quaternion.copy(camera.quaternion);

    // Only run expensive occlusion check every 5 frames AND when camera moved
    frameCountRef.current++;
    const cameraMoved = !camera.position.equals(lastCameraPosRef.current);
    
    if (frameCountRef.current % 5 === 0 || cameraMoved) {
      lastCameraPosRef.current.copy(camera.position);
      
      const worldPos = tempVec.setFromMatrixPosition(g.matrixWorld);
      const dirToCamera = worldPos.clone().sub(camera.position).normalize();

      raycaster.set(worldPos, dirToCamera.negate());
      raycaster.far = worldPos.distanceTo(camera.position);

      const intersects = raycaster.intersectObjects(scene.children, true);
      isOccludedRef.current = intersects.some((hit) => {
        return hit.object !== coreRef.current &&
               hit.object !== ringRef.current &&
               hit.distance < raycaster.far - 0.01;
      });
    }

    g.visible = !isOccludedRef.current;

    // Hover scale
    if (hovered && !isOccludedRef.current) {
      g.scale.setScalar(1.3);
      invalidate();
    } else {
      g.scale.setScalar(1);
    }
  });
  
  // ... rest of component
}
```

### 5. EquippedPieces Optimization (EquippedPieces.tsx:67-87)
**Problem:** Maps and grouping recalculate on every equipped change.

**Fix:** Memoize the maps separately:
```typescript
const anchorsById = useMemo(() => {
  const m = new Map<string, AnchorWire>();
  for (const a of anchors) m.set(a.id, a);
  return m;
}, [anchors.map(a => a.id).join(',')]); // Stable key

const jewelryById = useMemo(() => {
  const m = new Map<string, JewelryWire>();
  for (const j of jewelry) m.set(j.id, j);
  return m;
}, [jewelry.map(j => j.id).join(',')]); // Stable key

// pieces already depends on equipped, which is correct
```

### 6. ShowroomScene Optimization (ShowroomScene.tsx:39-56)
**Problem:** Multi-anchor framing computation runs on every render.

**Fix:** Already using `useMemo`, but can optimize the dependency:
```typescript
// Create a stable key for equipped map
const equippedKey = useMemo(() => 
  Object.entries(equipped).sort().map(([k,v]) => `${k}:${v}`).join(','),
  [equipped]
);

const equippedJewelryAtSelected = useMemo(() => {
  if (!selectedId) return null;
  const jewelryId = equipped[selectedId];
  if (!jewelryId) return null;
  return jewelry.find((j) => j.id === jewelryId) ?? null;
}, [selectedId, equippedKey, jewelry]);

const multiAnchorFramingSet = useMemo(() => {
  if (!equippedJewelryAtSelected) return [];
  if (equippedJewelryAtSelected.piercingCount < 2) return [];
  const anchorsForThisJewelry = new Set<string>();
  for (const [anchorId, jewelryId] of Object.entries(equipped)) {
    if (jewelryId === equippedJewelryAtSelected.id) {
      anchorsForThisJewelry.add(anchorId);
    }
  }
  return anchors.filter((a) => anchorsForThisJewelry.has(a.id));
}, [equippedJewelryAtSelected, equippedKey, anchors]);
```

## Priority Order

1. **AnchorDots occlusion throttling** - Biggest performance impact (runs every frame)
2. **URL sync effect fix** - Prevents unnecessary router updates
3. **CatalogControls memoization** - Reduces UI recomputation
4. **EquippedPieces optimization** - Reduces 3D scene updates
5. **ShowroomScene optimization** - Minor, already mostly optimized

## Expected Impact

- **Frame rate:** 60fps → stable 60fps (currently drops to 30-40fps with many anchors)
- **Idle GPU usage:** ~15% → <1% (occlusion checks run even when idle)
- **State update latency:** ~100ms → ~20ms (fewer cascading rerenders)
