"use client";

import Link from "next/link";
import { motion, MotionConfig } from "framer-motion";
import { ru } from "@/lib/i18n/ru";
import type { Metric, QuickAction } from "./types";
import { container, item, pad, SURFACE, toneText } from "./shared";
import { ActionIcon, ArrowIcon, PingDot, WarnGlyph } from "./icons";
import { DashHeader } from "./DashHeader";
import { AnimatedNumber } from "@/components/admin/form/AnimatedNumber";

const t = ru.admin.dashboard;

/**
 * Status Board dashboard — the twin of the /account layout: a left rail of
 * quick actions and a right activity feed timeline where urgent items carry the
 * same pinging accent dot as /account's pinned next appointment. The two
 * columns stretch to a shared height. (The admin auth state lives in the
 * sidebar, not here.)
 */
export function StatusBoard({
  adminName,
  metrics,
  quickActions,
}: {
  adminName: string;
  metrics: Metric[];
  quickActions: QuickAction[];
}) {
  const urgentCount = metrics.filter((m) => m.urgent).length;

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto w-full max-w-6xl"
      >
        <DashHeader adminName={adminName} />

      <div className="grid items-stretch gap-6 lg:grid-cols-[20rem_1fr]">
        {/* ── Quick actions rail ── */}
        <motion.aside
          variants={item}
          className={`${SURFACE} flex flex-col p-7 sm:p-8`}
        >
          <div className="flex items-center justify-between border-b border-ink/10 pb-3">
            <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-mute">
              {t.quickActionsHeading}
            </h2>
            <span className="font-mono text-xs text-mute tabular-nums">
              <AnimatedNumber value={quickActions.length} countOnMount />
            </span>
          </div>
          <div className="mt-7 flex flex-col gap-2">
            {quickActions.map((a) => {
              const cls =
                "group flex w-full items-center gap-3 rounded-xl border border-line px-3.5 py-2.5 text-left text-sm font-medium text-ink transition-colors duration-150 hover:border-ink/40 hover:bg-ink/3";
              const inner = (
                <>
                  <span className="text-mute transition-colors duration-150 group-hover:text-ink">
                    <ActionIcon kind={a.kind} />
                  </span>
                  <span className="flex-1">{a.label}</span>
                  <ArrowIcon className="text-mute/0 transition-colors duration-150 group-hover:text-mute" />
                </>
              );
              // Mutation quick-actions POST via a server action (a draft create
              // can't be a prefetched GET link); navigational ones stay as Links.
              return a.action ? (
                <form key={a.label} action={a.action}>
                  <button type="submit" className={cls}>
                    {inner}
                  </button>
                </form>
              ) : (
                <Link key={a.href} href={a.href!} className={cls}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </motion.aside>

        {/* ── Activity feed timeline ── */}
        <motion.div variants={item} className={`${SURFACE} p-7 sm:p-8`}>
          <div className="flex items-center justify-between border-b border-ink/10 pb-3">
            <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-mute">
              {t.activityHeading}
            </h2>
            <span className="font-mono text-xs text-mute tabular-nums">
              <AnimatedNumber value={urgentCount} countOnMount />
            </span>
          </div>

          <ul className="relative mt-7 ml-1 flex flex-col gap-2 border-l border-ink/10 pl-7">
            {metrics.map((m) => (
              <li key={m.key} className="relative">
                <span
                  aria-hidden
                  className="absolute -left-8.25 top-1/2 flex size-2 -translate-y-1/2 items-center justify-center"
                >
                  {m.urgent ? (
                    m.tone === "warn" ? (
                      <WarnGlyph />
                    ) : (
                      <PingDot />
                    )
                  ) : (
                    <span className="size-2 rounded-full bg-mute" />
                  )}
                </span>
                <Link
                  href={m.href}
                  className="group -mx-3 flex items-center gap-4 rounded-xl px-3 py-3 transition-colors duration-150 hover:bg-ink/3"
                >
                  <AnimatedNumber
                    value={m.count}
                    format={pad}
                    countOnMount
                    className={`font-display text-3xl font-medium tabular-nums ${toneText(m.tone)}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-ink">
                      {m.titleShort}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-mute">
                      {m.lead}
                    </span>
                  </span>
                  <ArrowIcon className="shrink-0 text-mute transition-colors duration-150 group-hover:text-ink" />
                </Link>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
      </motion.div>
    </MotionConfig>
  );
}
