import type { Metadata } from "next";
import { seoStrings } from "@/lib/i18n/ru";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { BalenciagaPortfolio } from "@/components/gallery/BalenciagaPortfolio";

export const metadata: Metadata = buildPageMetadata({
  title: seoStrings.gallery.title,
  description: seoStrings.gallery.description,
  path: "/gallery",
});

export default function GalleryPage() {
  return <BalenciagaPortfolio />;
}
