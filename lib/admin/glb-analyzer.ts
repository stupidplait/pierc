/**
 * GLB geometry analyzer for AI-assisted jewelry placement.
 *
 * Analyzes a GLB file to:
 * 1. Calculate bounding box dimensions
 * 2. Detect potential attachment points (post/stem endpoints)
 * 3. Suggest scale based on gauge/size fields
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface GlbAnalysis {
  /** Bounding box in GLB local space (meters) */
  boundingBox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
    size: { x: number; y: number; z: number };
  };

  /** Suggested attachment point in GLB local space */
  suggestedAttachPoint: { x: number; y: number; z: number } | null;

  /** Confidence score 0-1 for the suggested attach point */
  attachPointConfidence: number;

  /** Suggested scale multiplier based on gauge/size */
  suggestedScale: number | null;

  /** Reasoning for the suggestions (for UI display) */
  reasoning: string;
}

interface AnalyzeOptions {
  /** Expected gauge (post thickness) in mm */
  gauge?: number;
  /** Expected size (decorative part) in mm */
  size?: number;
  /** Jewelry type for context */
  type?: 'STUD' | 'RING' | 'BARBELL' | 'CIRCULAR_BARBELL' | 'ORBITAL' | 'CHAIN_LADDER';
}

/**
 * Analyze a GLB file from a URL or buffer.
 * Runs in Node.js (server-side) or browser (client-side preview).
 */
export async function analyzeGlb(
  urlOrBuffer: string | ArrayBuffer,
  options: AnalyzeOptions = {}
): Promise<GlbAnalysis> {
  const loader = new GLTFLoader();

  // Load the GLB
  const gltf = await new Promise<THREE.Group>((resolve, reject) => {
    if (typeof urlOrBuffer === 'string') {
      loader.load(
        urlOrBuffer,
        (gltf) => resolve(gltf.scene),
        undefined,
        reject
      );
    } else {
      loader.parse(
        urlOrBuffer,
        '',
        (gltf) => resolve(gltf.scene),
        reject
      );
    }
  });

  // Calculate bounding box
  const bbox = new THREE.Box3().setFromObject(gltf);
  const size = new THREE.Vector3();
  bbox.getSize(size);

  const boundingBox = {
    min: { x: bbox.min.x, y: bbox.min.y, z: bbox.min.z },
    max: { x: bbox.max.x, y: bbox.max.y, z: bbox.max.z },
    size: { x: size.x, y: size.y, z: size.z },
  };

  // Check if attach:primary already exists. three's GLTFLoader strips ':' from
  // node names (sanitizeNodeName) → "attachprimary"; the original survives in
  // userData.name. Accept either form.
  let existingAttach: THREE.Vector3 | null = null;
  gltf.traverse((obj) => {
    const raw = (obj.userData?.name as string | undefined) ?? obj.name;
    if (raw === 'attach:primary' || raw === 'attachprimary') {
      existingAttach = obj.position.clone();
    }
  });

  if (existingAttach) {
    const attach = existingAttach as THREE.Vector3;
    return {
      boundingBox,
      suggestedAttachPoint: {
        x: attach.x,
        y: attach.y,
        z: attach.z,
      },
      attachPointConfidence: 1.0,
      suggestedScale: calculateScale(size, options),
      reasoning: 'Модель уже содержит attach:primary empty.',
    };
  }

  // AI-assisted attachment point detection
  const detection = detectAttachmentPoint(gltf, boundingBox, options);

  return {
    boundingBox,
    suggestedAttachPoint: detection.point,
    attachPointConfidence: detection.confidence,
    suggestedScale: calculateScale(size, options),
    reasoning: detection.reasoning,
  };
}

/**
 * Calculate suggested scale based on expected dimensions.
 */
function calculateScale(
  glbSize: THREE.Vector3,
  options: AnalyzeOptions
): number | null {
  const { gauge, size, type } = options;

  // Convert mm to meters for comparison
  const gaugeM = gauge ? gauge / 1000 : null;
  const sizeM = size ? size / 1000 : null;

  // For STUD/RING: use the decorative part size (largest dimension)
  if (type === 'STUD' || type === 'RING' || !type) {
    if (sizeM) {
      const largestDim = Math.max(glbSize.x, glbSize.y, glbSize.z);
      if (largestDim > 0.001) {
        return sizeM / largestDim;
      }
    }
  }

  // For BARBELL: use the length (typically Y or Z axis)
  if (type === 'BARBELL' || type === 'CIRCULAR_BARBELL') {
    if (sizeM) {
      const length = Math.max(glbSize.y, glbSize.z);
      if (length > 0.001) {
        return sizeM / length;
      }
    }
  }

  // Fallback: if gauge is provided, find the thinnest dimension
  // and assume it's the post
  if (gaugeM) {
    const minDim = Math.min(glbSize.x, glbSize.y, glbSize.z);
    if (minDim > 0.0001) {
      return gaugeM / minDim;
    }
  }

  return null;
}

