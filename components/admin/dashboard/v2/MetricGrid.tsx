"use client";

import Link from "next/link";
import { ru } from "@/lib/i18n/ru";
import { pad, SURFACE, toneText } from "../shared";
import { PingDot, WarnGlyph } from "../icons";
import { AnimatedNumber } from "@/components/admin/form/AnimatedNumber";
import type { MetricV2 } from "./types";

/**
 * The attention-metrics overview — four tappable stat cards. 2-up from 320px
 * (each card ~106px of inner room, enough for the padded count + a 2-line
 * label), widening to a single 4-up row at lg. Each card links to its filtered
 * list; urgent ones carry the ping (actionable) or warn (low-stock) marker.
 */
export function MetricGrid({ metrics }: { metrics: MetricV2[] }) {
  return (
    <section aria-label={ru.admin.dashboard.metricsHeading}>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {metrics.map((m) => (
          <Link
            key={m.key}
            href={m.href}
            className={`${SURFACE} group relative flex min-w-0 flex-col gap-2 p-4 transition-colors duration-150 hover:border-ink/30 sm:p-5`}
          >
            {m.urgent ? (
              <span className="absolute right-3 top-3">
                {m.tone === "warn" ? <WarnGlyph /> : <PingDot />}
              </span>
            ) : null}
            <AnimatedNumber
              value={m.count}
              format={pad}
              countOnMount
              className={`font-display text-3xl font-medium tabular-nums sm:text-4xl ${toneText(m.tone)}`}
            />
            <span className="line-clamp-2 text-xs text-mute sm:text-sm">
              {m.label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
