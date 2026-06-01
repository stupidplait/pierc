"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Reveal } from "@/components/admin/form/atelier";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { CARD, GHOST_DELETE } from "@/components/admin/form/styles";
import { deleteGalleryPhoto } from "@/lib/admin/content-actions";
import type { GalleryRow } from "@/lib/admin/content-view";
import { ru } from "@/lib/i18n/ru";

/**
 * Gallery grid for the content manager — square-card layout, client-side so a
 * delete can `router.refresh()` the manager snapshot in place (the server
 * action only revalidates the live route).
 */
export function GalleryGrid({ photos }: { photos: GalleryRow[] }) {
  const router = useRouter();
  const t = ru.admin.content.gallery;

  if (photos.length === 0) {
    return <p className="text-sm text-mute">{t.empty}</p>;
  }

  async function handleDelete(formData: FormData) {
    await deleteGalleryPhoto(formData);
    router.refresh();
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {photos.map((p, i) => (
        <li key={p.id}>
          <Reveal
            delay={Math.min(i, 8) * 0.04}
            className={`${CARD} flex h-full flex-col gap-3 p-3`}
          >
            <div className="relative aspect-square overflow-hidden rounded-xl bg-bg">
              <Image
                src={p.url}
                alt={p.caption ?? ""}
                fill
                sizes="(max-width: 640px) 100vw, 33vw"
                className="object-cover"
              />
            </div>
            {p.caption ? (
              <p className="truncate px-1 text-sm text-ink">{p.caption}</p>
            ) : null}
            <form className="mt-auto">
              <input type="hidden" name="id" value={p.id} />
              <ConfirmDeleteButton
                formAction={handleDelete}
                confirmText={t.confirmDelete}
                className={`${GHOST_DELETE} w-full`}
              >
                {t.delete}
              </ConfirmDeleteButton>
            </form>
          </Reveal>
        </li>
      ))}
    </ul>
  );
}
