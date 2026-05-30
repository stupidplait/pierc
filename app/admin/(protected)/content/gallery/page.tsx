import type { Metadata } from "next";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { GalleryUploadForm } from "@/components/admin/GalleryUploadForm";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { Reveal } from "@/components/admin/form/atelier";
import { CARD, GHOST_DELETE } from "@/components/admin/form/styles";
import { deleteGalleryPhoto } from "@/lib/admin/content-actions";

export const metadata: Metadata = {
  title: ru.admin.content.tabs.gallery,
};

// Admin page — auth-walled and reads GalleryPhoto rows on every request.
export const dynamic = "force-dynamic";

export default async function AdminGalleryPage() {
  const photos = await prisma.galleryPhoto.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });
  const blobConfigured = !!process.env.BLOB_READ_WRITE_TOKEN;

  const t = ru.admin.content.gallery;

  return (
    <section className="flex flex-col gap-6">
      <GalleryUploadForm blobConfigured={blobConfigured} />

      {photos.length === 0 ? (
        <p className="text-sm text-mute">{t.empty}</p>
      ) : (
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
                    formAction={deleteGalleryPhoto}
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
      )}
    </section>
  );
}
