import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { Button } from "@/components/shadcn/ui/button";
import {
  ReviewsBoard,
  type ReviewCounts,
  type ReviewRow,
} from "@/components/admin/reviews/ReviewsBoard";

export const metadata: Metadata = {
  title: ru.admin.reviews.title,
};

const RU_DATE = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const STATUSES = ["PENDING", "PUBLISHED", "REJECTED"] as const;
type StatusOpt = (typeof STATUSES)[number] | "";

interface Props {
  searchParams: Promise<{ status?: string; featured?: string }>;
}

export default async function AdminReviewsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status: StatusOpt = STATUSES.includes(sp.status as (typeof STATUSES)[number])
    ? (sp.status as (typeof STATUSES)[number])
    : "";
  const featuredOnly = sp.featured === "1";

  // Base scope = the featured toggle (independent of the status segment), so the
  // segment counts always match what each segment would actually show.
  const baseWhere: Prisma.ReviewWhereInput = featuredOnly ? { featured: true } : {};
  const listWhere: Prisma.ReviewWhereInput = status
    ? { ...baseWhere, status }
    : baseWhere;

  const [reviews, grouped] = await Promise.all([
    prisma.review.findMany({
      where: listWhere,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        jewelryItems: { select: { id: true, name: true } },
        appointment: { select: { id: true } },
      },
      take: 200,
    }),
    prisma.review.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { _all: true },
    }),
  ]);

  const counts: ReviewCounts = { all: 0, PENDING: 0, PUBLISHED: 0, REJECTED: 0 };
  for (const g of grouped) {
    counts[g.status] = g._count._all;
    counts.all += g._count._all;
  }

  const rows: ReviewRow[] = reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    text: r.text,
    authorName: r.authorName,
    status: r.status,
    featured: r.featured,
    verified: !!r.appointment,
    jewelry: r.jewelryItems.map((j) => j.name),
    createdAt: RU_DATE.format(r.createdAt),
  }));

  const t = ru.admin.reviews;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-10 flex flex-col gap-4 pt-2 sm:mb-12 sm:flex-row sm:items-end sm:justify-between sm:pt-4">
        <div>
          <h1 className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
            {t.title}
          </h1>
          <p className="mt-3 text-base text-mute">{t.lead}</p>
        </div>
        <Button asChild className="shrink-0 gap-2 px-5">
          <Link href="/admin/reviews/new">
            <Plus className="size-4" />
            {t.addNew}
          </Link>
        </Button>
      </header>

      <ReviewsBoard
        reviews={rows}
        status={status}
        featuredOnly={featuredOnly}
        counts={counts}
      />
    </div>
  );
}
