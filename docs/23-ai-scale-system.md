# AI-Powered Jewelry Scale & Attachment Point System

## Overview

This system automatically analyzes Tripo-generated 3D models and suggests optimal scale values based on the jewelry's physical dimensions (gauge/size fields).

> **Related:** scale + attach are the *placement* half of AI correction. The
> *quality* half — does the generated mesh actually look right — is the Gemini
> quality gate in `lib/admin/glb-quality-vision.ts` (renders the mesh from
> several angles and asks a vision model for an accept/reject verdict, with a
> confident reject auto-retrying the next provider). See
> [`docs/18-replicate-3d.md`](./18-replicate-3d.md) § "AI quality gate".

## How It Works

### 1. **Attachment Points**

The 3D rendering system expects GLB files to have **empty objects** (invisible markers) named:
- `attach:primary` — where the jewelry connects to the piercing (e.g., post tip)
- `attach:secondary` — for multi-anchor jewelry (barbells, industrials)
- etc.

**Problem with Tripo models**: They don't have these empties, and their origin might be at the center of mass instead of the piercing point.

**Solution**: The AI analyzer detects where the attachment point should be by:
1. Finding cylindrical parts matching the `gauge` (post thickness)
2. Locating the endpoint of that cylinder (the tip)
3. Falling back to bottom-center if no clear post is found

### 2. **Scale Calculation**

The system calculates scale using this formula:

```
scale = real_world_size_mm / glb_size_mm
```

For example:
- Tripo generates a nose stud that's 50mm in the GLB file
- The jewelry's `size` field says it should be 3mm
- Suggested scale = 3mm / 50mm = **0.06**

### 3. **Field Usage**

| Field | Purpose | Example |
|-------|---------|---------|
| `gauge` | Post/wire thickness in mm | 1.2mm (16g), 1.6mm (14g) |
| `size` | Decorative part diameter/length in mm | 3mm (stud gem), 8mm (ring diameter) |
| `glbScale` | Render-time multiplier | 0.025 (Tripo), 1.0 (parametric) |

### 4. **Confidence Levels**

The AI provides a confidence score:
- **80%+**: Clear post detected matching gauge
- **70%+**: Ring center detected
- **30%**: Fallback to bounding box (needs manual adjustment)

## Usage Guide

### For Tripo-Generated Models

1. **Fill in metadata first**:
   - Set `gauge` (post thickness) — e.g., 1.2mm for a labret stud
   - Set `size` (decorative part) — e.g., 3mm for the gem diameter

2. **Upload the GLB** from Tripo

3. **Click "Анализировать модель с ИИ"**:
   - The system analyzes geometry
   - Suggests optimal scale
   - Shows confidence level and reasoning

4. **Review the suggestion**:
   - Check the "Размеры модели в GLB" to see actual dimensions
   - If confidence is low, manually adjust

5. **Apply the scale**:
   - Click "Применить" to save
   - View in catalog to verify

### Manual Scale Adjustment

If AI suggestions aren't accurate:

1. **Start with common ranges**:
   - Tripo models: `0.01` to `0.05`
   - Parametric models: `1.0`

2. **Iterative adjustment**:
   - Too small? Increase scale (e.g., 0.025 → 0.035)
   - Too large? Decrease scale (e.g., 0.025 → 0.015)

3. **Visual reference**:
   - Compare to other jewelry in the catalog
   - Check against the body model proportions

## Technical Details

### Geometry Analysis Algorithm

```typescript
// 1. Find post vertices (within gauge tolerance)
const postVertices = vertices.filter(v => {
  const distFromAxis = distance(v, centerAxis);
  return distFromAxis <= (gauge * 0.6);
});

// 2. Find endpoint (lowest Y coordinate)
const endpoint = postVertices.reduce((min, v) => 
  v.y < min.y ? v : min
);

// 3. Calculate scale
const largestDim = max(glbSize.x, glbSize.y, glbSize.z);
const scale = size_mm / (largestDim * 1000);
```

### Attachment Point Detection

For **STUD** jewelry:
1. Identify the post (thin cylinder matching gauge)
2. Find the tip (endpoint that goes into piercing)
3. Offset the mesh so this tip lands exactly on the anchor point

For **RING** jewelry:
1. Detect circular geometry
2. Find the center of the ring
3. Position so the center aligns with the anchor

For **BARBELL** jewelry:
1. Find both endpoints (primary + secondary)
2. Calculate scale from distance between anchors
3. Align both endpoints to their respective anchors

## Troubleshooting

### "Model is invisible in catalog"

**Cause**: Scale is too small (e.g., 0.001) or too large (e.g., 10)

**Fix**:
1. Check current scale in admin
2. Try 0.025 as a starting point for Tripo models
3. Adjust incrementally

### "Model is offset from piercing"

**Cause**: Missing `attach:primary` empty, or wrong attachment point

**Fix**:
1. Check AI confidence score
2. If low (<50%), the model needs manual editing in Blender:
   - Add an empty object named `attach:primary`
   - Position it at the post tip
   - Re-export GLB

### "AI suggests wrong scale"

**Cause**: Missing or incorrect gauge/size fields

**Fix**:
1. Verify gauge and size are filled in
2. Ensure values are in millimeters
3. Re-run analysis after updating

## Future Enhancements

- [ ] Visual measurement overlay in GLB preview
- [ ] Automatic attachment point injection (add empties to GLB)
- [ ] Batch scale analysis for multiple jewelry items
- [ ] Learning from manual corrections to improve AI
- [ ] Integration with Blender export pipeline

## API Reference

### Server Actions

```typescript
// Analyze a jewelry model
const analysis = await analyzeJewelryScale(jewelryId);

// Apply scale
await applyJewelryScale(formData);
```

### Analysis Result

```typescript
interface ScaleAnalysisResult {
  ok: boolean;
  suggestedScale?: number;        // Recommended scale multiplier
  currentScale?: number;           // Current glbScale value
  boundingBox?: {                  // GLB dimensions in meters
    size: { x: number; y: number; z: number };
  };
  attachPoint?: Vec3 | null;       // Suggested attach:primary position
  confidence?: number;             // 0-1 confidence score
  reasoning?: string;              // Human-readable explanation
  error?: string;                  // Error message if ok=false
}
```

## Examples

### Example 1: Nose Stud

```
Input:
- gauge: 1.0mm (18g post)
- size: 2.5mm (gem diameter)
- GLB dimensions: 45mm × 45mm × 12mm

Analysis:
- Detected post: 0.8mm diameter (close to 1.0mm gauge)
- Largest dimension: 45mm
- Suggested scale: 2.5mm / 45mm = 0.0556
- Confidence: 85%
```

### Example 2: Hoop Ring

```
Input:
- gauge: 1.2mm (16g wire)
- size: 10mm (ring diameter)
- GLB dimensions: 52mm × 52mm × 8mm

Analysis:
- Detected ring center
- Ring diameter in GLB: 52mm
- Suggested scale: 10mm / 52mm = 0.0192
- Confidence: 75%
```

### Example 3: Barbell (Multi-Anchor)

```
Input:
- gauge: 1.6mm (14g bar)
- size: 16mm (bar length)
- GLB dimensions: 80mm × 8mm × 8mm

Analysis:
- Detected bar endpoints
- Bar length in GLB: 80mm
- Suggested scale: 16mm / 80mm = 0.2
- Confidence: 80%
```
