"use client";

import { motion, MotionConfig, type Variants } from "framer-motion";
import {
  ENTRANCE_DURATION,
  ENTRANCE_HIDDEN,
  ENTRANCE_SHOW,
  ENTRANCE_STAGGER,
  REVEAL_EASE,
} from "@/components/services/entrance/config";
import { InlineStatus } from "@/components/admin/form/atelier";
import { NotificationTestButton } from "@/components/admin/NotificationTestButton";
import { ru } from "@/lib/i18n/ru";
import { SETTINGS_SECTIONS, type SettingsLike } from "./model";
import { SettingsField, useSettingsAction } from "./fields";

const t = ru.admin.settings;
const FORM_ID = "admin-settings-form";

// Stagger the section cards in on mount; the notifications card runs its own
// entrance just after, so the page settles as one set.
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
 * Settings workspace — a clean single column of elevated section cards. The
 * contact / social / integration groups post as one form behind a sticky save
 * bar that floats at the foot of the viewport while you edit; the notifications
 * self-test rides below as its own diagnostic card (its own form — HTML forms
 * can't nest).
 */
export function SettingsWorkspace({ initial }: { initial: SettingsLike }) {
  const [state, action, pending] = useSettingsAction();

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {/* Contact / social / integration groups — one form, one save. */}
        <form id={FORM_ID} action={action}>
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-6"
          >
            {SETTINGS_SECTIONS.map((section) => (
              <motion.div
                key={section.key}
                variants={item}
                className="rounded-2xl border border-line bg-card p-6 shadow-[0_1px_2px_rgba(8,8,8,0.5),0_10px_28px_-10px_rgba(8,8,8,0.6)]"
              >
                <div className="mb-5">
                  <h2 className="font-display text-lg font-medium tracking-tight text-ink">
                    {section.heading}
                  </h2>
                  <p className="mt-1 text-sm text-mute">{section.lead}</p>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  {section.fields.map((field) => (
                    <SettingsField
                      key={field.name}
                      field={field}
                      value={initial[field.name]}
                    />
                  ))}
                </div>
              </motion.div>
            ))}

            {/* Sticky save bar — plain element (not a motion child) so its
                `position: sticky` is pristine from first paint. */}
            <div className="sticky bottom-4 z-20 mt-1">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-card/85 px-5 py-3.5 shadow-[0_1px_2px_rgba(8,8,8,0.5),0_12px_30px_-12px_rgba(8,8,8,0.7)] backdrop-blur-xl">
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-ink px-6 text-sm font-medium text-bg transition-colors duration-150 hover:bg-ink/90 active:scale-[0.98] disabled:opacity-50"
                >
                  {pending ? "…" : t.save}
                </button>
                <InlineStatus state={state} />
                <span className="ml-auto hidden text-xs text-mute sm:block">
                  {t.saveHint}
                </span>
              </div>
            </div>
          </motion.div>
        </form>

        {/* Notifications self-test — own form, sibling of the editor form. */}
        <motion.div
          initial={ENTRANCE_HIDDEN}
          animate={ENTRANCE_SHOW}
          transition={{ duration: ENTRANCE_DURATION, ease: REVEAL_EASE, delay: 0.28 }}
          className="rounded-2xl border border-line bg-card p-6 shadow-[0_1px_2px_rgba(8,8,8,0.5),0_10px_28px_-10px_rgba(8,8,8,0.6)]"
        >
          <h2 className="font-display text-lg font-medium tracking-tight text-ink">
            {t.notificationsHeading}
          </h2>
          <p className="mt-1 mb-4 max-w-prose text-sm text-mute">
            {t.notificationsLead}
          </p>
          <NotificationTestButton />
        </motion.div>
      </div>
    </MotionConfig>
  );
}
