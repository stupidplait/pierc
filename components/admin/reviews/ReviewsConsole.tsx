"use client";

import { useCallback, useState, useTransition, type ReactNode } from "react";
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
import { VariantSwitcher } from "@/components/admin/content/VariantSwitcher";
import { ReviewsWall, type CardVariant } from "./ReviewsWall";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";

const t = ru.admin.reviews;

// ── Trial switchers — temporary affordances while we pick a final look. ─────────
//   toolbar: where the Add + "only favorites" controls live.
//   cards:   how the wall renders each review.
type ToolbarVariant = "cluster" | "header" | "icons";
const TOOLBAR_OPTIONS = [
  { value: "cluster", label: "Группа" },
  { value: "header", label: "В шапке" },
  { value: "icons", label: "Иконки" },
] as const;
const CARD_OPTIONS = [
  { value: "wall", label: "Стена" },
  { value: "grid", label: "Сетка" },
] as const;

const NEW_HREF = "/admin/reviews/new";

// Toolbar-height primary action (the header/atelier SAVE_PILL is taller — this
// matches the tab strip's py-1.5 row so the cluster reads as one bar).
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
 *
 * Two trial switchers let us compare button placements and card treatments side
 * by side; both live in client state, so flipping a variant survives the
 * server round-trips a filter change triggers.
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
  const [toolbar, setToolbar] = useState<ToolbarVariant>("cluster");
  const [cards, setCards] = useState<CardVariant>("wall");

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

  const tabs = (
    <StatusTabs
      options={statusOptions}
      status={status}
      animateIn={animateIn}
      onSelect={selectStatus}
      // In the "header" layout the favorites toggle is folded into the strip.
      trailing={
        toolbar === "header" ? (
          <FavoritesSegment active={featuredOnly} onToggle={toggleFeatured} />
        ) : null
      }
    />
  );

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

            {/* "header" layout keeps the primary Add pill up here (catalog convention). */}
            {toolbar === "header" ? (
              <m.div {...entrance(animateIn)} className="shrink-0">
                <Link href={NEW_HREF} className={PRIMARY}>
                  <Plus className="size-4" />
                  {t.addNew}
                </Link>
              </m.div>
            ) : null}
          </header>

          {/* ── Trial switchers (temporary) ─────────────────────────────── */}
          <m.div
            {...entrance(animateIn)}
            className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2"
          >
            <VariantSwitcher
              label="Кнопки:"
              value={toolbar}
              options={TOOLBAR_OPTIONS}
              onChange={setToolbar}
            />
            <VariantSwitcher
              label="Карточки:"
              value={cards}
              options={CARD_OPTIONS}
              onChange={setCards}
            />
          </m.div>

          {/* ── Toolbar: status segments + the two controls ─────────────── */}
          {toolbar === "cluster" ? (
            <m.div
              {...entrance(animateIn)}
              className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              {tabs}
              <div className="flex items-center gap-2">
                <FavoritesButton active={featuredOnly} onToggle={toggleFeatured} />
                <Link href={NEW_HREF} className={cn(PRIMARY, "shrink-0")}>
                  <Plus className="size-4" />
                  <span className="hidden sm:inline">{t.addNew}</span>
                </Link>
              </div>
            </m.div>
          ) : null}

          {toolbar === "header" ? (
            <m.div {...entrance(animateIn)} className="mb-7">
              {tabs}
            </m.div>
          ) : null}

          {toolbar === "icons" ? (
            <m.div
              {...entrance(animateIn)}
              className="mb-7 flex flex-wrap items-center gap-2"
            >
              {tabs}
              <span aria-hidden className="mx-0.5 hidden h-7 w-px bg-line sm:block" />
              <FavoritesButton
                active={featuredOnly}
                onToggle={toggleFeatured}
                iconOnly
              />
              <Link href={NEW_HREF} aria-label={t.addNew} className={cn(PRIMARY, "px-0 size-10")}>
                <Plus className="size-4" />
              </Link>
            </m.div>
          ) : null}

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
              <ReviewsWall items={items} variant={cards} animateIn={animateIn} />
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
 * Counts roll 0 → n once on mount and spring on later changes. `trailing` lets
 * the "header" layout fold the favorites toggle into the same strip.
 */
function StatusTabs({
  options,
  status,
  animateIn,
  onSelect,
  trailing,
}: {
  options: { value: ReviewStatus | ""; label: string; count: number }[];
  status: ReviewStatus | "";
  animateIn: boolean;
  onSelect: (status: ReviewStatus | "") => void;
  trailing?: ReactNode;
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

      {trailing ? (
        <>
          <span aria-hidden className="mx-0.5 h-5 w-px self-center bg-line" />
          {trailing}
        </>
      ) : null}
    </nav>
  );
}

/** Standalone "only favorites" toggle — outline pill (or icon-only) that fills
 *  accent when active. Used by the cluster + icons layouts. */
function FavoritesButton({
  active,
  onToggle,
  iconOnly = false,
}: {
  active: boolean;
  onToggle: () => void;
  iconOnly?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={iconOnly ? t.featuredOnlyLabel : undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border text-sm font-medium transition-colors duration-150 active:scale-[0.98]",
        iconOnly ? "size-10" : "px-4 py-2",
        active
          ? "border-accent/50 bg-accent/10 text-accent"
          : "border-line text-mute hover:border-ink/30 hover:text-ink",
      )}
    >
      <Star className={cn("size-4", active && "fill-current")} aria-hidden />
      {iconOnly ? null : <span>{t.featuredOnlyLabel}</span>}
    </button>
  );
}

/** "Only favorites" as a borderless segment folded inside the status strip
 *  ("header" layout). Mirrors a tab's padding so the strip reads as one control. */
function FavoritesSegment({
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
        "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-accent/15 text-accent" : "text-mute hover:text-ink",
      )}
    >
      <Star className={cn("size-3.5", active && "fill-current")} aria-hidden />
      <span>{t.featuredOnlyLabel}</span>
    </button>
  );
}
