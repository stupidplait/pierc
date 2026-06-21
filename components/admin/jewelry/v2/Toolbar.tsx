"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PackageMinus, RotateCcw, Search, Star, X } from "lucide-react";
import { ru } from "@/lib/i18n/ru";
import { CARD } from "@/components/admin/form/styles";
import { Input } from "@/components/shadcn/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/shadcn/ui/tooltip";
import { CategoryMultiSelect } from "../CategoryMultiSelect";

// Search waits this long after the last keystroke before pushing to the URL.
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Catalog toolbar (v2) — fully responsive. At 320px the search field takes its
 * own full-width row, then the controls cluster (category · featured · low-stock
 * · reset) sits on a second row, with the category combobox flexing to fill and
 * the icon chips + reset pinned to the right. From sm up it collapses to the
 * familiar single wrapping row (search grows, controls trail to the right).
 *
 * Presentational: the parent owns the filter→URL navigation; search is the one
 * piece of local state (a snappy mirror of `q`, debounced before the URL, and
 * re-synced when `q` changes from outside our own typing).
 */
export function Toolbar({
  q,
  categoryIds,
  featured,
  lowStock,
  categories,
  hasFilters,
  setParam,
  setMulti,
  clearAll,
}: {
  q: string;
  categoryIds: string[];
  featured: boolean;
  lowStock: boolean;
  categories: { id: string; name: string }[];
  hasFilters: boolean;
  setParam: (key: string, value: string) => void;
  setMulti: (key: string, values: string[]) => void;
  clearAll: () => void;
}) {
  const t = ru.admin.jewelry;

  const [search, setSearch] = useState(q);
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    setSearch(q);
  }

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

  const clearSearch = useCallback(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearch("");
    setParam("q", "");
  }, [setParam]);

  const handleReset = useCallback(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearch("");
    clearAll();
  }, [clearAll]);

  return (
    <TooltipProvider delayDuration={250}>
      <motion.div
        initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={`${CARD} flex flex-col gap-2.5 p-2.5 sm:flex-row sm:flex-wrap sm:items-center`}
      >
        {/* Search — full width at 320, grows inline from sm. */}
        <div className="relative w-full sm:min-w-48 sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute/60" />
          <Input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchLabel}
            className="pl-9 pr-9 [&::-webkit-search-cancel-button]:appearance-none"
          />
          <AnimatePresence>
            {search ? (
              <motion.button
                key="clear-search"
                type="button"
                onClick={clearSearch}
                aria-label={t.clear}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="absolute right-2.5 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-mute transition-colors hover:bg-ink/8 hover:text-ink"
              >
                <X className="size-3.5" />
              </motion.button>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Controls cluster — its own row at 320 (category fills, chips + reset
            trail right); flows inline from sm. */}
        <div className="flex items-center gap-2.5">
          <CategoryMultiSelect
            categories={categories}
            selected={categoryIds}
            onChange={(ids) => setMulti("category", ids)}
            wrapperClassName="min-w-0 flex-1 sm:flex-none"
            triggerClassName="w-full min-w-0 sm:w-auto sm:min-w-40"
          />

          <IconToggleChip
            label={t.featuredLabel}
            hint={t.featuredHint}
            icon={Star}
            active={featured}
            onToggle={(on) => setParam("featured", on ? "1" : "")}
          />
          <IconToggleChip
            label={t.lowStockLabel}
            hint={t.lowStockHint}
            icon={PackageMinus}
            active={lowStock}
            onToggle={(on) => setParam("lowStock", on ? "1" : "")}
          />

          <span className="h-6 w-px shrink-0 bg-line" aria-hidden="true" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleReset}
                disabled={!hasFilters}
                aria-label={t.clear}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-ink/15 bg-ink/3 text-mute transition-colors hover:border-ink/35 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
              >
                <RotateCcw className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t.clear}</TooltipContent>
          </Tooltip>
        </div>
      </motion.div>
    </TooltipProvider>
  );
}

/**
 * Quick-filter chip — icon-only square that fills with ink when active. A
 * visually-hidden native checkbox carries the state (keyboard-accessible, clear
 * of the strict a11y lint) and names the control; the tooltip surfaces the label
 * + what the filter does.
 */
function IconToggleChip({
  label,
  hint,
  icon: Icon,
  active,
  onToggle,
}: {
  label: string;
  hint: string;
  icon: typeof Star;
  active: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <label
          className={`inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition-colors duration-150 has-focus-visible:ring-2 has-focus-visible:ring-ink/30 ${
            active
              ? "border-ink bg-ink text-bg"
              : "border-ink/15 bg-ink/3 text-mute hover:border-ink/35 hover:text-ink"
          }`}
        >
          <input
            type="checkbox"
            className="sr-only"
            checked={active}
            onChange={(e) => onToggle(e.target.checked)}
            aria-label={label}
          />
          <Icon className="size-4" aria-hidden="true" />
        </label>
      </TooltipTrigger>
      <TooltipContent>
        <span className="block font-medium text-ink">{label}</span>
        <span className="mt-0.5 block text-mute">{hint}</span>
      </TooltipContent>
    </Tooltip>
  );
}
