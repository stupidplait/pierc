"use client";

import Link from "next/link";
import Image from "next/image";
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
import { JewelryStatusBadge } from "@/components/admin/StatusBadges";
import { StockAdjuster } from "@/components/admin/StockAdjuster";
import type { JewelryStatus } from "./JewelryFilters";

// Pre-formatted, serializable shape the server page hands down — price is
// formatted server-side so this stays a pure presentation layer.
export interface JewelryRow {
  id: string;
  name: string;
  status: JewelryStatus;
  featured: boolean;
  photo: string | null;
  price: string;
  categoryName: string;
  material: string;
  anchorCount: number;
  inStock: number;
}

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
 * Catalog board — the jewelry list as a single elevated `CARD` with hairline
 * dividers, mirroring the bookings / reviews boards. Each row links to the
 * editor; the StockAdjuster sits outside that link so its +/- buttons don't
 * trigger navigation.
 */
export function JewelryBoard({ rows }: { rows: JewelryRow[] }) {
  const t = ru.admin.jewelry;

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className={`${CARD} overflow-hidden`}
      >
        {rows.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-mute">{t.empty}</p>
        ) : (
          <ul className="divide-y divide-line/70">
            {rows.map((j) => (
              <motion.li
                key={j.id}
                variants={item}
                className="group flex items-center gap-4 px-4 py-3 transition-colors duration-150 hover:bg-ink/[0.03] sm:px-5"
              >
                <Link
                  href={`/admin/jewelry/${j.id}/edit`}
                  className="flex min-w-0 flex-1 items-center gap-4"
                >
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-bg">
                    {j.photo ? (
                      <Image
                        src={j.photo}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-ink">
                        {j.name}
                      </span>
                      {j.featured ? (
                        <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent">
                          ★
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-mute">
                      {j.categoryName} · {j.material} · {j.anchorCount} якор(ей)
                    </span>
                  </span>
                  <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                    <span className="text-sm font-medium text-ink tabular-nums">
                      {j.price}
                    </span>
                    <JewelryStatusBadge status={j.status} />
                  </span>
                </Link>
                <span className="shrink-0">
                  <StockAdjuster jewelryId={j.id} stock={j.inStock} />
                </span>
              </motion.li>
            ))}
          </ul>
        )}
      </motion.div>
    </MotionConfig>
  );
}
