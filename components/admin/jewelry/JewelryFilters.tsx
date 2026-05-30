"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, MotionConfig, type Variants } from "framer-motion";
import { Search } from "lucide-react";
import {
  ENTRANCE_DURATION,
  ENTRANCE_HIDDEN,
  ENTRANCE_SHOW,
  ENTRANCE_STAGGER,
  REVEAL_EASE,
} from "@/components/services/entrance/config";
import { ru, jewelryStatusLabels } from "@/lib/i18n/ru";
import { CARD } from "@/components/admin/form/styles";
import { Input } from "@/components/shadcn/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/ui/select";

export type JewelryStatus =
  | "DRAFT"
  | "PROCESSING"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "REJECTED";

const STATUSES: JewelryStatus[] = [
  "DRAFT",
  "PROCESSING",
  "PENDING_REVIEW",
  "PUBLISHED",
  "REJECTED",
];

// Radix Select forbids an empty-string item value, so the "all categories"
// option carries this sentinel; we map it back to no filter when writing the URL.
const ALL_CATEGORIES = "all";

// Search waits this long after the last keystroke before pushing to the URL, so
// typing doesn't fire a navigation per character.
const SEARCH_DEBOUNCE_MS = 300;

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: ENTRANCE_STAGGER, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: ENTRANCE_HIDDEN,
  show: {
    ...ENTRANCE_SHOW,
    transition: { duration: ENTRANCE_DURATION, ease: REVEAL_EASE },
  },
};

/**
 * Catalog filters — a segmented status strip above one compact toolbar (search /
 * category / toggles). Every control writes the active filters straight to the
 * URL search params via `router.replace` inside a transition, so changes are
 * client-side navigations that retain the shared admin shell — no full reload.
 * Search is debounced and locally controlled for snappy typing; all other
 * filters are driven by the props the server resolves from the URL.
 */
export function JewelryFilters({
  q,
  categoryId,
  status,
  featured,
  lowStock,
  categories,
  counts,
  total,
}: {
  q: string;
  categoryId: string;
  status: JewelryStatus | "";
  featured: boolean;
  lowStock: boolean;
  categories: { id: string; name: string }[];
  counts: Record<JewelryStatus, number>;
  total: number;
}) {
  const t = ru.admin.jewelry;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Snappy local mirror of the search box; the URL trails it by the debounce.
  // When `q` changes from outside our own typing (Clear, browser back/forward),
  // re-sync during render — the documented React way to adjust state to a prop
  // without an effect (keeps clear of the strict set-state-in-effect lint).
  const [search, setSearch] = useState(q);
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    setSearch(q);
  }

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  const onSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(
        () => setParam("q", value.trim()),
        SEARCH_DEBOUNCE_MS,
      );
    },
    [setParam],
  );

  const clearAll = useCallback(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearch("");
    startTransition(() => router.replace(pathname, { scroll: false }));
  }, [pathname, router]);

  const hasFilters = Boolean(
    q || categoryId || status || featured || lowStock,
  );

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-4"
      >
        {/* ── Segmented status filter ───────────────────────────────── */}
        <motion.div variants={item}>
          <div className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-line bg-card p-1">
            <StatusChip
              label={t.statusAny}
              count={total}
              active={status === ""}
              onSelect={() => setParam("status", "")}
            />
            {STATUSES.map((s) => (
              <StatusChip
                key={s}
                label={jewelryStatusLabels[s]}
                count={counts[s]}
                active={status === s}
                onSelect={() => setParam("status", s)}
              />
            ))}
          </div>
        </motion.div>

        {/* ── Compact toolbar ───────────────────────────────────────── */}
        <motion.div
          variants={item}
          className={`${CARD} flex flex-wrap items-center gap-2.5 p-2.5`}
        >
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute/60" />
            <Input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t.searchPlaceholder}
              aria-label={t.searchLabel}
              className="pl-9"
            />
          </div>

          <Select
            value={categoryId || ALL_CATEGORIES}
            onValueChange={(v) =>
              setParam("category", v === ALL_CATEGORIES ? "" : v)
            }
          >
            <SelectTrigger className="w-auto min-w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>{t.categoryLabel}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ToggleChip
            label={t.featuredLabel}
            active={featured}
            onToggle={(on) => setParam("featured", on ? "1" : "")}
          />
          <ToggleChip
            label={t.lowStockLabel}
            active={lowStock}
            onToggle={(on) => setParam("lowStock", on ? "1" : "")}
          />

          {hasFilters ? (
            <button
              type="button"
              onClick={clearAll}
              className="ml-auto rounded-lg px-3 py-2 text-sm font-medium text-mute transition-colors hover:text-ink"
            >
              {t.clear}
            </button>
          ) : null}
        </motion.div>
      </motion.div>
    </MotionConfig>
  );
}

/** One segment of the status filter — the ink-fill active chip / quiet inactive
 *  chip with a count. Writes its status to the URL on click (no form submit). */
function StatusChip({
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
      <span
        className={`text-xs tabular-nums ${active ? "text-bg/65" : "text-mute/65"}`}
      >
        {count}
      </span>
    </button>
  );
}

/** Compact on/off filter pill. A visually-hidden native checkbox carries the
 *  state (keeps the editor's a11y lint happy and stays keyboard-accessible);
 *  the label is the chip surface. */
function ToggleChip({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <label
      className={`inline-flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 focus-within:ring-2 focus-within:ring-accent/40 ${
        active ? "bg-ink text-bg" : "text-mute hover:text-ink"
      }`}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={active}
        onChange={(e) => onToggle(e.target.checked)}
      />
      {label}
    </label>
  );
}
