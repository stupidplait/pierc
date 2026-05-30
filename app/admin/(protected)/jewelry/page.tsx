import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru, jewelryStatusLabels } from "@/lib/i18n/ru";
import { PageHeader } from "@/components/ui/PageHeader";
import { StockAdjuster } from "@/components/admin/StockAdjuster";
import { CARD, FIELD_H, GHOST, LABEL, SUBMIT } from "@/components/admin/form/styles";
import { firstPhotoUrl, formatPrice } from "@/lib/jewelry/format";

export const metadata: Metadata = {
  title: `${ru.admin.nav.jewelry} — ${ru.admin.panel}`,
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
      include: {
        category: true,
        anchorBindings: { select: { anchorId: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
    prisma.jewelryCategory.findMany({ orderBy: { order: "asc" } }),
  ]);

  const t = ru.admin.jewelry;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader eyebrow={ru.admin.panel} title={t.title} lead={t.lead}>
        <Link href="/admin/jewelry/new" className={SUBMIT}>
          {t.addNew}
        </Link>
      </PageHeader>

      {/* ── Filters ─────────────────────────────────────────────── */}
      <form method="get" className={`${CARD} mb-8 grid gap-5 p-5 sm:grid-cols-4 sm:p-6`}>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className={LABEL}>{t.searchLabel}</span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={t.searchPlaceholder}
            className={FIELD_H}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>{t.categoryLabel}</span>
          <select name="category" defaultValue={categoryId} className={FIELD_H}>
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>{t.statusLabel}</span>
          <select name="status" defaultValue={status} className={FIELD_H}>
            <option value="">—</option>
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
            className="size-4 rounded border-ink/25 bg-ink/5 accent-accent focus-visible:ring-2 focus-visible:ring-accent/30"
          />
          <span className="text-sm text-ink">{t.featuredLabel}</span>
        </label>
        <label className="flex items-center gap-3 sm:col-span-2">
          <input
            type="checkbox"
            name="lowStock"
            value="1"
            defaultChecked={lowStock}
            className="size-4 rounded border-ink/25 bg-ink/5 accent-accent focus-visible:ring-2 focus-visible:ring-accent/30"
          />
          <span className="text-sm text-ink">{t.lowStockLabel}</span>
        </label>

        <div className="flex items-center gap-3 sm:col-span-4 sm:justify-end">
          <Link href="/admin/jewelry" className={GHOST}>
            {t.clear}
          </Link>
          <button type="submit" className={SUBMIT}>
            {t.apply}
          </button>
        </div>
      </form>

      {/* ── Results ─────────────────────────────────────────────── */}
      {jewelries.length === 0 ? (
        <p className="text-sm text-mute">{t.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {jewelries.map((j) => {
            const photo = firstPhotoUrl(j.photos);
            return (
              <li
                key={j.id}
                className="flex items-center gap-4 rounded-2xl border border-line bg-card p-3 transition-colors hover:border-ink/30"
              >
                <Link
                  href={`/admin/jewelry/${j.id}/edit`}
                  className="flex min-w-0 flex-1 items-center gap-4"
                >
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-bg">
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
                        <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                          ★
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-mute">
                      {j.category.name} · {j.material} · {j.anchorBindings.length}{" "}
                      анкер(ов)
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
