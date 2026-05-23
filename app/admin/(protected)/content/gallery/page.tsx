import type { Metadata } from "next";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { GalleryUploadForm } from "@/components/admin/GalleryUploadForm";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { deleteGalleryPhoto } from "@/lib/admin/content-actions";

export const metadata: Metadata = {
  title: `${ru.admin.content.tabs.gallery} — ${ru.admin.panel}`,
};

export default async function AdminGalleryPage() {
  const photos = await prisma.galleryPhoto.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });
  const blobConfigured = !!process.env.BLOB_READ_WRITE_TOKEN;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-medium text-ink">
          {ru.admin.content.gallery.title}
        </h2>
        <p className="mt-1 text-sm text-mute">
          {ru.admin.content.gallery.lead}
        </p>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-medium text-ink">
          {ru.admin.content.gallery.uploadHeading}
        </h3>
        {!blobConfigured ? (
          <p className="mb-4 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
            {ru.admin.content.gallery.blobNotConfigured}
          </p>
        ) : null}
        <GalleryUploadForm />
      </div>

      {photos.length === 0 ? (
        <p className="text-mute">{ru.admin.content.gallery.empty}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-3 rounded-2xl border border-line p-3"
            >
              <div className="relative aspect-square overflow-hidden rounded-xl bg-card">
                <Image
                  src={p.url}
                  alt={p.caption ?? ""}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
              {p.caption ? (
                <p className="truncate text-sm text-ink">{p.caption}</p>
              ) : null}
              <form>
                <input type="hidden" name="id" value={p.id} />
                <ConfirmDeleteButton
                  formAction={deleteGalleryPhoto}
                  confirmText={ru.admin.content.gallery.confirmDelete}
                >
                  {ru.admin.content.gallery.delete}
                </ConfirmDeleteButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
