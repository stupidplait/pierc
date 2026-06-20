/**
 * Single source of truth for jewelry scale suggestion.
 *
 * `Jewelry.glbScale` maps GLB units → meters so the model renders at its real
 * physical size on the body model. Historically two different rules computed it:
 * the AI placement path (lib/admin/glb-normalize.ts) derived scale from the
 * measured decorative-head / post diameter, while the manual-upload + analyzer
 * path (lib/admin/jewelry-actions.ts) used the model's overall bounding box.
 * For the SAME piece those could disagree (e.g. a long-post stud: head-diameter
 * vs tip-to-tip length), so an auto-generated piece and a hand-uploaded one of
 * the same item got different scales.
 *
 * Everything now funnels through here, measuring the FINAL (oriented, compressed)
 * GLB's real-world bounding box via `measureGlbSizeM` and applying ONE formula:
 *   - prefer the real `size` (mm) against the model's largest dimension,
 *   - else fall back to `gauge` (wire/post thickness, mm) against the smallest.
 * Pure + dependency-free (no three / gltf-transform), safe to import anywhere
 * server-side.
 */

export interface ScaleSuggestion {
  /** Multiplier for the GLB so it lands at its real-world size. */
  scale: number;
  /** 0..1 — size-based match is high; gauge-only fallback is lower. */
  confidence: number;
  /** Human-readable Russian rationale for the admin UI. */
  reasoning: string;
}

/**
 * Suggest `glbScale` from a model's measured headline + thin-cross-section
 * dimensions (both in millimeters) and the piece's real-world gauge/size (mm).
 * Returns null when neither metadata field is usable.
 *
 * `sizeDimMm` = the model's largest real-world dimension (length / outer
 * diameter); `gaugeDimMm` = its smallest (post / wire thickness). scale is
 * unitless: applied to the meter-unit GLB it yields the real size, because
 * `realMm / modelMm == (realMm/1000 m) / (modelMm/1000 m)`.
 */
export function suggestScale(
  dims: { sizeDimMm: number; gaugeDimMm: number },
  gauge: number | null,
  size: number | null,
): ScaleSuggestion | null {
  if (size && dims.sizeDimMm > 0.01) {
    return {
      scale: size / dims.sizeDimMm,
      confidence: 0.85,
      reasoning: `Модель ${dims.sizeDimMm.toFixed(1)}мм в GLB, должна быть ${size}мм.`,
    };
  }
  if (gauge && dims.gaugeDimMm > 0.01) {
    return {
      scale: gauge / dims.gaugeDimMm,
      confidence: 0.6,
      reasoning: `Толщина модели ${dims.gaugeDimMm.toFixed(1)}мм в GLB, должна быть ${gauge}мм.`,
    };
  }
  return null;
}

/**
 * Convenience over `suggestScale` for callers that already have a measured
 * bounding box in meters (from `measureGlbSizeM`): largest axis = size
 * dimension, smallest = gauge dimension. This is the unified measurement every
 * ingestion path (auto-gen re-host, manual upload, scale analyzer) uses, so a
 * given piece gets ONE scale regardless of how its GLB arrived.
 */
export function suggestScaleFromSizeM(
  sizeM: { x: number; y: number; z: number },
  gauge: number | null,
  size: number | null,
): ScaleSuggestion | null {
  const maxMm = Math.max(sizeM.x, sizeM.y, sizeM.z) * 1000;
  const minMm = Math.min(sizeM.x, sizeM.y, sizeM.z) * 1000;
  return suggestScale({ sizeDimMm: maxMm, gaugeDimMm: minMm }, gauge, size);
}
