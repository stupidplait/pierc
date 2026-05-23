import Link from "next/link";
import Image from "next/image";
import { catalogStrings } from "@/lib/i18n/ru";
import { Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/ui/PageHeader";
import type { JewelryWire } from "@/lib/catalog/types";
import { formatPrice } from "@/lib/jewelry/format";

interface CatalogGridFallbackProps {
  jewelry: JewelryWire[];
  /** Surface a hint when this is shown because WebGL/JS failed (vs explicit ?view=grid). */
  reason?: "explicit" | "fallback";
  showroomHref?: string;
}

export function CatalogGridFallback({
  jewelry,
  reason = "explicit",
  showroomHref = "/catalog",
}: CatalogGridFallbackProps) {
  return (
    <Section>
      <PageHeader
        title={catalogStrings.attributes ? "Каталог" : "Каталог"}
        lead={catalogStrings.empty}
      >
        <Link
          href={showroomHref}
          className="inline-flex h-10 items-center rounded-full border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary"
        >
          {catalogStrings.showroom.showroomLink}
        </Link>
      </PageHeader>

      {reason === "fallback" ? (
        <p className="mb-6 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
          {catalogStrings.showroom.fallbackHint}
        </p>
      ) : null}

      {jewelry.length === 0 ? (
        <p className="text-mute">{catalogStrings.empty}</p>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {jewelry.map((j) => (
            <li key={j.id}>
              <Link
                href={`/catalog/${j.id}`}
                className="group block overflow-hidden rounded-2xl border border-line bg-page transition-colors hover:border-primary"
              >
                <div className="relative aspect-[4/5] bg-card">
                  {j.photo ? (
                    <Image
                      src={j.photo}
                      alt={j.name}
                      fill
                      sizes="(max-width: 640px) 100vw, 33vw"
                      className="object-cover"
                    />
                  ) : null}
                  {j.inStock <= 0 ? (
                    <span className="absolute right-3 top-3 rounded-full bg-page/80 px-2 py-1 text-xs text-mute backdrop-blur">
                      {catalogStrings.outOfStock}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-medium text-ink group-hover:text-primary">
                      {j.name}
                    </h3>
                    <p className="truncate text-xs text-mute">
                      {j.categoryName}
                    </p>
                  </div>
                  <p className="shrink-0 text-base font-medium text-primary">
                    {formatPrice(j.price)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
