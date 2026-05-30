import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru, catalogStrings } from "@/lib/i18n/ru";
import { Section } from "@/components/ui/Section";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/ui/card";
import { Badge } from "@/components/shadcn/ui/badge";
import { Button } from "@/components/shadcn/ui/button";
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
      <Button asChild variant="ghost" size="sm" className="mb-6 gap-2">
        <Link href="/catalog">
          <ArrowLeft className="size-4" />
          {ru.pages.catalog.title}
        </Link>
      </Button>

      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        {/* ── Photos ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          {photos.length === 0 ? (
            <div className="aspect-4/5 rounded-2xl border border-line bg-card" />
          ) : (
            <>
              <Card className="aspect-4/5 overflow-hidden p-0">
                <Image
                  src={photos[0].url}
                  alt={photos[0].alt || j.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 55vw"
                  className="object-cover"
                  priority
                />
              </Card>
              {photos.length > 1 ? (
                <ul className="grid grid-cols-4 gap-2">
                  {photos.slice(1).map((p) => (
                    <li key={p.url}>
                      <Card className="relative aspect-square overflow-hidden p-0">
                        <Image
                          src={p.url}
                          alt={p.alt}
                          fill
                          sizes="20vw"
                          className="object-cover"
                        />
                      </Card>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>

        {/* ── Details ────────────────────────────────────────── */}
        <div>
          <Badge variant="accent" className="mb-3">
            {j.category.name}
          </Badge>
          <h1 className="font-display text-4xl font-medium text-ink sm:text-5xl">
            {j.name}
          </h1>
          <p className="mt-4 text-2xl font-medium text-accent">
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
              <Button asChild className="bg-accent text-on-primary hover:bg-accent/90">
                <Link href={tryOnHref}>
                  {catalogStrings.showroom.tryItOn}
                </Link>
              </Button>
            ) : null}
            {out ? (
              <Button
                disabled
                variant="outline"
                title={catalogStrings.outOfStock}
              >
                {catalogStrings.outOfStock}
              </Button>
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
            <CardHeader>
              <CardTitle className="text-base">
                {catalogStrings.attributes.material}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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
            </CardContent>

            {anchorChips.length > 0 ? (
              <>
                <div className="h-px bg-line" />
                <CardContent className="space-y-2 pt-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-mute">
                    {attrs.anchors}
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {anchorChips.map((a) => (
                      <li key={a.id}>
                        <Badge
                          variant={
                            a.id === primaryAnchor?.id ? "accent" : "secondary"
                          }
                        >
                          {a.name}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </>
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
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-mute">{label}</span>
      <span className="text-ink">{children}</span>
    </div>
  );
}
