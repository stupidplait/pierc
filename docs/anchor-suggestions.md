# Suggested Additional Anchor Points

**Generated:** 2026-05-30  
**Purpose:** Anatomically-accurate anchor positions to expand piercing catalog coverage

---

## Current Coverage Summary

### ✅ Well-Covered Areas
- **Ear lobes**: 3 positions per side (excellent)
- **Helix**: Standard + forward + posterior (good coverage)
- **Basic cartilage**: Tragus, anti-tragus, conch, daith, rook, snug
- **Face**: Nose (nostrils, septum, bridge), lips (medusa, labret, monroe, madonna), eyebrow
- **Body**: Nipples, navel, hips, ankles, tongue

### ❌ Missing Common Piercings

---

## 1. EAR - Missing Positions

### 1.1 Orbital (Helix-to-Helix Ring)
**Description:** A ring that passes through two helix piercings  
**Popularity:** Very common for curated ear looks  
**Suggested anchors:**

```json
{
  "slug": "left-orbital-upper",
  "name": "Орбитал верхний (левый)",
  "place": "EAR",
  "side": "L",
  "position": {"x": 0.0835, "y": 1.5915, "z": -0.0300},
  "rotation": {"x": 0, "y": 0, "z": 0},
  "note": "Between forward helix and standard helix"
}

{
  "slug": "left-orbital-lower",
  "name": "Орбитал нижний (левый)",
  "place": "EAR",
  "side": "L",
  "position": {"x": 0.0840, "y": 1.5850, "z": -0.0340},
  "rotation": {"x": 0, "y": 0, "z": 0},
  "note": "Between standard helix and posterior helix"
}
```

**Right ear:** Mirror X coordinates (negate)

---

### 1.2 Flat (Upper Ear Cartilage)
**Description:** The flat area between helix and rook  
**Popularity:** Increasingly popular for studs  
**Suggested anchor:**

```json
{
  "slug": "left-flat",
  "name": "Флэт (левый)",
  "place": "EAR",
  "side": "L",
  "position": {"x": 0.0800, "y": 1.5880, "z": -0.0285},
  "rotation": {"x": 0, "y": 0, "z": 0},
  "note": "Flat cartilage area, popular for decorative studs"
}
```

**Right ear:** `{"x": -0.0800, "y": 1.5880, "z": -0.0285}`

---

### 1.3 Upper Lobe (Transition Zone)
**Description:** Between lobe-3 and helix, softer cartilage  
**Popularity:** Common for graduated lobe stacks  
**Suggested anchor:**

```json
{
  "slug": "left-ear-lobe-upper",
  "name": "Верхняя мочка (левый)",
  "place": "EAR",
  "side": "L",
  "position": {"x": 0.0815, "y": 1.5720, "z": -0.0250},
  "rotation": {"x": 0, "y": 0, "z": 0},
  "note": "Transition between lobe and cartilage"
}
```

**Right ear:** `{"x": -0.0815, "y": 1.5720, "z": -0.0250}`

---

### 1.4 Transverse Lobe
**Description:** Horizontal piercing through the lobe  
**Popularity:** Less common but distinctive  
**Suggested anchor (requires 2 points for barbell):**

```json
{
  "slug": "left-transverse-lobe-entry",
  "name": "Трансверс мочка вход (левый)",
  "place": "EAR",
  "side": "L",
  "position": {"x": 0.0680, "y": 1.5500, "z": -0.0140},
  "rotation": {"x": 0, "y": 0, "z": 1.57},
  "note": "Entry point for transverse lobe barbell"
}

{
  "slug": "left-transverse-lobe-exit",
  "name": "Трансверс мочка выход (левый)",
  "place": "EAR",
  "side": "L",
  "position": {"x": 0.0740, "y": 1.5500, "z": -0.0140},
  "rotation": {"x": 0, "y": 0, "z": 1.57},
  "note": "Exit point for transverse lobe barbell"
}
```

---

## 2. NOSE - Missing Positions

### 2.1 High Nostril
**Description:** Higher on the nostril curve  
**Popularity:** Trendy, often paired with standard nostril  
**Suggested anchors:**

```json
{
  "slug": "left-nostril-high",
  "name": "Высокая ноздря (левая)",
  "place": "NOSE",
  "side": "L",
  "position": {"x": 0.018, "y": 1.570, "z": 0.078},
  "rotation": {"x": 0, "y": 0, "z": 0},
  "note": "Higher on nostril curve, ~13mm above standard nostril"
}

{
  "slug": "right-nostril-high",
  "name": "Высокая ноздря (правая)",
  "place": "NOSE",
  "side": "R",
  "position": {"x": -0.018, "y": 1.570, "z": 0.078},
  "rotation": {"x": 0, "y": 0, "z": 0}
}
```

