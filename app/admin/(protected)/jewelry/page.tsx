import type { Metadata } from "next";
import { Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { createDraftJewelry } from "@/lib/admin/jewelry-actions";
import { SUBMIT } from "@/components/admin/form/styles";
import { firstPhotoUrl, formatPrice } from "@/lib/jewelry/format";
import {
  JewelryFilters,
  type JewelryStatus,
} from "@/components/admin/jewelry/JewelryFilters";
import {
  JewelryBoard,
  type JewelryRow,
} from "@/components/admin/jewelry/JewelryBoard";

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
  }>;
}

export default async function AdminJewelryPage({
  searchParams,
}: AdminJewelryPageProps) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  // The category Select uses an "all" sentinel for the no-filter option
  // (Radix forbids an empty item value); treat it as unset.
  const categoryId = sp.category && sp.category !== "all" ? sp.category : "";
  const status = STATUSES.includes(sp.status as JewelryStatus)
    ? (sp.status as JewelryStatus)
    : "";
  const featured = sp.featured === "1";
  const lowStock = sp.lowStock === "1";

  // Filters shared by both the list query and the per-status counts. Hide
  // never-saved drafts (createDraftJewelry rows the admin abandoned) — the form
  // requires a name, so empty-name ⟺ untouched draft.
  const baseWhere: Prisma.JewelryWhereInput = {
    NOT: { status: "DRAFT", name: "" },
  };
  if (q) {
    baseWhere.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { material: { contains: q, mode: "insensitive" } },
    ];
  }
  if (categoryId) baseWhere.categoryId = categoryId;
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

  const t = ru.admin.jewelry;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-10 flex flex-col gap-4 pt-2 sm:mb-12 sm:flex-row sm:items-end sm:justify-between sm:pt-4">
        <div>
          <h1 className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
            {t.title}
          </h1>
          <p className="mt-3 text-base text-mute">{t.lead}</p>
        </div>
        <form action={createDraftJewelry} className="shrink-0">
          <button type="submit" className={`${SUBMIT} gap-2 px-5`}>
            <Plus className="size-4" />
            {t.addShort}
          </button>
        </form>
      </header>

      <div className="flex flex-col gap-8">
        <JewelryFilters
          q={q}
          categoryId={categoryId}
          status={status}
          featured={featured}
          lowStock={lowStock}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          counts={counts}
          total={total}
        />
        <JewelryBoard rows={rows} />
      </div>
    </div>
  );
}
