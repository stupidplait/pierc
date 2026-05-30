"use client";

import { motion, MotionConfig, type Variants } from "framer-motion";
import {
  ENTRANCE_DURATION,
  ENTRANCE_HIDDEN,
  ENTRANCE_SHOW,
  ENTRANCE_STAGGER,
  REVEAL_EASE,
} from "@/components/services/entrance/config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/ui/card";
import { Button } from "@/components/shadcn/ui/button";
import { StickyTocRail, type TocItem } from "@/components/about/client/StickyTocRail";
import { InlineStatus } from "@/components/admin/form/atelier";
import { NotificationTestButton } from "@/components/admin/NotificationTestButton";
import { ru } from "@/lib/i18n/ru";
import { SETTINGS_SECTIONS, type SettingsLike } from "./model";
import { SettingsField, useSettingsAction } from "./fields";

const t = ru.admin.settings;
const FORM_ID = "admin-settings-form";

// Stagger the editor cards in on mount; the rail and the notifications card run
// their own entrance, so the page settles as one set.
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
 * Settings workspace — a magazine-style two-column shell: a sticky scroll-spy
 * rail of section anchors on the left (the same dossier index the /about page
 * uses), the editor on the right as a stack of elevated shadcn cards. The
 * contact/social/integration groups post as one form behind a sticky save bar
 * that floats at the foot of the viewport while you edit; the notifications
 * self-test rides below as its own diagnostic card (its own form — HTML forms
 * can't nest), reachable from the same rail instead of a separate tab.
 */
export function SettingsWorkspace({ initial }: { initial: SettingsLike }) {
  const [state, action, pending] = useSettingsAction();

  const nav: TocItem[] = [
    ...SETTINGS_SECTIONS.map((s) => ({ id: s.key, label: s.heading })),
    { id: "notifications", label: t.notificationsHeading },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <div className="lg:grid lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-12">
        {/* ── Sticky section rail (lg+) ──────────────────────────────── */}
        <div className="hidden lg:block">
          <div className="sticky top-8">
            <StickyTocRail items={nav} eyebrow={t.navEyebrow} />
          </div>
        </div>

        {/* ── Editor column ─────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* Contact / social / integration groups — one form, one save. The
              form stays a plain element so React's form-action handling is
              untouched; the orchestration rides on the inner motion wrapper. */}
          <form id={FORM_ID} action={action}>
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="flex flex-col gap-6"
            >
              {SETTINGS_SECTIONS.map((section) => (
                <motion.div key={section.key} variants={item}>
                  <Card id={section.key} className="scroll-mt-24">
                    <CardHeader>
                      <CardTitle>{section.heading}</CardTitle>
                      <CardDescription>{section.lead}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-5 sm:grid-cols-2">
                      {section.fields.map((field) => (
                        <SettingsField
                          key={field.name}
                          field={field}
                          value={initial[field.name]}
                        />
                      ))}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}

              {/* Sticky save bar — floats at the foot of the viewport while the
                  form is on screen, settles once you scroll past it. Plain (not
                  a motion child) so its `position: sticky` is pristine from
                  first paint. */}
              <div className="sticky bottom-4 z-20 mt-1">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-card/85 px-5 py-3.5 shadow-[0_1px_2px_rgba(8,8,8,0.5),0_12px_30px_-12px_rgba(8,8,8,0.7)] backdrop-blur-xl">
                  <Button type="submit" disabled={pending} className="px-6">
                    {pending ? "…" : t.save}
                  </Button>
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
            transition={{
              duration: ENTRANCE_DURATION,
              ease: REVEAL_EASE,
              delay: 0.28,
            }}
          >
            <Card id="notifications" className="scroll-mt-24">
              <CardHeader>
                <CardTitle>{t.notificationsHeading}</CardTitle>
                <CardDescription>{t.notificationsLead}</CardDescription>
              </CardHeader>
              <CardContent>
                <NotificationTestButton />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </MotionConfig>
  );
}
