import Link from "next/link";
import Image from "next/image";
import { catalogStrings } from "@/lib/i18n/ru";
import { Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/ui/PageHeader";
import type { JewelryWire } from "@/lib/catalog/types";
import { formatPrice } from "@/lib/jewelry/format";
import { Card } from "@/components/shadcn/ui/card";
import { Badge } from "@/components/shadcn/ui/badge";
import { Button } from "@/components/shadcn/ui/button";

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
        title="Каталог"
        lead={catalogStrings.empty}
      >
        <Button asChild variant="outline">
          <Link href={showroomHref}>
            {catalogStrings.showroom.showroomLink}
          </Link>
        </Button>
      </PageHeader>

      {reason === "fallback" ? (
        <div className="mb-6 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
          {catalogStrings.showroom.fallbackHint}
        </div>
      ) : null}

      {jewelry.length === 0 ? (
        <p className="text-mute">{catalogStrings.empty}</p>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {jewelry.map((j) => (
            <li key={j.id}>
              <Link href={`/catalog/${j.id}`}>
                <Card className="group overflow-hidden p-0 transition-colors hover:border-ink/35">
                  <div className="relative aspect-[4/5] overflow-hidden bg-card">
                    {j.photo ? (
                      <Image
                        src={j.photo}
                        alt={j.name}
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : null}
                    {j.inStock <= 0 ? (
                      <Badge
                        variant="outline"
                        className="absolute right-3 top-3 bg-page/80 backdrop-blur"
                      >
                        {catalogStrings.outOfStock}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-medium text-ink transition-colors group-hover:text-accent">
                        {j.name}
                      </h3>
                      <p className="truncate text-xs text-mute">
                        {j.categoryName}
                      </p>
                    </div>
                    <p className="shrink-0 text-base font-medium text-accent">
                      {formatPrice(j.price)}
                    </p>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
