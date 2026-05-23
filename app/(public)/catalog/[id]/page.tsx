import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ru, catalogStrings } from "@/lib/i18n/ru";
import { Section } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";
import { asPhotos, formatPrice } from "@/lib/jewelry/format";

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
    include: { category: true, anchors: true },
  });

  if (!j || j.status !== "PUBLISHED") notFound();

  const photos = asPhotos(j.photos);
  const attrs = catalogStrings.attributes;
  const out = j.inStock <= 0;

  // Deep-link into the showroom: pick the first compatible anchor as the
  // primary "where to try this on" for the URL.
  const primaryAnchor = j.anchors[0];
  const tryOnHref = primaryAnchor
    ? `/catalog?anchor=${encodeURIComponent(primaryAnchor.slug)}&eq=${encodeURIComponent(`${primaryAnchor.slug}:${j.id}`)}`
    : "/catalog";

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
              <Link
                href={`/book?items=${encodeURIComponent(j.id)}`}
                className="inline-flex h-12 items-center rounded-full border border-primary px-6 font-medium text-primary transition-colors hover:bg-primary hover:text-on-primary"
              >
                {catalogStrings.bookCta}
              </Link>
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

            {j.anchors.length > 0 ? (
              <div className="mt-5 border-t border-line pt-5">
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-mute">
                  {attrs.anchors}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {j.anchors.map((a) => (
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
