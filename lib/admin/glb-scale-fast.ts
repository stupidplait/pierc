/**
 * Fast GLB scale calculator - server-side only, no Three.js loading.
 *
 * This is a lightweight alternative to the full glb-analyzer that:
 * 1. Fetches GLB metadata (file size, basic structure)
 * 2. Calculates scale based on gauge/size fields
 * 3. Returns suggestions without loading the entire 3D scene
 */

export interface FastScaleAnalysis {
  ok: boolean;
  suggestedScale: number | null;
  reasoning: string;
  confidence: number;
  error?: string;
}

interface AnalyzeOptions {
  gauge?: number | null;
  size?: number | null;
  type?: string;
}

/**
 * Calculate suggested scale based on jewelry metadata only.
 * No GLB parsing - just math based on typical Tripo output sizes.
 */
export async function calculateScaleFast(
  glbUrl: string,
  options: AnalyzeOptions
): Promise<FastScaleAnalysis> {
  const { gauge, size, type } = options;

  // If no metadata, provide generic Tripo suggestion
  if (!gauge && !size) {
    return {
      ok: true,
      suggestedScale: 0.025,
      reasoning:
        "Типичный масштаб для Tripo моделей. Укажите толщину (gauge) или размер (size) для точного расчёта.",
      confidence: 0.3,
    };
  }

  // Typical Tripo output sizes (empirical data)
  // Tripo tends to generate models in the 30-60mm range
  const TYPICAL_TRIPO_SIZE_MM = 45;

  let targetSize: number;
  let reasoning: string;
  let confidence: number;

  if (size) {
    // Use size (decorative part) for STUD/RING
    targetSize = size;
    reasoning = `Масштаб рассчитан по размеру украшения (${size}мм). Tripo обычно генерирует модели ~${TYPICAL_TRIPO_SIZE_MM}мм.`;
    confidence = 0.7;
  } else if (gauge) {
    // Use gauge (post thickness) as fallback
    // Assume decorative part is ~2-3x the gauge
    targetSize = gauge * 2.5;
    reasoning = `Масштаб рассчитан по толщине штифта (${gauge}мм). Предполагаемый размер украшения: ${targetSize.toFixed(1)}мм.`;
    confidence = 0.5;
  } else {
    return {
      ok: true,
      suggestedScale: 0.025,
      reasoning: "Стандартный масштаб для Tripo моделей.",
      confidence: 0.3,
    };
  }

  // Calculate scale
  const suggestedScale = targetSize / TYPICAL_TRIPO_SIZE_MM;

  // Sanity check - Tripo scales are typically 0.01-0.1
  if (suggestedScale < 0.005 || suggestedScale > 0.2) {
    return {
      ok: true,
      suggestedScale: 0.025,
      reasoning: `Расчётный масштаб (${suggestedScale.toFixed(4)}) выходит за типичные границы. Используется стандартное значение 0.025.`,
      confidence: 0.3,
    };
  }

  return {
    ok: true,
    suggestedScale,
    reasoning,
    confidence,
  };
}

/**
 * Enhanced version that fetches GLB and reads actual dimensions.
 * Only use this if the fast version isn't accurate enough.
 */
export async function calculateScaleFromGlb(
  glbUrl: string,
  options: AnalyzeOptions
): Promise<FastScaleAnalysis> {
  try {
    // Fetch GLB file
    const response = await fetch(glbUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch GLB: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();

    // Parse GLB header to get basic info
    // GLB format: 12-byte header + JSON chunk + BIN chunk
    const view = new DataView(buffer);

    // Check magic number (0x46546C67 = "glTF")
    const magic = view.getUint32(0, true);
    if (magic !== 0x46546C67) {
      throw new Error("Invalid GLB file");
    }

    // Read JSON chunk
    const jsonChunkLength = view.getUint32(12, true);
    const jsonChunkStart = 20;
    const jsonBytes = new Uint8Array(buffer, jsonChunkStart, jsonChunkLength);
    const jsonText = new TextDecoder().decode(jsonBytes);
    const gltf = JSON.parse(jsonText);

    // Try to find bounding box from accessors
    let maxDimension = 0;
    if (gltf.accessors && Array.isArray(gltf.accessors)) {
      for (const accessor of gltf.accessors) {
        if (accessor.max && accessor.min) {
          const size = {
            x: accessor.max[0] - accessor.min[0],
            y: accessor.max[1] - accessor.min[1],
            z: accessor.max[2] - accessor.min[2],
          };
          const dim = Math.max(size.x, size.y, size.z);
          if (dim > maxDimension) maxDimension = dim;
        }
      }
    }

    if (maxDimension === 0) {
      // Fallback to fast calculation
      return calculateScaleFast(glbUrl, options);
    }

    // Convert to mm
    const glbSizeMm = maxDimension * 1000;

    const { gauge, size } = options;
    let targetSize: number;
    let reasoning: string;

    if (size) {
      targetSize = size;
      reasoning = `Модель ${glbSizeMm.toFixed(1)}мм в GLB, должна быть ${size}мм.`;
    } else if (gauge) {
      targetSize = gauge * 2.5;
      reasoning = `Модель ${glbSizeMm.toFixed(1)}мм в GLB, расчётный размер ${targetSize.toFixed(1)}мм (по толщине ${gauge}мм).`;
    } else {
      return calculateScaleFast(glbUrl, options);
    }

    const suggestedScale = targetSize / glbSizeMm;

    return {
      ok: true,
      suggestedScale,
      reasoning,
      confidence: 0.8,
    };
  } catch (err) {
    // Fallback to fast calculation on error
    return calculateScaleFast(glbUrl, options);
  }
}
