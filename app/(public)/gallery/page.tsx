import type { Metadata } from "next";
import { seoStrings } from "@/lib/i18n/ru";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { buildGalleryJsonLd } from "@/lib/seo/local-business";
import { getGalleryPhotos } from "@/lib/public/queries";
import { JsonLd } from "@/components/seo/JsonLd";
import { GalleryCoverflow } from "@/components/gallery/GalleryCoverflow";

export async function generateMetadata(): Promise<Metadata> {
  // OG / Twitter image = the cover (first published) photo, so a shared
  // /gallery link previews real work rather than the generic home image.
  // getGalleryPhotos is tag-cached, so this read is shared with the page body
  // (no extra Neon query). Falls back to the default OG image when empty.
  const photos = await getGalleryPhotos();
  const cover = photos[0];
  return buildPageMetadata({
    title: seoStrings.gallery.title,
    description: seoStrings.gallery.description,
    path: "/gallery",
    image: cover?.url ?? null,
    imageAlt: cover?.caption ?? undefined,
  });
}

export default async function GalleryPage() {
  const photos = await getGalleryPhotos();
  return (
    <>
      {/* ImageGallery JSON-LD (null when empty) — consistent with the schema
          the other public pages emit via the shared <JsonLd>. */}
      <JsonLd data={buildGalleryJsonLd(photos)} />
      <GalleryCoverflow photos={photos} />
    </>
  );
}
