import type { Metadata } from "next";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: `${ru.pages.gallery.title} — ${ru.studio.name}`,
};

export default async function GalleryPage() {
  const photos = await prisma.galleryPhoto.findMany({
    where: { published: true },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });

  return (
    <Section>
      <PageHeader title={ru.pages.gallery.title} lead={ru.pages.gallery.lead} />

      {photos.length === 0 ? (
        <p className="text-mute">{ru.pages.gallery.stub}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p) => (
            <li
              key={p.id}
              className="overflow-hidden rounded-2xl border border-line"
            >
              <div className="relative aspect-square bg-card">
                <Image
                  src={p.url}
                  alt={p.caption ?? ""}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover"
                />
              </div>
              {p.caption ? (
                <p className="border-t border-line bg-card/40 px-4 py-3 text-sm text-ink">
                  {p.caption}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
