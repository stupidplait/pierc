"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, MotionConfig } from "framer-motion";
import { ru } from "@/lib/i18n/ru";
import { CARD } from "@/components/admin/form/styles";
import { ReviewStatusBadge } from "@/components/admin/StatusBadges";
import { ArrowIcon } from "@/components/admin/dashboard/icons";
import { container, item } from "./ui";
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
 * Reviews moderation board — a segmented status strip + a "featured only" toggle
 * over a single elevated list card with hairline-divided rows, mirroring the
 * jewelry / bookings boards so the admin reads as one family. The server owns the
 * filtering; this only writes `?status` / `?featured` and shows a quiet pending
 * wash while the navigation resolves.
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
    // same convention as the catalog + bookings boards.
    startTransition(() => {
      replace(qs ? `/admin/reviews?${qs}` : "/admin/reviews", { scroll: false });
    });
  }

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-6"
      >
        {/* ── Status filter + featured toggle ───────────────────────── */}
        <motion.div
          variants={item}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div
            aria-label={t.statusLabel}
            className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-line bg-card p-1"
          >
            {SEGMENTS.map((seg) => (
              <FilterChip
                key={seg.value || "all"}
                label={seg.label}
                count={counts[seg.countKey]}
                active={seg.value === status}
                onSelect={() => navigate({ status: seg.value, featured: featuredOnly })}
              />
            ))}
          </div>

          <FeaturedToggle
            active={featuredOnly}
            onToggle={() => navigate({ status, featured: !featuredOnly })}
          />
        </motion.div>

        {/* ── List ──────────────────────────────────────────────────── */}
        <motion.div
          variants={item}
          className={`${CARD} overflow-hidden transition-opacity duration-200 ${
            pending ? "opacity-60" : ""
          }`}
        >
          {reviews.length === 0 ? (
            <p className="px-6 py-16 text-center text-sm text-mute">{t.empty}</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {reviews.map((r) => (
                <li key={r.id}>
                  <ReviewRowLink review={r} />
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </motion.div>
    </MotionConfig>
  );
}

/** A single review as a divided list row — status badge, author + provenance
 *  chips, rating + date, a two-line excerpt, and any linked jewelry. The whole
 *  row links to the editor (the moderation actions live there). */
function ReviewRowLink({ review: r }: { review: ReviewRow }) {
  return (
    <Link
      href={`/admin/reviews/${r.id}/edit`}
      className="group flex items-start gap-4 px-5 py-4 transition-colors duration-150 hover:bg-ink/3 sm:px-6"
    >
      <span className="mt-0.5 shrink-0">
        <ReviewStatusBadge status={r.status} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="truncate font-display text-base font-medium tracking-tight text-ink">
            {r.authorName}
          </span>
          {r.verified ? <VerifiedChip /> : null}
          {r.featured ? <FeaturedChip /> : null}
          <span className="ml-auto flex shrink-0 items-center gap-2.5">
            <StarRating value={r.rating} />
            <span className="text-xs text-mute tabular-nums">{r.createdAt}</span>
          </span>
        </span>

        <span className="mt-1.5 block line-clamp-2 text-sm leading-relaxed text-mute">
          {r.text}
        </span>

        {r.jewelry.length > 0 ? (
          <span className="mt-2.5 flex flex-wrap gap-1.5">
            {r.jewelry.map((name, i) => (
              <JewelryChip key={`${name}-${i}`}>{name}</JewelryChip>
            ))}
          </span>
        ) : null}
      </span>

      <ArrowIcon className="mt-1.5 hidden shrink-0 text-mute/0 transition-colors duration-150 group-hover:text-mute sm:block" />
    </Link>
  );
}

/** One segment of the status filter — ink-fill active chip / quiet inactive chip
 *  with a tabular count, matching the catalog + bookings boards. */
function FilterChip({
  label,
  count,
  active,
  onSelect,
}: {
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ${
        active ? "bg-ink text-bg" : "text-mute hover:text-ink"
      }`}
    >
      <span>{label}</span>
      <span className={`text-xs tabular-nums ${active ? "text-bg/65" : "text-mute/65"}`}>
        {count}
      </span>
    </button>
  );
}

/** "Featured only" filter — a star pill that warms to accent when active. Writes
 *  `?featured=1` straight to the URL (the server owns the actual filtering). */
function FeaturedToggle({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active ? "true" : "false"}
      onClick={onToggle}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3.5 text-sm font-medium transition-colors duration-150 ${
        active
          ? "border-accent/50 bg-accent/10 text-accent"
          : "border-line text-mute hover:border-ink/30 hover:text-ink"
      }`}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M8 1.6l1.78 3.93 4.3.47-3.2 2.9.87 4.23L8 11.5l-3.75 2.03.87-4.23-3.2-2.9 4.3-.47L8 1.6Z"
          fill={active ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
      {t.featuredOnlyLabel}
    </button>
  );
}
