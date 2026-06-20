"use client";

import { motion, MotionConfig, type Variants } from "framer-motion";
import { REVEAL_EASE } from "@/components/motion/entrance";
import { jewelryStatusLabels, ru } from "@/lib/i18n/ru";
import { AnimatedNumber } from "@/components/admin/form/AnimatedNumber";
import type { JewelryStatus } from "./JewelryFilters";

const STATUSES: JewelryStatus[] = [
  "DRAFT",
  "PROCESSING",
  "PENDING_REVIEW",
  "PUBLISHED",
  "REJECTED",
];

// Per-status colour. `dot` = the resting colour cue; `bar` = the active-tab
// underline. Echoes the row status badges (StatusBadges.tsx) so the tabs and the
// list read as one system — REJECTED is red in both.
const TINT: Record<JewelryStatus, { dot: string; bar: string }> = {
  DRAFT: { dot: "bg-mute/50", bar: "bg-mute/60" },
  PROCESSING: { dot: "bg-primary", bar: "bg-primary" },
  PENDING_REVIEW: { dot: "bg-warn", bar: "bg-warn" },
  PUBLISHED: { dot: "bg-success", bar: "bg-success" },
  REJECTED: { dot: "bg-error", bar: "bg-error" },
};

const STRIP =
  "flex flex-wrap items-center gap-0.5 border-b border-line/70 px-2 py-1.5 sm:px-3";

// First-paint cascade for the chips: they tick in left-to-right just after the
// card has risen, so the strip assembles itself rather than snapping in whole.
// `delayChildren` lets the card's blur-rise lead; the stagger stays tight so the
// whole strip is settled before the eye reaches the list below.
const strip: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.14 } },
};

const chip: Variants = {
  hidden: { opacity: 0, y: -4, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.4, ease: REVEAL_EASE },
  },
};

interface StatusTabsProps {
  status: JewelryStatus | "";
  counts: Record<JewelryStatus, number>;
  total: number;
  onSelect: (status: JewelryStatus | "") => void;
  // True only on the genuine first paint — drives the chip stagger. Filter
  // updates pass false so re-clicking a tab doesn't re-cascade the strip.
  animateIn?: boolean;
}

/**
 * Status tabs docked to the top edge of the board card — selecting one scopes
 * the list to that status. Each tab carries its count and (when active) a
 * colour underline keyed to the status, tying the filter to the row badges.
 *
 * On first paint the chips stagger in (see `strip`/`chip`); afterwards
 * `initial={false}` renders them at rest with no animation, so the strip never
 * re-cascades on a filter change and never remounts mid-stagger.
 */
export function StatusTabs({
  status,
  counts,
  total,
  onSelect,
  animateIn = true,
}: StatusTabsProps) {
  const t = ru.admin.jewelry;
  const tabs = [
    {
      key: "",
      label: t.statusAny,
      count: total,
      active: status === "",
      bar: "bg-ink",
      dot: undefined,
      onSelect: () => onSelect(""),
    },
    ...STATUSES.map((s) => ({
      key: s,
      label: jewelryStatusLabels[s],
      count: counts[s],
      active: status === s,
      bar: TINT[s].bar,
      dot: TINT[s].dot,
      onSelect: () => onSelect(s),
    })),
  ];

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        variants={strip}
        initial={animateIn ? "hidden" : false}
        animate="show"
        className={STRIP}
      >
        {tabs.map((tab) => (
          <motion.div key={tab.key} variants={chip}>
            <TabChip
              label={tab.label}
              count={tab.count}
              active={tab.active}
              bar={tab.bar}
              dot={tab.dot}
              countOnMount={animateIn}
              onSelect={tab.onSelect}
            />
          </motion.div>
        ))}
      </motion.div>
    </MotionConfig>
  );
}

function TabChip({
  label,
  count,
  active,
  bar,
  dot,
  countOnMount,
  onSelect,
}: {
  label: string;
  count: number;
  active: boolean;
  bar: string;
  dot?: string;
  countOnMount: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={active ? "true" : undefined}
      onClick={onSelect}
      className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
        active ? "text-ink" : "text-mute hover:bg-ink/5 hover:text-ink"
      }`}
    >
      {dot ? (
        <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
      ) : null}
      <span>{label}</span>
      <AnimatedNumber
        value={count}
        countOnMount={countOnMount}
        className="text-xs tabular-nums opacity-65"
      />
      {active ? (
        <span
          className={`absolute inset-x-2.5 -bottom-1.5 h-0.5 rounded-full ${bar}`}
          aria-hidden="true"
        />
      ) : null}
    </button>
  );
}