---

### 2.2 Nasallang (Horizontal Through Septum)
**Description:** Horizontal barbell through both nostrils and septum  
**Popularity:** Rare but dramatic  
**Suggested anchors (3 points):**

```json
{
  "slug": "nasallang-left",
  "name": "Насалланг левый",
  "place": "NOSE",
  "side": "L",
  "position": {"x": 0.011, "y": 1.557, "z": 0.080},
  "rotation": {"x": 0, "y": 0, "z": 1.57},
  "note": "Left entry point for nasallang barbell"
}

{
  "slug": "nasallang-center",
  "name": "Насалланг центр",
  "place": "NOSE",
  "side": "CENTER",
  "position": {"x": 0, "y": 1.557, "z": 0.082},
  "rotation": {"x": 0, "y": 0, "z": 1.57},
  "note": "Center point through septum"
}

{
  "slug": "nasallang-right",
  "name": "Насалланг правый",
  "place": "NOSE",
  "side": "R",
  "position": {"x": -0.011, "y": 1.557, "z": 0.080},
  "rotation": {"x": 0, "y": 0, "z": 1.57},
  "note": "Right exit point"
}
```

---

## 3. LIPS - Missing Positions

### 3.1 Snake Bites (Paired Lower Lip)
**Description:** Two symmetrical piercings on lower lip  
**Popularity:** Very popular, especially in alternative fashion  
**Suggested anchors:**

```json
{
  "slug": "snake-bite-left",
  "name": "Змеиный укус (левый)",
  "place": "LIPS",
  "side": "L",
  "position": {"x": 0.015, "y": 1.512, "z": 0.074},
  "rotation": {"x": 0, "y": 0, "z": 0},
  "note": "Left side of lower lip, ~15mm from center"
}

{
  "slug": "snake-bite-right",
  "name": "Змеиный укус (правый)",
  "place": "LIPS",
  "side": "R",
  "position": {"x": -0.015, "y": 1.512, "z": 0.074},
  "rotation": {"x": 0, "y": 0, "z": 0},
  "note": "Right side of lower lip"
}
```

---

### 3.2 Angel Bites (Paired Upper Lip)
**Description:** Two symmetrical piercings on upper lip (Monroe + Madonna)  
**Note:** Already have monroe-left and madonna-right, but could add explicit pairing

---

### 3.3 Dahlia Bites (Mouth Corners)
**Description:** At the corners of the mouth  
**Popularity:** Uncommon but distinctive  
**Suggested anchors:**

```json
{
  "slug": "dahlia-left",
  "name": "Далия (левый)",
  "place": "LIPS",
  "side": "L",
  "position": {"x": 0.028, "y": 1.524, "z": 0.076},
  "rotation": {"x": 0, "y": 0, "z": 0},
  "note": "Left corner of mouth"
}

{
  "slug": "dahlia-right",
  "name": "Далия (правый)",
  "place": "LIPS",
  "side": "R",
  "position": {"x": -0.028, "y": 1.524, "z": 0.076},
  "rotation": {"x": 0, "y": 0, "z": 0},
  "note": "Right corner of mouth"
}
```

---

## 4. EYEBROW - Missing Positions

### 4.1 Multiple Eyebrow Positions
**Description:** Inner, middle, outer positions for varied placement  
**Current:** Only have generic "left-eyebrow" and "right-eyebrow"  
**Suggested refinement:**

```json
{
  "slug": "left-eyebrow-inner",
  "name": "Левая бровь (внутренняя)",
  "place": "EYEBROW",
  "side": "L",
  "position": {"x": 0.020, "y": 1.598, "z": 0.072},
  "rotation": {"x": 0, "y": 0, "z": 0.3},
  "note": "Inner third of eyebrow"
}

{
  "slug": "left-eyebrow-middle",
  "name": "Левая бровь (средняя)",
  "place": "EYEBROW",
  "side": "L",
  "position": {"x": 0.030, "y": 1.598, "z": 0.071},
  "rotation": {"x": 0, "y": 0, "z": 0.3},
  "note": "Middle of eyebrow (current position)"
}

{
  "slug": "left-eyebrow-outer",
  "name": "Левая бровь (внешняя)",
  "place": "EYEBROW",
  "side": "L",
  "position": {"x": 0.040, "y": 1.596, "z": 0.068},
  "rotation": {"x": 0, "y": 0, "z": 0.3},
  "note": "Outer third of eyebrow"
}
```

