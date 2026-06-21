// Shared catalog types — kept in a plain module (no component coupling) so the
// page, the board, the tabs and the toolbar can all reference them without
// importing each other. `JewelryStatus` mirrors the Prisma JewelryStatus enum.

export type JewelryStatus =
  | "DRAFT"
  | "PROCESSING"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "REJECTED";

// Pre-formatted, serializable shape the server page hands to the client board —
// price is formatted server-side so the board stays a pure presentation layer.
export interface JewelryRow {
  id: string;
  name: string;
  status: JewelryStatus;
  featured: boolean;
  photo: string | null;
  price: string;
  categoryName: string;
  material: string;
  anchorCount: number;
  inStock: number;
}
