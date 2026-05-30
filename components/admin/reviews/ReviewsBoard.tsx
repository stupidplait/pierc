"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, MotionConfig } from "framer-motion";
import { ru } from "@/lib/i18n/ru";
import { ReviewStatusBadge } from "@/components/admin/StatusBadges";
import { SURFACE, container, item } from "./ui";
import { FeaturedChip, JewelryChip, StarRating, VerifiedChip } from "./chips";

export type ReviewStatus = "PENDING" | "PUBLISHED" | "REJECTED";

export interface ReviewRow {
  id: string;
  rating: number;
  text: string;
  authorName: string;
  status: ReviewStatus;
  featured: boolean;
  verified: boolean;
  jewelry: string[];
  /** Pre-formatted RU date — the server owns formatting so the client stays
   *  Date-free (no hydration drift, no Date-in-render lint). */
  createdAt: string;
}

export interface ReviewCounts {
  all: number;
  PENDING: number;
  PUBLISHED: number;
  REJECTED: number;
}

const t = ru.admin.reviews;

const SEGMENTS: { value: "" | ReviewStatus; label: string; countKey: keyof ReviewCounts }[] = [
  { value: "", label: t.filter.all, countKey: "all" },
  { value: "PENDING", label: t.filter.pending, countKey: "PENDING" },
  { value: "PUBLISHED", label: t.filter.published, countKey: "PUBLISHED" },
  { value: "REJECTED", label: t.filter.rejected, countKey: "REJECTED" },
];

/**
 * The reviews moderation board — a segmented status filter (mirroring the
 * settings tab bar) over a grid of elevated review cards that blur-focus in
 * with the house entrance. The server owns the actual filtering; this only
 * writes `?status` / `?featured` and re-keys the list so it re-staggers when
 * the filter changes.
 */
export function ReviewsBoard({
  reviews,
  status,
  featuredOnly,
  counts,
}: {
  reviews: ReviewRow[];
  status: "" | ReviewStatus;
  featuredOnly: boolean;
  counts: ReviewCounts;
}) {
  const { replace } = useRouter();
  const [pending, startTransition] = useTransition();

  function navigate(next: { status: "" | ReviewStatus; featured: boolean }) {
    const params = new URLSearchParams();
    if (next.status) params.set("status", next.status);
    if (next.featured) params.set("featured", "1");
    const qs = params.toString();
    // `replace` (not `push`) so toggling filters doesn't spam browser history —
    // same convention as the catalog Showroom.
    startTransition(() => {
      replace(qs ? `/admin/reviews?${qs}` : "/admin/reviews", { scroll: false });
    });
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col gap-8">
        {/* ── Filters ──────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            aria-label={t.statusLabel}
            className="inline-flex w-fit max-w-full overflow-x-auto rounded-xl border border-line bg-card p-1"
          >
            {SEGMENTS.map((seg) => {
              const active = seg.value === status;
              return (
                <button
                  key={seg.value || "all"}
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => navigate({ status: seg.value, featured: featuredOnly })}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    active ? "bg-ink text-bg" : "text-mute hover:text-ink"
                  }`}
                >
                  {seg.label}
                  <span
                    className={`text-xs tabular-nums ${active ? "text-bg/60" : "text-mute/60"}`}
                  >
                    {counts[seg.countKey]}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            aria-pressed={featuredOnly ? "true" : "false"}
            onClick={() => navigate({ status, featured: !featuredOnly })}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3.5 text-sm font-medium transition-colors ${
              featuredOnly
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-line text-mute hover:border-ink/30 hover:text-ink"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M8 1.6l1.78 3.93 4.3.47-3.2 2.9.87 4.23L8 11.5l-3.75 2.03.87-4.23-3.2-2.9 4.3-.47L8 1.6Z"
                fill={featuredOnly ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
            {t.featuredOnlyLabel}
          </button>
        </div>

        {/* ── List ─────────────────────────────────────────────── */}
        {reviews.length === 0 ? (
          <div className={`${SURFACE} px-6 py-16 text-center`}>
            <p className="text-sm text-mute">{t.empty}</p>
          </div>
        ) : (
          <motion.ul
            // Re-key on filter change so the stagger replays as feedback.
            key={`${status}|${featuredOnly ? 1 : 0}`}
            variants={container}
            initial="hidden"
            animate="show"
            className={`grid grid-cols-1 gap-4 transition-opacity duration-200 lg:grid-cols-2 ${
              pending ? "opacity-60" : ""
            }`}
          >
            {reviews.map((r) => (
              <motion.li key={r.id} variants={item}>
                <ReviewCard review={r} />
              </motion.li>
            ))}
          </motion.ul>
        )}
      </div>
    </MotionConfig>
  );
}

function ReviewCard({ review: r }: { review: ReviewRow }) {
  return (
    <Link
      href={`/admin/reviews/${r.id}/edit`}
      className={`${SURFACE} flex h-full flex-col p-5 transition-colors duration-150 hover:border-ink/25 sm:p-6`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="truncate font-display text-base font-medium tracking-tight text-ink">
            {r.authorName}
          </span>
          {r.verified ? <VerifiedChip /> : null}
        </div>
        <ReviewStatusBadge status={r.status} />
      </div>

      <div className="mt-2.5 flex items-center gap-3">
        <StarRating value={r.rating} />
        <span className="text-xs text-mute">{r.createdAt}</span>
        {r.featured ? <FeaturedChip /> : null}
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-mute">{r.text}</p>

      {r.jewelry.length > 0 ? (
        <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
          {r.jewelry.map((name, i) => (
            <JewelryChip key={`${name}-${i}`}>{name}</JewelryChip>
          ))}
        </div>
      ) : null}
    </Link>
  );
}
