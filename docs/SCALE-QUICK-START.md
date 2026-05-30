# Quick Start: Fixing Tripo Model Scale

## The Problem

Your Tripo-generated model is invisible in the catalog because:
1. Tripo generates models at arbitrary scales (could be huge or tiny)
2. The default `glbScale` is 1.0, but Tripo models typically need 0.01-0.05
3. There was no UI to adjust this value

## The Solution (Now Implemented)

### 1. **AI-Powered Scale Suggestions**

The system now analyzes your GLB and suggests the correct scale based on:
- **gauge** field (post thickness in mm)
- **size** field (decorative part size in mm)
- Geometry analysis (finds the post, measures dimensions)

### 2. **Manual Scale Control**

You can also manually adjust the scale with a slider/input field.

## How to Use

### Step 1: Fill in Jewelry Metadata

In the jewelry edit form, make sure you have:
- **Толщина (gauge)**: Post thickness in mm (e.g., 1.2mm for 16g)
- **Размер (size)**: Decorative part size in mm (e.g., 3mm for a small stud)

### Step 2: Upload Your Tripo Model

Upload the GLB file as usual.

### Step 3: Run AI Analysis

In the new "Масштаб модели" card:
1. Click **"Анализировать модель с ИИ"**
2. Wait a few seconds for analysis
3. Review the suggestion and confidence score

### Step 4: Apply the Scale

- If confidence is high (>70%): Click **"Применить"** to use the suggested scale
- If confidence is low: Manually adjust the value and apply

### Step 5: Verify in Catalog

Go to the catalog and check if the jewelry appears correctly on the model.

## Quick Fix for Your Current Model

If you want to fix your current invisible model right now:

```sql
-- Replace 'your-jewelry-id' with the actual ID
UPDATE "Jewelry" 
SET "glbScale" = 0.025 
WHERE id = 'your-jewelry-id';
```

Then refresh the catalog page. If it's still too small/large, try:
- Too small? Try 0.035 or 0.05
- Too large? Try 0.015 or 0.01

## Common Scale Values

| Model Source | Typical Scale |
|--------------|---------------|
| Tripo3D | 0.01 - 0.05 |
| Parametric (Blender) | 1.0 |
| Manual modeling | Varies |

## Understanding Attachment Points

The system also detects where the jewelry should attach to the piercing:

- **attach:primary** = where the post tip goes into the hole
- For Tripo models without these markers, the AI tries to find the post tip automatically
- Confidence score tells you how sure the AI is

## What Each Field Means

### gauge (Толщина)
The thickness of the post/wire that goes through the piercing.

Common values:
- 0.8mm = 20 gauge
- 1.0mm = 18 gauge  
- 1.2mm = 16 gauge
- 1.6mm = 14 gauge

### size (Размер)
The visible decorative part.

Examples:
- Nose stud gem: 2-3mm
- Labret disc: 3-5mm
- Ring diameter: 8-12mm
- Barbell length: 10-16mm

## Troubleshooting

### "AI confidence is low (30%)"

**Reason**: The model doesn't have a clear post, or gauge/size fields are missing.

**Fix**:
1. Make sure gauge and size are filled in
2. Try manual adjustment starting at 0.025
3. If still wrong, the model might need editing in Blender

### "Model appears but is offset from the piercing"

**Reason**: The attachment point detection failed.

**Fix**: The model needs an `attach:primary` empty added in Blender. See docs/23-ai-scale-system.md for details.

### "Scale keeps resetting"

**Reason**: You're editing the wrong jewelry item, or the form isn't saving.

**Fix**: Check that you're on the correct jewelry edit page and that the success message appears after clicking "Применить".

## Next Steps

1. **Test the current implementation**: Edit your Tripo jewelry and run the AI analysis
2. **Provide feedback**: Let me know if the suggested scales are accurate
3. **Iterate**: We can tune the algorithm based on real-world results

## Files Changed

- `lib/admin/glb-analyzer.ts` - AI geometry analysis
- `lib/admin/jewelry-actions.ts` - Server actions for scale management
- `components/admin/JewelryScaleAdjuster.tsx` - UI component
- `app/admin/(protected)/jewelry/[id]/edit/page.tsx` - Integration
- `docs/23-ai-scale-system.md` - Full technical documentation
