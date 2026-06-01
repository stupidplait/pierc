"use client";

import { useRouter } from "next/navigation";
import { GalleryUploadForm } from "@/components/admin/GalleryUploadForm";
import { GalleryGrid } from "./GalleryGrid";
import type { GalleryRow } from "@/lib/admin/content-view";

/** Upload form + grid for the gallery section. Both refresh the snapshot. */
export function GalleryPanel({
  photos,
  blobConfigured,
}: {
  photos: GalleryRow[];
  blobConfigured: boolean;
}) {
  const router = useRouter();
  return (
    <section className="flex flex-col gap-6">
      <GalleryUploadForm
        blobConfigured={blobConfigured}
        onUploaded={() => router.refresh()}
      />
      <GalleryGrid photos={photos} />
    </section>
  );
}
