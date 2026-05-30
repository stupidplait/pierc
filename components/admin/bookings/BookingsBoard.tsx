"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
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
import { ru } from "@/lib/i18n/ru";
import { CARD } from "@/components/admin/form/styles";
import { Input } from "@/components/shadcn/ui/input";
import { BookingStatusBadge } from "@/components/admin/StatusBadges";
import { ArrowIcon } from "@/components/admin/dashboard/icons";

export type BookingStatus = "RESERVED" | "CONFIRMED" | "FULFILLED" | "CANCELLED";

// Pre-formatted, serializable shape the server page hands down — date, price and
// phone are formatted server-side so this stays a pure presentation layer.
export interface BookingRow {
  id: string;
  status: BookingStatus;
  jewelryName: string;
  /** Material line shown under the piece name. */
  material: string;
  price: string;
  clientName: string;
  /** "email · телефон", already joined. */
  clientContact: string;
  createdAt: string;
}

const STATUSES: BookingStatus[] = [
  "RESERVED",
  "CONFIRMED",
  "FULFILLED",
  "CANCELLED",
];

// Search trails the keystrokes by this long before it writes to the URL, so
// typing doesn't fire a navigation per character (mirrors the catalog filters).
const SEARCH_DEBOUNCE_MS = 300;

// Same blur-focus stagger as the settings cards / dashboard, so the board
// resolves with the house timing rather than popping in.
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
 * Bookings board — a segmented status filter + search over a single elevated
 * list card, built from the Steel Atelier vocabulary the redesigned settings
 * page uses (elevated `CARD` surface, ink/accent chips, hairline dividers) so
 * the screen reads as one of the same family.
 *
 * Every control writes the active filters straight to the URL search params via
 * `router.replace` inside a transition (search debounced, the rest immediate),
 * so the list stays a server query — no client list state to keep in sync.
 */
export function BookingsBoard({
  rows,
  status,
  query,
  counts,
  total,
}: {
  rows: BookingRow[];
  status: BookingStatus | "";
  query: string;
  counts: Record<BookingStatus, number>;
  total: number;
}) {
  const t = ru.admin.bookings;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Snappy local mirror of the search box; the URL trails it by the debounce.
  // When `query` changes from outside our own typing (Clear, browser
  // back/forward), re-sync during render — the documented React way to adjust
  // state to a prop without an effect.
  const [search, setSearch] = useState(query);
  const [syncedQuery, setSyncedQuery] = useState(query);
  if (query !== syncedQuery) {
    setSyncedQuery(query);
    setSearch(query);
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

  const filtered = Boolean(query || status);

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-6"
      >
        {/* ── Status filter + search ───────────────────────────────── */}
        <motion.div
          variants={item}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-line bg-card p-1">
            <FilterChip
              label={t.statusAny}
              count={total}
              active={status === ""}
              onSelect={() => setParam("status", "")}
            />
            {STATUSES.map((s) => (
              <FilterChip
                key={s}
                label={ru.admin.statusLabels.booking[s]}
                count={counts[s]}
                active={status === s}
                onSelect={() => setParam("status", s)}
              />
            ))}
          </div>

          <div className="relative w-full sm:w-64">
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
        </motion.div>

        {/* ── List ──────────────────────────────────────────────────── */}
        <motion.div variants={item} className={`${CARD} overflow-hidden`}>
          {rows.length === 0 ? (
            <p className="px-6 py-16 text-center text-sm text-mute">
              {filtered ? t.emptyFiltered : t.empty}
            </p>
          ) : (
            <ul className="divide-y divide-line/70">
              {rows.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/admin/bookings/${b.id}`}
                    className="group flex flex-col gap-2 px-5 py-4 transition-colors duration-150 hover:bg-ink/3 sm:flex-row sm:items-center sm:gap-5 sm:px-6"
                  >
                    <BookingStatusBadge status={b.status} />

                    {/* Piece */}
                    <span className="min-w-0 sm:flex-[1.3]">
                      <span className="block truncate text-sm font-medium text-ink">
                        {b.jewelryName}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-mute">
                        {b.material}
                      </span>
                    </span>

                    {/* Client */}
                    <span className="min-w-0 sm:flex-[1.5]">
                      <span className="block truncate text-sm text-ink">
                        {b.clientName}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-mute">
                        {b.clientContact}
                      </span>
                    </span>

                    {/* Price + created — inline on mobile, stacked & right on desktop */}
                    <span className="flex items-baseline gap-2 sm:shrink-0 sm:flex-col sm:items-end sm:gap-0.5">
                      <span className="text-sm font-medium text-ink tabular-nums">
                        {b.price}
                      </span>
                      <span className="text-xs text-mute tabular-nums">
                        {b.createdAt}
                      </span>
                    </span>

                    <ArrowIcon className="hidden shrink-0 text-mute/0 transition-colors duration-150 group-hover:text-mute sm:block" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </motion.div>
    </MotionConfig>
  );
}

/** One segment of the status filter — active reads as the ink fill, the rest
 *  stay quiet with a tabular count badge that lights up on the active chip.
 *  Writes its status straight to the URL on click (no form submit). */
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
      <span
        className={`text-xs tabular-nums ${active ? "text-bg/65" : "text-mute/65"}`}
      >
        {count}
      </span>
    </button>
  );
}
