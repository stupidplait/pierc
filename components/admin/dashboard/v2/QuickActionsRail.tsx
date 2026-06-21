"use client";

import Link from "next/link";
import { ru } from "@/lib/i18n/ru";
import { Panel } from "./Panel";
import { ActionIcon, ArrowIcon } from "../icons";
import type { QuickAction } from "../types";

const t = ru.admin.dashboard;

/**
 * Quick-actions rail. One column on the narrowest phones (full-width rows),
 * 2-up on small/medium where there's width to spare, then back to a single
 * column when it becomes the lg side-rail. Every row clears the 44px touch
 * target (min-h-11). All v2 quick-actions are plain navigation Links.
 */
export function QuickActionsRail({ actions }: { actions: QuickAction[] }) {
  return (
    <Panel title={t.quickActionsHeading} count={actions.length}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {actions.map((a) => (
          <Link
            key={a.href ?? a.label}
            href={a.href ?? "#"}
            className="group flex min-h-11 w-full items-center gap-3 rounded-xl border border-line px-3.5 py-2.5 text-left text-sm font-medium text-ink transition-colors duration-150 hover:border-ink/40 hover:bg-ink/3"
          >
            <span className="shrink-0 text-mute transition-colors duration-150 group-hover:text-ink">
              <ActionIcon kind={a.kind} />
            </span>
            <span className="min-w-0 flex-1 truncate">{a.label}</span>
            <ArrowIcon className="shrink-0 text-mute/0 transition-colors duration-150 group-hover:text-mute" />
          </Link>
        ))}
      </div>
    </Panel>
  );
}
