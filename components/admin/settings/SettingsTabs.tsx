"use client";

import { useState } from "react";
import { motion, MotionConfig } from "framer-motion";
import {
  ENTRANCE_DURATION,
  ENTRANCE_HIDDEN,
  ENTRANCE_SHOW,
  REVEAL_EASE,
} from "@/components/services/entrance/config";
import { ru } from "@/lib/i18n/ru";
import { NotificationTestButton } from "@/components/admin/NotificationTestButton";
import type { SettingsLike } from "./model";
import { SettingsCards } from "./SettingsCards";

type Tab = "primary" | "experiments";

const t = ru.admin.settings;

const SURFACE =
  "rounded-2xl border border-line bg-card shadow-[0_1px_2px_rgba(8,8,8,0.5),0_10px_28px_-10px_rgba(8,8,8,0.6)]";

const TABS: { key: Tab; label: string }[] = [
  { key: "primary", label: t.tabs.primary },
  { key: "experiments", label: t.tabs.experiments },
];

/**
 * Settings shell — a segmented tab bar splitting the stable business config
 * ("Основные": contacts, social, integrations, notifications) from
 * experimental feature toggles ("Эксперименты"), so beta switches stay
 * quarantined from settings the studio relies on day to day.
 */
export function SettingsTabs({ initial }: { initial: SettingsLike }) {
  const [tab, setTab] = useState<Tab>("primary");

  return (
    <div className="flex flex-col gap-8">
      <div
        aria-label={t.title}
        className="inline-flex w-fit rounded-xl border border-line bg-card p-1"
      >
        {TABS.map((it) => {
          const active = it.key === tab;
          return (
            <button
              key={it.key}
              type="button"
              aria-current={active ? "true" : undefined}
              onClick={() => setTab(it.key)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                active ? "bg-ink text-bg" : "text-mute hover:text-ink"
              }`}
            >
              {it.label}
            </button>
          );
        })}
      </div>

      {tab === "primary" ? (
        <SettingsCards initial={initial} />
      ) : (
        <NotificationsCard />
      )}
    </div>
  );
}

// The notifications self-test, packaged as a card. Lives under "Эксперименты"
// as the baseline diagnostic; real feature flags will join it here later.
// Blur-focuses in on mount with the same vocabulary as the Основные cards, so
// switching tabs plays the same entrance.
function NotificationsCard() {
  return (
    <MotionConfig reducedMotion="user">
      <motion.section
        initial={ENTRANCE_HIDDEN}
        animate={ENTRANCE_SHOW}
        transition={{ duration: ENTRANCE_DURATION, ease: REVEAL_EASE, delay: 0.05 }}
        className={`${SURFACE} p-7 sm:p-9`}
      >
        <div className="mb-7">
          <h2 className="font-display text-xl font-medium tracking-tight text-ink">
            {t.notificationsHeading}
          </h2>
          <p className="mt-1 max-w-prose text-sm text-mute">
            {t.notificationsLead}
          </p>
        </div>
        <NotificationTestButton />
      </motion.section>
    </MotionConfig>
  );
}
