"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { domMax, LazyMotion, m, MotionConfig } from "framer-motion";
import { Plus, Star } from "lucide-react";
import {
  type ReviewCounts,
  type ReviewItem,
  type ReviewStatus,
} from "@/lib/admin/reviews-view";
import { REVEAL_EASE } from "@/components/motion/entrance";
import { blurReveal } from "@/components/motion/Stagger";
import { AnimateNumber } from "@/components/ui/AnimateNumber";
import { WordReveal } from "@/components/motion/WordReveal";
import { ReviewsWall } from "./ReviewsWall";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";

const t = ru.admin.reviews;

const NEW_HREF = "/admin/reviews/new";

// Toolbar-height primary action (the atelier SAVE_PILL is taller — this matches
// the tab strip's py-1.5 row so the toolbar reads as one bar).
const PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-5 py-2 text-sm font-medium text-bg transition-colors duration-150 hover:bg-ink/90 active:scale-[0.98]";

/** Per-element blur-rise on first paint; static (no replay) after interaction. */
function entrance(animateIn: boolean, index = 0) {
  return animateIn ? blurReveal(index) : { initial: false as const };
}

/**
 * The /admin/reviews client island — the single interactive surface the server
 * page renders. It owns the filter→URL navigation (status segments + the
 * "featured only" toggle, every write a scroll-preserving `router.replace`
 * inside a transition) and gates the first-paint blur-stagger on `animateIn`, so
 * the cascade plays once on load and never re-runs on a filter change.
 */
export function ReviewsConsole({
  items,
  counts,
  status,
  featuredOnly,
}: {
  items: ReviewItem[];
  counts: ReviewCounts;
  status: ReviewStatus | "";
  featuredOnly: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [hasInteracted, setHasInteracted] = useState(false);

  // All filter writes funnel through here: clone the live params, mutate, and
  // replace inside a transition so `isPending` can dim the wall. Bail when the
  // query didn't move (re-clicking the active tab) so we don't refetch identical
  // rows. The first interaction freezes the entrance stagger (animateIn → false).
  const navigate = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const qs = params.toString();
      if (qs === searchParams.toString()) return;
      setHasInteracted(true);
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  const selectStatus = useCallback(
    (next: ReviewStatus | "") =>
      navigate((p) => {
        if (next) p.set("status", next);
        else p.delete("status");
      }),
    [navigate],
  );

  const toggleFeatured = useCallback(
    () =>
      navigate((p) => {
        if (featuredOnly) p.delete("featured");
        else p.set("featured", "1");
      }),
    [navigate, featuredOnly],
  );

  const animateIn = !hasInteracted && !isPending;

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
    <LazyMotion features={domMax}>
      <MotionConfig reducedMotion="user">
        <div className="mx-auto w-full max-w-6xl">
          {/* ── Header ──────────────────────────────────────────────────── */}
          <header className="mb-8 flex flex-col gap-5 pt-2 sm:mb-10 sm:flex-row sm:items-end sm:justify-between sm:pt-4">
            <div>
              <WordReveal
                as="h1"
                text={t.title}
                splitBy="char"
                stagger={0.04}
                amount={0.1}
                className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl"
              />
              <WordReveal
                as="p"
                text={t.lead}
                delay={0.3}
                stagger={0.03}
                amount={0.1}
                className="mt-3 max-w-prose text-base text-mute"
              />
            </div>
          </header>

          {/* ── Toolbar: status segments + favorites toggle + Add ───────── */}
          <m.div
            {...entrance(animateIn)}
            className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <StatusTabs
              options={statusOptions}
              status={status}
              animateIn={animateIn}
              onSelect={selectStatus}
            />
            <div className="flex items-center gap-2">
              <FavoritesButton active={featuredOnly} onToggle={toggleFeatured} />
              <Link href={NEW_HREF} className={cn(PRIMARY, "shrink-0")}>
                <Plus className="size-4" />
                <span className="hidden sm:inline">{t.addNew}</span>
              </Link>
            </div>
          </m.div>

          {/* ── Wall ────────────────────────────────────────────────────── */}
          {items.length === 0 ? (
            <m.div {...entrance(animateIn)}>
              <div className="rounded-2xl border border-line bg-card px-6 py-16 text-center">
                <p className="text-sm text-mute">{t.empty}</p>
              </div>
            </m.div>
          ) : (
            <div
              className={cn(
                "transition-opacity duration-200",
                isPending && "pointer-events-none opacity-60",
              )}
            >
              <ReviewsWall items={items} animateIn={animateIn} />
            </div>
          )}
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}

/**
 * Status segmented control — selecting one scopes the wall to that status. Each
 * tab cascades in (its own blur-rise, offset by index) over the strip's own
 * entrance, and the active pill slides between tabs via a shared `layoutId`.
 * Counts roll 0 → n once on mount and spring on later changes.
 */
function StatusTabs({
  options,
  status,
  animateIn,
  onSelect,
}: {
  options: { value: ReviewStatus | ""; label: string; count: number }[];
  status: ReviewStatus | "";
  animateIn: boolean;
  onSelect: (status: ReviewStatus | "") => void;
}) {
  return (
    <nav
      aria-label={t.statusLabel}
      className="inline-flex w-fit max-w-full flex-wrap items-center gap-1 rounded-xl border border-line bg-card p-1"
    >
      {options.map((opt, i) => {
        const active = opt.value === status;
        return (
          <m.button
            key={opt.value || "all"}
            {...entrance(animateIn, i + 1)}
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={() => onSelect(opt.value)}
            aria-current={active ? "true" : undefined}
            className={cn(
              "relative inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              active ? "text-bg" : "text-mute hover:text-ink",
            )}
          >
            {active ? (
              <m.span
                layoutId="reviews-tab-active"
                className="absolute inset-0 rounded-lg bg-ink"
                transition={{ ease: REVEAL_EASE, duration: 0.25 }}
              />
            ) : null}
            <span className="relative z-10">{opt.label}</span>
            <span
              className={cn(
                "relative z-10 text-xs tabular-nums",
                active ? "text-bg/65" : "text-mute/65",
              )}
            >
              <AnimateNumber value={opt.count} from={0} />
              <span className="sr-only">{opt.count}</span>
            </span>
          </m.button>
        );
      })}
    </nav>
  );
}

/** Standalone "only favorites" toggle — outline pill that fills accent when active. */
function FavoritesButton({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition-colors duration-150 active:scale-[0.98]",
        active
          ? "border-accent/50 bg-accent/10 text-accent"
          : "border-line text-mute hover:border-ink/30 hover:text-ink",
      )}
    >
      <Star className={cn("size-4", active && "fill-current")} aria-hidden />
      <span>{t.featuredOnlyLabel}</span>
    </button>
  );
}
