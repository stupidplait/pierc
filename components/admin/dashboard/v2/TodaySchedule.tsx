"use client";

import Link from "next/link";
import { ru } from "@/lib/i18n/ru";
import { Panel } from "./Panel";
import { ArrowIcon } from "../icons";
import type { TodayItem } from "./types";

const t = ru.admin.dashboard;
const statusLabel = ru.admin.statusLabels.appointment;

/**
 * Today's confirmed/pending visits, time-ordered. Each row collapses gracefully
 * at 320px: the time and status chip stay fixed-size (shrink-0) while the
 * customer + service column truncates in the middle. Empty days show a calm
 * message; a footer link jumps to the full day in the appointments console.
 */
export function TodaySchedule({ items }: { items: TodayItem[] }) {
  return (
    <Panel title={t.todayHeading} count={items.length} className="lg:h-full">
      {items.length === 0 ? (
        <p className="text-sm text-mute">{t.todayEmpty}</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-ink/5">
            {items.map((it) => (
              <li key={it.id}>
                <Link
                  href={it.href}
                  className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-ink/3"
                >
                  <span className="shrink-0 font-mono text-sm tabular-nums text-ink">
                    {it.time}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {it.customer}
                    </span>
                    {it.service ? (
                      <span className="block truncate text-xs text-mute">
                        {it.service}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] text-mute">
                    {statusLabel[it.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/admin/appointments?today=1"
            className="group mt-auto inline-flex items-center gap-1.5 self-start pt-4 text-sm font-medium text-mute transition-colors duration-150 hover:text-ink"
          >
            {t.todaySeeAll}
            <ArrowIcon className="transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
        </>
      )}
    </Panel>
  );
}
