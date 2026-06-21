"use client";

import { m } from "framer-motion";
import { container, item } from "../shared";
import type { QuickAction } from "../types";
import { DashHeaderV2 } from "./DashHeaderV2";
import { MetricGrid } from "./MetricGrid";
import { TodaySchedule } from "./TodaySchedule";
import { QuickActionsRail } from "./QuickActionsRail";
import type { MetricV2, TodayItem } from "./types";

/**
 * v2 admin dashboard — a fully responsive (320px+) command center.
 *
 * Layout: a hero header, a full-width attention-metrics strip, then a board.
 * Below lg the board is a single stacked column (Today's schedule → Quick
 * actions). At lg it splits into a wide appointments list (minmax(0,1fr)) that
 * stretches to the row's full height, and a fixed 20rem quick-actions side rail
 * that stays its natural height, top-aligned and sticky on scroll. Every grid
 * child is min-w-0 so long content can't blow out the row.
 *
 * Entrance reuses the house blur-rise container/item variants; the root
 * MotionProvider supplies LazyMotion + reducedMotion="user", so it degrades
 * statically for reduced-motion users.
 */
export function DashboardV2({
  adminName,
  metrics,
  quickActions,
  today,
}: {
  adminName: string;
  metrics: MetricV2[];
  quickActions: QuickAction[];
  today: TodayItem[];
}) {
  return (
    <m.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-6"
    >
      <DashHeaderV2 adminName={adminName} />

      <m.div variants={item}>
        <MetricGrid metrics={metrics} />
      </m.div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-stretch">
        {/* Appointments list — stretches to fill the column's full height. */}
        <m.div variants={item} className="min-w-0">
          <TodaySchedule items={today} />
        </m.div>

        {/* Quick actions — natural-height side rail, pinned on scroll. */}
        <m.div
          variants={item}
          className="min-w-0 lg:sticky lg:top-6 lg:self-start"
        >
          <QuickActionsRail actions={quickActions} />
        </m.div>
      </div>
    </m.div>
  );
}
