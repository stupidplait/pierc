// Shared types for the showroom catalog. Everything that crosses the
// server -> client boundary is plain JSON (Decimals stringified, etc.).

export type BodyPlace =
  | "EAR"
  | "NOSE"
  | "LIPS"
  | "EYEBROW"
  | "TONGUE"
  | "NIPPLE"
  | "NAVEL"
  | "HIP"
  | "ANKLE";

export type AnchorSide = "L" | "R" | "CENTER";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CameraPreset {
  name: string;
  position: Vec3;
  target: Vec3;
  fov: number;
}

export interface AnchorWire {
  id: string;
  slug: string;
  name: string;
  place: BodyPlace;
  side: AnchorSide;
  position: Vec3;
  rotation: Vec3;
  cameraPresets: CameraPreset[];
}

export interface JewelryWire {
  id: string;
  name: string;
  /** Decimal stringified — re-parsed via formatPrice. */
  price: string;
  inStock: number;
  photo: string | null;
  /** When present, the showroom renders this GLB instead of the placeholder. */
  glbUrl: string | null;
  /**
   * Per-piece scale multiplier applied at render time. The parametric
   * Blender pipeline exports `.glb` files in real-world meters, so this
   * is `1.0` for those pieces. Tripo3D-generated models historically
   * needed `0.025` to land at sensible visual size; record that value
   * on `Jewelry.glbScale` if a Tripo upload is added back.
   */
  glbScale: number;
  categoryName: string;
  /** Anchors this jewelry can be fitted to. */
  anchorIds: string[];
}

export type EquippedMap = Record<string, string>; // anchorId -> jewelryId

export const SOFT_CAP = 6;
