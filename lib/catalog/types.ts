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
  /**
   * Transparent-background PNG used as the 2D sprite in lite mode
   * (docs/15-lite-mode.md). When null, the piece is hidden from the
   * lite-mode try-on list but still appears in the "Все украшения"
   * grid view inside lite mode. Phase 1 showroom ignores this field.
   */
  spriteUrl: string | null;
  categoryName: string;
  /**
   * Detail-sheet attributes, carried on the wire so the in-catalog inspect
   * overlay can render specs/description without a second fetch. `material` is
   * required in the DB; the rest are optional. See lib/catalog/build-detail.ts.
   */
  description: string | null;
  material: string | null;
  gauge: number | null;
  size: number | null;
  color: string | null;
  stones: string | null;
  /**
   * Drives renderer math + UX. See docs/20-multi-anchor-jewelry.md.
   * STUD/RING are 1-anchor (pickable from `anchorBindings` as a compat
   * list); the others are multi-anchor with fixed bindings.
   */
  type: JewelryType;
  /**
   * Ordered list of (anchorId, order) pairs.
   *
   * - For STUD/RING (semantics="compat-list"): each entry is one anchor the
   *   user can equip the piece on. All entries have order=0.
   * - For BARBELL/CIRCULAR_BARBELL/ORBITAL/CHAIN_LADDER (semantics="fixed"):
   *   the entries are an ordered sequence of attach points (order=0 → mesh's
   *   `attach:primary` empty, order=1 → `attach:secondary`, …). Length equals
   *   the type's expected attach-point count, and ALL entries are equipped
   *   together when the user picks the piece.
   */
  anchorBindings: AnchorBinding[];
  /**
   * Convenience union of all anchorIds across bindings, deduplicated.
   * Useful for filter/eligibility checks ("does this jewelry occupy/work-with
   * the selected anchor?"). Server populates this from `anchorBindings`.
   */
  anchorIds: string[];
  /**
   * Number of pierced holes this jewelry occupies when equipped:
   *   STUD / RING                        → 1
   *   BARBELL / CIRCULAR_BARBELL /
   *   ORBITAL                            → 2
   *   CHAIN_LADDER                       → bindings.length
   * Surfaced on cards and in the booking flow.
   */
  piercingCount: number;
}

export type JewelryType =
  | "STUD"
  | "RING"
  | "BARBELL"
  | "CIRCULAR_BARBELL"
  | "ORBITAL"
  | "CHAIN_LADDER";

export interface AnchorBinding {
  anchorId: string;
  /** 0=primary, 1=secondary, … See JewelryWire.anchorBindings. */
  order: number;
}

/**
 * Returns true when this jewelry's bindings are a "compatibility list" —
 * each entry is an alternative anchor the user can equip onto. STUD and
 * RING are compat-list; everything else has fixed multi-anchor bindings.
 */
export function isSingleAnchorType(type: JewelryType): boolean {
  return type === "STUD" || type === "RING";
}

export function piercingCountForType(
  type: JewelryType,
  bindingsLength: number,
): number {
  if (isSingleAnchorType(type)) return 1;
  if (type === "CHAIN_LADDER") return bindingsLength;
  return 2; // BARBELL / CIRCULAR_BARBELL / ORBITAL
}

export type EquippedMap = Record<string, string>; // anchorId -> jewelryId

export const SOFT_CAP = 6;
