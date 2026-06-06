import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import {
  REVIEW_STATUSES,
  type ReviewCounts,
  type ReviewItem,
  type ReviewStatus,
} from "@/lib/admin/reviews-view";
import { ReviewsConsole } from "@/components/admin/reviews/ReviewsConsole";

export const metadata: Metadata = {
  title: ru.admin.reviews.title,
};

const RU_DATE = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

interface Props {
  searchParams: Promise<{ status?: string; featured?: string }>;
}

export default async function AdminReviewsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status: ReviewStatus | "" = REVIEW_STATUSES.includes(
    sp.status as ReviewStatus,
  )
    ? (sp.status as ReviewStatus)
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

  const items: ReviewItem[] = reviews.map((r) => ({
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

  return (
    <ReviewsConsole
      items={items}
      counts={counts}
      status={status}
      featuredOnly={featuredOnly}
    />
  );
}
