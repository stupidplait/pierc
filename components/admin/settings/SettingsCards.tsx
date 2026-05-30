"use client";

import { motion, MotionConfig, type Variants } from "framer-motion";
import {
  ENTRANCE_DURATION,
  ENTRANCE_HIDDEN,
  ENTRANCE_SHOW,
  ENTRANCE_STAGGER,
  REVEAL_EASE,
} from "@/components/services/entrance/config";
import { SETTINGS_SECTIONS, type SettingsLike } from "./model";
import { SaveBar, SettingsField, useSettingsAction } from "./fields";

// Same elevated panel + layered shadow the /account and services cards use, so
// each settings group reads as one of the same set.
const SURFACE =
  "rounded-2xl border border-line bg-card shadow-[0_1px_2px_rgba(8,8,8,0.5),0_10px_28px_-10px_rgba(8,8,8,0.6)]";

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
 * Variant A — "Stacked Atelier cards". Each settings group is an elevated card
 * carrying a display heading + supporting lead, blur-focusing in on mount with
 * the same choreography as the /services grid. The shared card vocabulary is
 * what pulls it in line with /faq, /about and /account.
 *
 * The optional `footer` (the notifications self-test) renders *outside* the
 * editor <form> — it carries its own form, and HTML forms can't nest — but it
 * still arrives a beat after the cards so the page reads as one set.
 */
export function SettingsCards({
  initial,
  footer,
}: {
  initial: SettingsLike;
  footer?: React.ReactNode;
}) {
  const [state, action, pending] = useSettingsAction();

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col gap-6">
        <form action={action}>
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-6"
          >
            {SETTINGS_SECTIONS.map((section) => (
              <motion.section
                key={section.key}
                variants={item}
                className={`${SURFACE} p-7 sm:p-9`}
              >
                <div className="mb-7">
                  <h2 className="font-display text-xl font-medium tracking-tight text-ink">
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
              </motion.section>
            ))}

            <motion.div variants={item}>
              <SaveBar state={state} pending={pending} className="pt-1" />
            </motion.div>
          </motion.div>
        </form>

        {footer ? (
          <motion.div
            initial={ENTRANCE_HIDDEN}
            animate={ENTRANCE_SHOW}
            transition={{ duration: ENTRANCE_DURATION, ease: REVEAL_EASE, delay: 0.3 }}
          >
            {footer}
          </motion.div>
        ) : null}
      </div>
    </MotionConfig>
  );
}
