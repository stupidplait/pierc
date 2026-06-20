"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  motion,
  MotionConfig,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/shadcn/ui/button";
import { ru } from "@/lib/i18n/ru";
import { pluralRu } from "@/lib/i18n/plural";
import type { WeekData } from "@/lib/admin/slots-view";
import { SlotsProvider } from "./context";
import { PlannerDrawer, type QuickAddPrefill } from "./PlannerDrawer";
import { CalendarGrid } from "./views/CalendarGrid";
import { SLOT_STATUS_STYLES, slotStatusLabel } from "./status";
import { AnimatedNumber } from "@/components/admin/form/AnimatedNumber";
import { WordReveal } from "@/components/motion/WordReveal";

interface DrawerState {
  open: boolean;
  prefill?: QuickAddPrefill;
}

// Shared expo-out easing — matches the site's house Reveal / services entrance.
const EASE = [0.16, 1, 0.3, 1] as const;

// Page entry — a staggered "blur-out" reveal: each block lifts and sharpens out
// of a soft blur, so the slots manager resolves into focus on mount (the same
// blur-focus entrance the services + catalog pages use).
const pageContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.18 } },
};
const blurItem: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(10px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.55, ease: EASE },
  },
};
// Reduced motion: keep a quick fade only. MotionConfig strips the transform, but
// the blur filter isn't transform-based, so we drop it here explicitly.
const blurItemReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
};

/**
 * Slots manager — the client shell around the calendar. Owns the creation
 * drawer and the per-cell quick-add bridge. Day/week navigation lives inline in
 * the calendar's date-header row; "Сегодня" sits in the slim bar above it,
 * opposite the status legend.
 */
export function SlotsManager({ week }: { week: WeekData }) {
  const t = ru.admin.slots;
  const m = t.manager;

  // Blur-out entry for the surrounding blocks; WordReveal owns the title/lead.
  const reduced = useReducedMotion();
  const item = reduced ? blurItemReduced : blurItem;

  const [drawer, setDrawer] = useState<DrawerState>({ open: false });
  const closeDrawer = useCallback(
    () => setDrawer((d) => ({ ...d, open: false })),
    [],
  );
  const requestQuickAdd = useCallback(
    (date: string, start?: string) =>
      setDrawer({ open: true, prefill: { date, start } }),
    [],
  );
  const ctx = useMemo(() => ({ requestQuickAdd }), [requestQuickAdd]);

  // Navigate weeks/days without a loading flash: a transition-wrapped router
  // push keeps the current week on screen until the new one streams in (Next
  // skips the route's loading.tsx fallback for transition navigations).
  const router = useRouter();
  const [, startNav] = useTransition();
  const navigate = useCallback(
    (dateKey: string | null) => {
      startNav(() => {
        router.push(dateKey ? `/admin/slots?date=${dateKey}` : "/admin/slots", {
          scroll: false,
        });
      });
    },
    [router],
  );

  return (
    <SlotsProvider value={ctx}>
      <MotionConfig reducedMotion="user">
        <motion.div variants={pageContainer} initial="hidden" animate="show">
          {/* Header — title + lead word-reveal on the left, blur-in actions on
              the right. The header itself is a plain layout wrapper so its blur
              never washes over the per-word title reveal. */}
          <header className="mb-6 flex flex-col gap-4 pt-2 sm:flex-row sm:items-end sm:justify-between sm:pt-4">
            <div>
              <WordReveal
                as="h1"
                text={t.title}
                splitBy="char"
                stagger={0.05}
                delay={0.05}
                className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl"
              />
              <WordReveal
                as="p"
                text={t.lead}
                stagger={0.04}
                delay={0.35}
                className="mt-3 text-base text-mute"
              />
            </div>
            <motion.div
              variants={item}
              initial="hidden"
              animate="show"
              className="flex shrink-0 items-center gap-2"
            >
              <Button className="gap-2" onClick={() => setDrawer({ open: true })}>
                <CalendarPlus className="size-4" />
                {m.planner}
              </Button>
            </motion.div>
          </header>

          {/* Slim bar — "today" reset, with the status legend. */}
          <motion.div
            variants={item}
            className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
          >
            <button
              type="button"
              onClick={() => navigate(null)}
              className="inline-flex h-8 items-center rounded-lg border border-line bg-card px-3 text-sm font-medium text-mute transition-colors hover:border-ink/30 hover:text-ink active:scale-[0.97]"
            >
              {m.today}
            </button>
            <Legend week={week} />
          </motion.div>

          <motion.div variants={item}>
            <CalendarGrid week={week} onNavigate={navigate} />
          </motion.div>
        </motion.div>
      </MotionConfig>

      <PlannerDrawer
        open={drawer.open}
        onClose={closeDrawer}
        prefill={drawer.prefill}
        todayKey={week.todayKey}
      />
    </SlotsProvider>
  );
}

/**
 * Compact status legend with weekly counts. Nested under the slim-bar reveal as
 * its own stagger group: the total count and each status pill fade-rise in
 * sequence, so the hint assembles left-to-right after the bar settles. The
 * y-offset is stripped under reduced motion by the page's MotionConfig — only
 * the opacity fade (and its stagger) remains.
 */
const legendGroup: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.12 } },
};
const legendPill: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

function Legend({ week }: { week: WeekData }) {
  const { counts } = week;
  const t = ru.admin.slots;
  return (
    <motion.div
      variants={legendGroup}
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm"
    >
      <motion.span variants={legendPill} className="text-mute">
        <AnimatedNumber
          value={counts.all}
          countOnMount
          className="font-medium tabular-nums text-ink"
        />{" "}
        {pluralRu(counts.all, t.windows)}
      </motion.span>
      {(["free", "booked", "closed"] as const).map((s) => (
        <motion.span
          key={s}
          variants={legendPill}
          className="flex items-center gap-1.5 text-mute"
        >
          <span className={`size-1.5 rounded-full ${SLOT_STATUS_STYLES[s].dot}`} />
          <AnimatedNumber
            value={counts[s]}
            countOnMount
            className="font-medium tabular-nums text-ink"
          />{" "}
          {slotStatusLabel(s).toLowerCase()}
        </motion.span>
      ))}
    </motion.div>
  );
}