**Right ear:** Mirror X coordinates

---

### 4.2 Anti-Eyebrow (Cheekbone)
**Description:** Below the eye on the cheekbone  
**Popularity:** Uncommon but distinctive  
**Suggested anchors:**

```json
{
  "slug": "left-anti-eyebrow",
  "name": "Анти-бровь (левая)",
  "place": "EYEBROW",
  "side": "L",
  "position": {"x": 0.042, "y": 1.580, "z": 0.065},
  "rotation": {"x": 0, "y": 0, "z": -0.3},
  "note": "Upper cheekbone, below outer eye"
}

{
  "slug": "right-anti-eyebrow",
  "name": "Анти-бровь (правая)",
  "place": "EYEBROW",
  "side": "R",
  "position": {"x": -0.042, "y": 1.580, "z": 0.065},
  "rotation": {"x": 0, "y": 0, "z": 0.3}
}
```

---

## 5. BODY - Missing Positions

### 5.1 Surface Piercings
**Description:** Collarbone, sternum, wrist, etc.  
**Note:** These are complex (surface bars, high rejection rate)  
**Recommendation:** Defer until core catalog is complete

---

### 5.2 Dermal Anchors
**Description:** Single-point anchors (chest, face, etc.)  
**Note:** Different jewelry type (dermal tops vs. threaded jewelry)  
**Recommendation:** Consider as separate jewelry category

---

## Implementation Priority

### High Priority (Common + High Demand)
1. ✅ **Flat (ear)** - Very trendy
2. ✅ **High nostril** - Popular pairing with standard nostril
3. ✅ **Snake bites (lips)** - Very common request
4. ✅ **Orbital positions (ear)** - Needed for ring jewelry

### Medium Priority (Expanding Options)
5. Upper lobe (ear)
6. Eyebrow refinement (inner/middle/outer)
7. Anti-eyebrow

### Low Priority (Rare/Complex)
8. Transverse lobe (requires multi-anchor support)
9. Nasallang (requires 3-point barbell)
10. Dahlia bites (uncommon)

---

## Coordinate Calculation Method

All suggested coordinates were calculated using:

1. **Anatomical references** from professional piercing guides
2. **Proportional spacing** from existing anchors
3. **Body.glb coordinate system** (Y-up, meters)
4. **Typical distances:**
   - Ear cartilage spacing: 5-8mm between adjacent piercings
   - Nostril to high nostril: ~13mm vertical
   - Snake bites spacing: ~30mm apart (15mm from center)
   - Eyebrow positions: ~10mm spacing

---

## Hair Interference Note

**Question:** Can hair disturb anchor positioning?

**Answer:**
- **During placement in Blender:** Yes - hair geometry can obscure the ear. Toggle hair visibility off while positioning anchors (like you did for `ear_anchors_NO_HAIR.png`)
- **In final coordinates:** No - anchors are stored as 3D positions independent of hair
- **In catalog renders:** Hair may visually cover piercings, which is realistic. Consider camera presets that show the ear clearly for ear jewelry

---

## Next Steps

1. **Review suggestions** - Which anchors align with your catalog strategy?
2. **Test in Blender** - Use `visualize_anchors_blender.py` to add suggested positions as colored spheres
3. **Adjust coordinates** - Fine-tune based on visual inspection
4. **Add to database** - Run migration to insert new anchor points
5. **Update jewelry bindings** - Link existing jewelry to new anchors where appropriate

---

## SQL Migration Template

```sql
-- Example: Add flat piercing (left)
INSERT INTO "AnchorPoint" (id, slug, name, place, side, position, rotation, "cameraPresets", "createdAt")
VALUES (
  gen_random_uuid(),
  'left-flat',
  'Флэт (левый)',
  'EAR',
  'L',
  '{"x": 0.0800, "y": 1.5880, "z": -0.0285}'::jsonb,
  '{"x": 0, "y": 0, "z": 0}'::jsonb,
  '[]'::jsonb,
  NOW()
);

-- Mirror for right side
INSERT INTO "AnchorPoint" (id, slug, name, place, side, position, rotation, "cameraPresets", "createdAt")
VALUES (
  gen_random_uuid(),
  'right-flat',
  'Флэт (правый)',
  'EAR',
  'R',
  '{"x": -0.0800, "y": 1.5880, "z": -0.0285}'::jsonb,
  '{"x": 0, "y": 0, "z": 0}'::jsonb,
  '[]'::jsonb,
  NOW()
);
```
