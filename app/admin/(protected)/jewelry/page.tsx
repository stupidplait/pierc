import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { firstPhotoUrl, formatPrice } from "@/lib/jewelry/format";
import type { JewelryStatus } from "@/components/admin/jewelry/JewelryFilters";
import type { JewelryRow } from "@/components/admin/jewelry/JewelryBoard";
import { CatalogHeader } from "@/components/admin/jewelry/CatalogHeader";
import { JewelryCatalog } from "@/components/admin/jewelry/JewelryCatalog";

export const metadata: Metadata = {
  title: ru.admin.nav.jewelry,
};

const STATUSES: JewelryStatus[] = [
  "DRAFT",
  "PROCESSING",
  "PENDING_REVIEW",
  "PUBLISHED",
  "REJECTED",
];

interface AdminJewelryPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    status?: string;
    featured?: string;
    lowStock?: string;
    error?: string;
  }>;
}

export default async function AdminJewelryPage({
  searchParams,
}: AdminJewelryPageProps) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  // `category` is now a comma-joined list of ids (multi-select). "all" is the
  // legacy single-select sentinel and maps to no filter.
  const categoryIds = (sp.category ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s !== "all");
  const status = STATUSES.includes(sp.status as JewelryStatus)
    ? (sp.status as JewelryStatus)
    : "";
  const featured = sp.featured === "1";
  const lowStock = sp.lowStock === "1";
  const deleteError = sp.error;

  // Filters shared by both the list query and the per-status counts. Hide
  // never-saved drafts — empty-name ⟺ an abandoned legacy draft (pre-lazy-create;
  // the editor requires a name). The cleanup-drafts cron reaps these, but keep
  // the guard so any still-pending row never surfaces here in the meantime.
  const baseWhere: Prisma.JewelryWhereInput = {
    NOT: { status: "DRAFT", name: "" },
  };
  if (q) {
    baseWhere.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { material: { contains: q, mode: "insensitive" } },
    ];
  }
  if (categoryIds.length) baseWhere.categoryId = { in: categoryIds };
  if (featured) baseWhere.featured = true;
  if (lowStock) baseWhere.inStock = { lte: 1 };

  // The list also narrows by the active status; the count strip does not (so
  // each chip shows how many match the *other* filters).
  const listWhere: Prisma.JewelryWhereInput = status
    ? { ...baseWhere, status }
    : baseWhere;

  const [jewelries, categories, grouped] = await Promise.all([
    prisma.jewelry.findMany({
      where: listWhere,
      include: {
        category: true,
        anchorBindings: { select: { anchorId: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      // Cap the payload — this is the one admin list that grows unboundedly (every
      // piece ever created, drafts included). Matches the catalog/admin list caps;
      // the count strip below is computed via groupBy so totals stay accurate.
      take: 500,
    }),
    prisma.jewelryCategory.findMany({ orderBy: { order: "asc" } }),
    prisma.jewelry.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { _all: true },
    }),
  ]);

  const counts = STATUSES.reduce(
    (acc, s) => {
      acc[s] = 0;
      return acc;
    },
    {} as Record<JewelryStatus, number>,
  );
  let total = 0;
  for (const g of grouped) {
    const s = g.status as JewelryStatus;
    if (s in counts) {
      counts[s] = g._count._all;
      total += g._count._all;
    }
  }

  const rows: JewelryRow[] = jewelries.map((j) => ({
    id: j.id,
    name: j.name,
    status: j.status as JewelryStatus,
    featured: j.featured,
    photo: firstPhotoUrl(j.photos),
    price: formatPrice(j.price),
    categoryName: j.category.name,
    material: j.material,
    anchorCount: j.anchorBindings.length,
    inStock: j.inStock,
  }));

  return (
    <div className="mx-auto w-full max-w-6xl">
      <CatalogHeader />

      {deleteError === "has-bookings" ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          Нельзя удалить украшение с историей записей. Снимите его с публикации
          или архивируйте вместо удаления.
        </div>
      ) : null}

      <JewelryCatalog
        q={q}
        categoryIds={categoryIds}
        status={status}
        featured={featured}
        lowStock={lowStock}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        counts={counts}
        total={total}
        rows={rows}
      />
    </div>
  );
}
