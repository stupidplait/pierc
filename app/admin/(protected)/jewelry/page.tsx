import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ru, jewelryStatusLabels } from "@/lib/i18n/ru";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StockAdjuster } from "@/components/admin/StockAdjuster";
import { firstPhotoUrl, formatPrice } from "@/lib/jewelry/format";

export const metadata: Metadata = {
  title: `${ru.admin.nav.jewelry} вЂ” ${ru.admin.panel}`,
};

interface AdminJewelryPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    status?: string;
    featured?: string;
    lowStock?: string;
  }>;
}

export default async function AdminJewelryPage({
  searchParams,
}: AdminJewelryPageProps) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const categoryId = sp.category || "";
  const status = sp.status || "";
  const featured = sp.featured === "1";
  const lowStock = sp.lowStock === "1";

  const where: Prisma.JewelryWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { material: { contains: q, mode: "insensitive" } },
    ];
  }
  if (categoryId) where.categoryId = categoryId;
  if (status) where.status = status as Prisma.JewelryWhereInput["status"];
  if (featured) where.featured = true;
  if (lowStock) where.inStock = { lte: 1 };

  const [jewelries, categories] = await Promise.all([
    prisma.jewelry.findMany({
      where,
      include: { category: true, anchors: { select: { id: true } } },
      orderBy: [{ updatedAt: "desc" }],
    }),
    prisma.jewelryCategory.findMany({ orderBy: { order: "asc" } }),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        eyebrow={ru.admin.panel}
        title={ru.admin.jewelry.title}
        lead={ru.admin.jewelry.lead}
      >
        <Button href="/admin/jewelry/new">{ru.admin.jewelry.addNew}</Button>
      </PageHeader>

      <form
        method="get"
        className="mb-6 grid gap-3 rounded-2xl border border-line bg-card/40 p-4 sm:grid-cols-4"
      >
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs uppercase tracking-[0.15em] text-mute">
            {ru.admin.jewelry.searchLabel}
          </span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={ru.admin.jewelry.searchPlaceholder}
            className="h-10 rounded-lg border border-line bg-page px-3 text-sm text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.15em] text-mute">
            {ru.admin.jewelry.categoryLabel}
          </span>
          <select
            name="category"
            defaultValue={categoryId}
            className="h-10 rounded-lg border border-line bg-page px-3 text-sm text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <option value="">вЂ“</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.15em] text-mute">
            {ru.admin.jewelry.statusLabel}
          </span>
          <select
            name="status"
            defaultValue={status}
            className="h-10 rounded-lg border border-line bg-page px-3 text-sm text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <option value="">вЂ“</option>
            {Object.entries(jewelryStatusLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3 sm:col-span-2">
          <input
            type="checkbox"
            name="featured"
            value="1"
            defaultChecked={featured}
            className="size-5 rounded border-line text-primary focus:ring-primary"
          />
          <span className="text-sm text-ink">
            {ru.admin.jewelry.featuredLabel}
          </span>
        </label>
        <label className="flex items-center gap-3 sm:col-span-2">
          <input
            type="checkbox"
            name="lowStock"
            value="1"
            defaultChecked={lowStock}
            className="size-5 rounded border-line text-primary focus:ring-primary"
          />
          <span className="text-sm text-ink">
            {ru.admin.jewelry.lowStockLabel}
          </span>
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 sm:justify-end">
          <Button href="/admin/jewelry" variant="ghost" size="sm">
            {ru.admin.jewelry.clear}
          </Button>
          <Button size="sm">{ru.admin.jewelry.apply}</Button>
        </div>
      </form>

      {jewelries.length === 0 ? (
        <p className="text-mute">{ru.admin.jewelry.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {jewelries.map((j) => {
            const photo = firstPhotoUrl(j.photos);
            return (
              <li
                key={j.id}
                className="flex items-center gap-4 rounded-2xl border border-line bg-page p-3 transition-colors hover:border-primary"
              >
                <Link
                  href={`/admin/jewelry/${j.id}/edit`}
                  className="flex min-w-0 flex-1 items-center gap-4"
                >
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-card">
                    {photo ? (
                      <Image
                        src={photo}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-medium text-ink">
                        {j.name}
                      </h3>
                      {j.featured ? (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                          в…
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-mute">
                      {j.category.name} В· {j.material} В· {j.anchors.length}{" "}
                      Р°РЅРєРµСЂ(РѕРІ)
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-medium text-ink">
                      {formatPrice(j.price)}
                    </p>
                    <p className="text-xs text-mute">
                      {jewelryStatusLabels[j.status]}
                    </p>
                  </div>
                </Link>
                {/* StockAdjuster lives outside the Link so its buttons
                    don't trigger navigation. */}
                <div className="shrink-0">
                  <StockAdjuster jewelryId={j.id} stock={j.inStock} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
