"use client";

import Link from "next/link";
import { motion, MotionConfig, type Variants } from "framer-motion";
import {
  ENTRANCE_DURATION,
  ENTRANCE_HIDDEN,
  ENTRANCE_SHOW,
  ENTRANCE_STAGGER,
  REVEAL_EASE,
} from "@/components/services/entrance/config";
import { ru } from "@/lib/i18n/ru";
import { CARD } from "@/components/admin/form/styles";
import { BookingStatusBadge } from "@/components/admin/StatusBadges";
import { ArrowIcon } from "@/components/admin/dashboard/icons";

export type BookingStatus = "RESERVED" | "CONFIRMED" | "FULFILLED" | "CANCELLED";

// Pre-formatted, serializable shape the server page hands down — date, price and
// phone are formatted server-side so this stays a pure presentation layer.
export interface BookingRow {
  id: string;
  status: BookingStatus;
  jewelryName: string;
  price: string;
  /** "Имя · email · телефон", already joined. */
  client: string;
  createdAt: string;
}

const STATUSES: BookingStatus[] = [
  "RESERVED",
  "CONFIRMED",
  "FULFILLED",
  "CANCELLED",
];

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
 * Bookings board — a segmented status filter over a single elevated list card,
 * built from the Steel Atelier vocabulary the redesigned settings page uses
 * (elevated `CARD` surface, ink/accent chips, hairline dividers) so the screen
 * reads as one of the same family instead of the old flat `bg-page` rows.
 *
 * The filter is link-driven (each chip is an `<a>` to `?status=…`) so the list
 * stays a server query — no client state to keep in sync.
 */
export function BookingsBoard({
  rows,
  status,
  counts,
  total,
}: {
  rows: BookingRow[];
  status: BookingStatus | "";
  counts: Record<BookingStatus, number>;
  total: number;
}) {
  const t = ru.admin.bookings;

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-6"
      >
        {/* ── Segmented status filter ───────────────────────────────── */}
        <motion.div variants={item}>
          <div className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-line bg-card p-1">
            <FilterChip
              href="/admin/bookings"
              label={t.statusAny}
              count={total}
              active={status === ""}
            />
            {STATUSES.map((s) => (
              <FilterChip
                key={s}
                href={`/admin/bookings?status=${s}`}
                label={ru.admin.statusLabels.booking[s]}
                count={counts[s]}
                active={status === s}
              />
            ))}
          </div>
        </motion.div>

        {/* ── List ──────────────────────────────────────────────────── */}
        <motion.div variants={item} className={`${CARD} overflow-hidden`}>
          {rows.length === 0 ? (
            <p className="px-6 py-16 text-center text-sm text-mute">{t.empty}</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {rows.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/admin/bookings/${b.id}`}
                    className="group flex items-center gap-4 px-5 py-4 transition-colors duration-150 hover:bg-ink/[0.03] sm:px-6"
                  >
                    <BookingStatusBadge status={b.status} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {b.jewelryName}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-mute">
                        {b.client}
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-right sm:block">
                      <span className="block text-sm text-ink tabular-nums">
                        {b.price}
                      </span>
                      <span className="block text-xs text-mute tabular-nums">
                        {b.createdAt}
                      </span>
                    </span>
                    <ArrowIcon className="shrink-0 text-mute/0 transition-colors duration-150 group-hover:text-mute" />
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
 *  stay quiet with a tabular count badge that lights up on the active chip. */
function FilterChip({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
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
    </Link>
  );
}