/**
 * Detect where the attachment point should be using geometry analysis.
 *
 * Strategy:
 * 1. Find cylindrical parts matching the gauge (post/stem)
 * 2. Find the endpoint of that cylinder (the tip that goes into the piercing)
 * 3. If no clear post, use the bottom-center of the bounding box
 */
function detectAttachmentPoint(
  scene: THREE.Group,
  boundingBox: GlbAnalysis['boundingBox'],
  options: AnalyzeOptions
): { point: { x: number; y: number; z: number } | null; confidence: number; reasoning: string } {
  const { gauge, type } = options;

  // Collect all mesh vertices
  const vertices: THREE.Vector3[] = [];
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const geometry = obj.geometry;
      const posAttr = geometry.attributes.position;
      if (posAttr) {
        for (let i = 0; i < posAttr.count; i++) {
          const v = new THREE.Vector3(
            posAttr.getX(i),
            posAttr.getY(i),
            posAttr.getZ(i)
          );
          obj.localToWorld(v);
          vertices.push(v);
        }
      }
    }
  });

  if (vertices.length === 0) {
    return {
      point: null,
      confidence: 0,
      reasoning: 'Не удалось извлечь геометрию из модели.',
    };
  }

  // Strategy 1: Find the "post" (thin cylindrical part)
  if (gauge && (type === 'STUD' || !type)) {
    const gaugeM = gauge / 1000;
    const postVertices = findPostVertices(vertices, gaugeM, boundingBox);

    if (postVertices.length > 10) {
      // Find the endpoint (lowest Y or Z, depending on orientation)
      const endpoint = findEndpoint(postVertices);
      return {
        point: { x: endpoint.x, y: endpoint.y, z: endpoint.z },
        confidence: 0.8,
        reasoning: `Обнаружен штифт толщиной ~${gauge}мм. Точка крепления — конец штифта.`,
      };
    }
  }

  // Strategy 2: For rings, find the center of the smallest circular cross-section
  if (type === 'RING') {
    const center = findRingCenter(vertices, boundingBox);
    if (center) {
      return {
        point: { x: center.x, y: center.y, z: center.z },
        confidence: 0.7,
        reasoning: 'Обнаружено кольцо. Точка крепления — центр кольца.',
      };
    }
  }

  // Fallback: Use bottom-center of bounding box
  const fallback = {
    x: (boundingBox.min.x + boundingBox.max.x) / 2,
    y: boundingBox.min.y, // Bottom
    z: (boundingBox.min.z + boundingBox.max.z) / 2,
  };

  return {
    point: fallback,
    confidence: 0.3,
    reasoning: 'Не удалось определить точку крепления автоматически. Используется центр нижней грани.',
  };
}

/**
 * Find vertices that are part of a cylindrical post.
 */
function findPostVertices(
  vertices: THREE.Vector3[],
  gaugeM: number,
  boundingBox: GlbAnalysis['boundingBox']
): THREE.Vector3[] {
  // Find the axis of the post (likely Y or Z)
  const size = boundingBox.size;
  const isYAxis = size.y > Math.max(size.x, size.z) * 1.5;
  const isZAxis = size.z > Math.max(size.x, size.y) * 1.5;

  const center = {
    x: (boundingBox.min.x + boundingBox.max.x) / 2,
    y: (boundingBox.min.y + boundingBox.max.y) / 2,
    z: (boundingBox.min.z + boundingBox.max.z) / 2,
  };

  const tolerance = gaugeM * 0.6; // 60% of gauge as tolerance

  return vertices.filter((v) => {
    if (isYAxis) {
      const distFromAxis = Math.sqrt(
        Math.pow(v.x - center.x, 2) + Math.pow(v.z - center.z, 2)
      );
      return distFromAxis <= tolerance;
    } else if (isZAxis) {
      const distFromAxis = Math.sqrt(
        Math.pow(v.x - center.x, 2) + Math.pow(v.y - center.y, 2)
      );
      return distFromAxis <= tolerance;
    } else {
      // X axis or unclear
      const distFromAxis = Math.sqrt(
        Math.pow(v.y - center.y, 2) + Math.pow(v.z - center.z, 2)
      );
      return distFromAxis <= tolerance;
    }
  });
}

/**
 * Find the endpoint of a post (the tip that goes into the piercing).
 */
function findEndpoint(postVertices: THREE.Vector3[]): THREE.Vector3 {
  // Find the vertex with the minimum Y (bottom)
  let minY = Infinity;
  let endpoint = postVertices[0];

  for (const v of postVertices) {
    if (v.y < minY) {
      minY = v.y;
      endpoint = v;
    }
  }

  return endpoint;
}

/**
 * Find the center of a ring by detecting the circular hole.
 */
function findRingCenter(
  vertices: THREE.Vector3[],
  boundingBox: GlbAnalysis['boundingBox']
): THREE.Vector3 | null {
  // Simple heuristic: center of bounding box
  // TODO: More sophisticated ring detection using circular Hough transform
  return new THREE.Vector3(
    (boundingBox.min.x + boundingBox.max.x) / 2,
    (boundingBox.min.y + boundingBox.max.y) / 2,
    (boundingBox.min.z + boundingBox.max.z) / 2
  );
}
