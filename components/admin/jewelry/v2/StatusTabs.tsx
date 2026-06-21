"use client";

import { motion, MotionConfig, type Variants } from "framer-motion";
import { REVEAL_EASE } from "@/components/motion/entrance";
import { jewelryStatusLabels, ru } from "@/lib/i18n/ru";
import { AnimatedNumber } from "@/components/admin/form/AnimatedNumber";
import type { JewelryStatus } from "../types";

const STATUSES: JewelryStatus[] = [
  "DRAFT",
  "PROCESSING",
  "PENDING_REVIEW",
  "PUBLISHED",
  "REJECTED",
];

// Per-status dot colour — echoes the row status badges so tabs + list read as
// one system (REJECTED is red in both).
const DOT: Record<JewelryStatus, string> = {
  DRAFT: "bg-mute/50",
  PROCESSING: "bg-primary",
  PENDING_REVIEW: "bg-warn",
  PUBLISHED: "bg-success",
  REJECTED: "bg-error",
};

// Mobile: a single horizontally-scrollable row (no wrap, hidden scrollbar) so
// the six tabs never stack into bulky rows at 320px. From sm up they wrap.
const STRIP =
  "flex items-center gap-1 overflow-x-auto border-b border-line/70 px-2 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:gap-0.5 sm:overflow-visible sm:px-3";

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
  animateIn?: boolean;
}

/**
 * Status tabs docked to the top edge of the board card. The active tab fills with
 * a soft ink wash (overflow-safe — no negative-offset underline that a scroll
 * container would clip) and keeps its colour cue via the status dot. On first
 * paint the chips stagger in; afterwards they render at rest so a filter change
 * never re-cascades the strip.
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
      dot: undefined,
      onSelect: () => onSelect(""),
    },
    ...STATUSES.map((s) => ({
      key: s,
      label: jewelryStatusLabels[s],
      count: counts[s],
      active: status === s,
      dot: DOT[s],
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
          <motion.div key={tab.key} variants={chip} className="shrink-0">
            <TabChip
              label={tab.label}
              count={tab.count}
              active={tab.active}
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
  dot,
  countOnMount,
  onSelect,
}: {
  label: string;
  count: number;
  active: boolean;
  dot?: string;
  countOnMount: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={active ? "true" : undefined}
      onClick={onSelect}
      className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
        active ? "bg-ink/10 text-ink" : "text-mute hover:bg-ink/5 hover:text-ink"
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
    </button>
  );
}
