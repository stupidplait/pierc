import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { asPhotos, formatPrice } from "@/lib/jewelry/format";
import { getBookingPrefillUser } from "@/lib/public/queries";
import { buildSpecs } from "@/lib/catalog/build-detail";
import type { DetailPiece } from "@/components/catalog/detail/parts";
import { DetailShowcase } from "@/components/catalog/detail/DetailShowcase";

interface CatalogItemPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: CatalogItemPageProps): Promise<Metadata> {
  const { id } = await params;
  const j = await prisma.jewelry.findUnique({
    where: { id },
    select: { name: true, status: true },
  });
  if (!j || j.status !== "PUBLISHED") return { title: ru.studio.name };
  return { title: `${j.name} — ${ru.studio.name}` };
}

export default async function CatalogItemPage({
  params,
}: CatalogItemPageProps) {
  const { id } = await params;

  const j = await prisma.jewelry.findUnique({
    where: { id },
    include: {
      category: true,
      anchorBindings: {
        include: { anchor: true },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!j || j.status !== "PUBLISHED") notFound();

  const photos = asPhotos(j.photos);
  const out = j.inStock <= 0;
  const user = await getBookingPrefillUser();

  // Deep-link into the showroom: pick the first compatible anchor as the
  // primary "where to try this on" for the URL.
  const primaryAnchor = j.anchorBindings[0]?.anchor ?? null;
  const tryOnHref = primaryAnchor
    ? `/catalog?anchor=${encodeURIComponent(primaryAnchor.slug)}&eq=${encodeURIComponent(`${primaryAnchor.slug}:${j.id}`)}`
    : null;

  // Deduplicate anchor list for the "Где носить" chips.
  const anchorChips = (() => {
    const seen = new Map<string, { id: string; name: string }>();
    for (const b of j.anchorBindings) {
      if (!seen.has(b.anchor.id)) {
        seen.set(b.anchor.id, { id: b.anchor.id, name: b.anchor.name });
      }
    }
    return Array.from(seen.values());
  })();

  // Spec ledger — shared with the in-catalog inspect overlay.
  const specs = buildSpecs({
    material: j.material,
    gauge: j.gauge,
    size: j.size,
    color: j.color,
    stones: j.stones,
    inStock: j.inStock,
  });

  const piece: DetailPiece = {
    id: j.id,
    name: j.name,
    priceLabel: formatPrice(j.price.toString()),
    categoryName: j.category.name,
    description: j.description,
    photos: photos.map((p) => ({ url: p.url, alt: p.alt || j.name })),
    glbUrl: j.glbUrl,
    specs,
    anchorChips,
    primaryAnchorId: primaryAnchor?.id ?? null,
    tryOnHref,
    outOfStock: out,
  };

  return <DetailShowcase piece={piece} user={user} />;
}
