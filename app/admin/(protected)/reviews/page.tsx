import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { Reveal } from "@/components/admin/form/atelier";
import { Button } from "@/components/shadcn/ui/button";
import {
  REVIEW_STATUSES,
  type ReviewCounts,
  type ReviewItem,
  type ReviewStatus,
} from "@/lib/admin/reviews-view";
import { WallView } from "@/components/admin/reviews/views/WallView";

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

  const t = ru.admin.reviews;

  /** Build a list URL, carrying whichever facets are still active. */
  const buildHref = (next: {
    status?: ReviewStatus | "";
    featured?: boolean;
  }): string => {
    const params = new URLSearchParams();
    const s = next.status ?? status;
    const f = next.featured ?? featuredOnly;
    if (s) params.set("status", s);
    if (f) params.set("featured", "1");
    const qs = params.toString();
    return qs ? `/admin/reviews?${qs}` : "/admin/reviews";
  };

  const statusOptions: {
    value: ReviewStatus | "";
    label: string;
    count: number;
  }[] = [
    { value: "", label: t.filter.all, count: counts.all },
    { value: "PENDING", label: t.filter.pending, count: counts.PENDING },
    { value: "PUBLISHED", label: t.filter.published, count: counts.PUBLISHED },
    { value: "REJECTED", label: t.filter.rejected, count: counts.REJECTED },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-8 flex flex-col gap-5 pt-2 sm:mb-10 sm:flex-row sm:items-end sm:justify-between sm:pt-4">
        <div>
          <h1 className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
            {t.title}
          </h1>
          <p className="mt-3 text-base text-mute">{t.lead}</p>
        </div>

        <Button asChild className="shrink-0 gap-2 px-5">
          <Link href="/admin/reviews/new">
            <Plus className="size-4" />
            <span className="hidden sm:inline">{t.addNew}</span>
          </Link>
        </Button>
      </header>

      {/* ── Filters: status segments + featured toggle ────────────────── */}
      <Reveal className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          aria-label={t.statusLabel}
          className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-line bg-card p-1"
        >
          {statusOptions.map((opt) => {
            const active = opt.value === status;
            return (
              <Link
                key={opt.value || "all"}
                href={buildHref({ status: opt.value })}
                aria-current={active ? "true" : undefined}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ${
                  active ? "bg-ink text-bg" : "text-mute hover:text-ink"
                }`}
              >
                <span>{opt.label}</span>
                <span
                  className={`text-xs tabular-nums ${
                    active ? "text-bg/65" : "text-mute/65"
                  }`}
                >
                  {opt.count}
                </span>
              </Link>
            );
          })}
        </div>

        <Button
          asChild
          variant={featuredOnly ? "default" : "outline"}
          size="sm"
          className="shrink-0 gap-1.5"
        >
          <Link
            href={buildHref({ featured: !featuredOnly })}
            aria-pressed={featuredOnly ? "true" : "false"}
          >
            <StarGlyph filled={featuredOnly} />
            {t.featuredOnlyLabel}
          </Link>
        </Button>
      </Reveal>

      {/* ── Reviews wall ──────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <Reveal delay={0.08}>
          <div className="rounded-2xl border border-line bg-card px-6 py-16 text-center">
            <p className="text-sm text-mute">{t.empty}</p>
          </div>
        </Reveal>
      ) : (
        <WallView items={items} />
      )}
    </div>
  );
}

/** Star glyph for the "featured only" toggle — fills when active. */
function StarGlyph({ filled }: { filled: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.6l1.78 3.93 4.3.47-3.2 2.9.87 4.23L8 11.5l-3.75 2.03.87-4.23-3.2-2.9 4.3-.47L8 1.6Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}
