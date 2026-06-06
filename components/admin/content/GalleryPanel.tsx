"use client";

import type { GalleryRow } from "@/lib/admin/content-view";
import { GalleryBoard } from "./gallery/GalleryBoard";

/**
 * Gallery section of the content manager: one grid with a "+" add tile, inline
 * captioned "pending" cards that morph in on pick, and drag-reorderable live
 * photos that open a detail editor on click. See `gallery/GalleryBoard`.
 */
export function GalleryPanel({
  photos,
  blobConfigured,
}: {
  photos: GalleryRow[];
  blobConfigured: boolean;
}) {
  return <GalleryBoard photos={photos} blobConfigured={blobConfigured} />;
}
