import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru, catalogStrings } from "@/lib/i18n/ru";
import { Section } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";
import { asPhotos, formatPrice } from "@/lib/jewelry/format";
import { getBookingPrefillUser } from "@/lib/public/queries";
import { JewelryDetailBookButton } from "@/components/booking/JewelryDetailBookButton";

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
  const attrs = catalogStrings.attributes;
  const out = j.inStock <= 0;

  const user = await getBookingPrefillUser();

  // Deep-link into the showroom: pick the first compatible anchor as the
  // primary "where to try this on" for the URL.
  const primaryAnchor = j.anchorBindings[0]?.anchor ?? null;
  const tryOnHref = primaryAnchor
    ? `/catalog?anchor=${encodeURIComponent(primaryAnchor.slug)}&eq=${encodeURIComponent(`${primaryAnchor.slug}:${j.id}`)}`
    : "/catalog";

  // Deduplicate anchor list for the "Где носить" chips. For STUD/RING this
  // reads as a compatibility list; for multi-anchor pieces (BARBELL etc.)
  // it lists the FIXED endpoints.
  const anchorChips = (() => {
    const seen = new Map<string, { id: string; name: string }>();
    for (const b of j.anchorBindings) {
      if (!seen.has(b.anchor.id)) {
        seen.set(b.anchor.id, { id: b.anchor.id, name: b.anchor.name });
      }
    }
    return Array.from(seen.values());
  })();

  return (
    <Section>
      <Link
        href="/catalog"
        className="mb-6 inline-block text-sm text-mute transition-colors hover:text-primary"
      >
        ← {ru.pages.catalog.title}
      </Link>

      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        {/* ── Photos ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          {photos.length === 0 ? (
            <div className="aspect-[4/5] rounded-2xl border border-line bg-card" />
          ) : (
            <>
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-line bg-card">
                <Image
                  src={photos[0].url}
                  alt={photos[0].alt || j.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 55vw"
                  className="object-cover"
                  priority
                />
              </div>
              {photos.length > 1 ? (
                <ul className="grid grid-cols-4 gap-2">
                  {photos.slice(1).map((p) => (
                    <li
                      key={p.url}
                      className="relative aspect-square overflow-hidden rounded-xl border border-line bg-card"
                    >
                      <Image
                        src={p.url}
                        alt={p.alt}
                        fill
                        sizes="20vw"
                        className="object-cover"
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>

        {/* ── Details ────────────────────────────────────────── */}
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">
            {j.category.name}
          </p>
          <h1 className="mt-3 font-display text-4xl font-medium text-ink sm:text-5xl">
            {j.name}
          </h1>
          <p className="mt-4 text-2xl font-medium text-ink">
            {formatPrice(j.price)}
          </p>

          {j.description ? (
            <p className="mt-5 max-w-prose whitespace-pre-line text-mute">
              {j.description}
            </p>
          ) : null}

          {/* CTA row */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {primaryAnchor ? (
              <Link
                href={tryOnHref}
                className="inline-flex h-12 items-center rounded-full bg-primary px-6 font-medium text-on-primary transition-colors hover:bg-primary-soft"
              >
                {catalogStrings.showroom.tryItOn}
              </Link>
            ) : null}
            {out ? (
              <button
                type="button"
                disabled
                title={catalogStrings.outOfStock}
                className="inline-flex h-12 items-center rounded-full border border-line px-6 font-medium text-ink opacity-50"
              >
                {catalogStrings.outOfStock}
              </button>
            ) : (
              <JewelryDetailBookButton
                item={{
                  id: j.id,
                  name: j.name,
                  price: j.price.toString(),
                  photo: photos[0]?.url ?? null,
                  inStock: j.inStock,
                }}
                user={user}
                label={catalogStrings.bookCta}
              />
            )}
          </div>

          {/* Attributes */}
          <Card className="mt-8">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Row label={attrs.material}>{j.material}</Row>
              {j.gauge != null ? (
                <Row label={attrs.gauge}>
                  {j.gauge} {catalogStrings.units.mm}
                </Row>
              ) : null}
              {j.size != null ? (
                <Row label={attrs.size}>
                  {j.size} {catalogStrings.units.mm}
                </Row>
              ) : null}
              {j.color ? <Row label={attrs.color}>{j.color}</Row> : null}
              {j.stones ? <Row label={attrs.stones}>{j.stones}</Row> : null}
              <Row label={attrs.inStock}>
                {out
                  ? catalogStrings.outOfStock
                  : `${j.inStock} ${catalogStrings.units.pcs}`}
              </Row>
            </dl>

            {anchorChips.length > 0 ? (
              <div className="mt-5 border-t border-line pt-5">
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-mute">
                  {attrs.anchors}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {anchorChips.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-full border border-line px-3 py-1 text-sm text-ink"
                    >
                      {a.name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </Section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4 sm:block">
      <dt className="text-mute">{label}</dt>
      <dd className="text-ink sm:mt-0.5">{children}</dd>
    </div>
  );
}
