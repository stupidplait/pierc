"use client";

import { useActionState, useEffect, useState } from "react";
import {
  AnimatePresence,
  LazyMotion,
  domMax,
  m,
  MotionConfig,
  type Variants,
} from "framer-motion";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import {
  ENTRANCE_DURATION,
  ENTRANCE_HIDDEN,
  ENTRANCE_SHOW,
  ENTRANCE_STAGGER,
  REVEAL_EASE,
} from "@/components/motion/entrance";
import { Toaster } from "@/components/admin/toast/Toaster";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/shadcn/ui/card";
import { Button } from "@/components/shadcn/ui/button";
import { updateSettings, type ActionState } from "@/lib/admin/content-actions";
import {
  parseSettingsFormData,
  settingsFieldErrors,
  firstSettingsError,
  SETTINGS_FIELD_ORDER,
  SETTINGS_VALIDATION_SUMMARY,
  type SettingsFieldErrors,
} from "@/lib/admin/settings-schema";
import { ru } from "@/lib/i18n/ru";
import { SETTINGS_SECTIONS, type SettingsLike, type FieldName } from "./model";
import { SettingsField } from "./fields";
import { SaveButton } from "./SaveButton";

const t = ru.admin.settings;
const FORM_ID = "admin-settings-form";

const MotionCard = m.create(Card);

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

function buildValues(s: SettingsLike): Record<FieldName, string> {
  return {
    contactEmail: s.contactEmail ?? "",
    contactPhone: s.contactPhone ?? "",
    contactAddress: s.contactAddress ?? "",
    instagramUrl: s.instagramUrl ?? "",
    telegramUrl: s.telegramUrl ?? "",
    telegramChatId: s.telegramChatId ?? "",
    workingHoursHint: s.workingHoursHint ?? "",
  };
}

export function SettingsWorkspace({ initial }: { initial: SettingsLike }) {
  const [savedValues, setSavedValues] = useState(() => buildValues(initial));
  const [values, setValues] = useState(() => buildValues(initial));
  // Per-field remount counter. Bumping a field's nonce (only on discard, only
  // for fields that changed) remounts that one input so it re-reads the
  // baseline, and triggers its reset fade-in below.
  const [fieldNonce, setFieldNonce] = useState<Partial<Record<FieldName, number>>>(
    {},
  );
  const [cleared, setCleared] = useState<Set<FieldName>>(() => new Set());

  // Derived during render (no effect): the form is dirty when any current value
  // differs from the last persisted baseline. Saving advances the baseline;
  // discarding rewinds the values to it.
  const dirty = SETTINGS_FIELD_ORDER.some(
    (name) => values[name] !== savedValues[name],
  );

  const focusFirstError = (errors: SettingsFieldErrors) => {
    const first = firstSettingsError(errors);
    if (first) document.getElementById(`settings-${first}`)?.focus();
  };

  const validatedAction = async (
    _prev: ActionState,
    formData: FormData,
  ): Promise<ActionState> => {
    setCleared(new Set());
    const parsed = parseSettingsFormData(formData);
    if (!parsed.success) {
      const fieldErrors = settingsFieldErrors(parsed.error);
      focusFirstError(fieldErrors);
      toast.error(SETTINGS_VALIDATION_SUMMARY);
      return { ok: false, error: SETTINGS_VALIDATION_SUMMARY, fieldErrors };
    }
    const result = await updateSettings(_prev, formData);
    if (result?.ok) {
      toast.success(result.message ?? ru.admin.common.saved);
      setSavedValues(values);
    } else if (result) {
      toast.error(result.error || ru.admin.common.saveError);
      if (!result.ok && result.fieldErrors) focusFirstError(result.fieldErrors);
    }
    return result;
  };

  const [state, action, pending] = useActionState<ActionState, FormData>(
    validatedAction,
    undefined,
  );

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const errorFor = (name: FieldName) =>
    fieldErrors && !cleared.has(name) ? fieldErrors[name] : undefined;

  const setFieldValue = (name: FieldName, value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
    setCleared((prev) => {
      if (prev.has(name)) return prev;
      const next = new Set(prev);
      next.add(name);
      return next;
    });
  };

  const discard = () => {
    // Only the fields that actually changed get a fresh nonce, so just those
    // inputs remount (snapping the uncontrolled text/phone fields and the
    // prefixed URL fields back to the baseline) and fade in, while untouched
    // fields stay put without a flicker. Stale validation errors are hidden.
    const changed = SETTINGS_FIELD_ORDER.filter(
      (name) => values[name] !== savedValues[name],
    );
    setValues(savedValues);
    setCleared(new Set<FieldName>(SETTINGS_FIELD_ORDER));
    setFieldNonce((prev) => {
      const next = { ...prev };
      for (const name of changed) next[name] = (next[name] ?? 0) + 1;
      return next;
    });
  };

  return (
    <LazyMotion features={domMax}>
      <MotionConfig reducedMotion="user">
        <div className="flex w-full flex-col gap-6">
          <form id={FORM_ID} action={action} noValidate>
            <m.div
              variants={container}
              initial="hidden"
              animate="show"
              className="flex flex-col gap-6"
            >
              {SETTINGS_SECTIONS.map((section) => {
                const headingId = `settings-${section.key}-heading`;
                return (
                  <MotionCard
                    key={section.key}
                    variants={item}
                    role="group"
                    aria-labelledby={headingId}
                  >
                    <CardHeader>
                      <h2
                        id={headingId}
                        className="font-display text-lg font-medium tracking-tight text-ink"
                      >
                        {section.heading}
                      </h2>
                      <CardDescription>{section.lead}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {/* grid-cols-1 (= minmax(0,1fr)) is required at the base:
                          without it the implicit mobile column is auto/max-content
                          and the prefixed-URL field forces it ~370px wide → page
                          overflow < sm. The explicit track clamps it + lets the
                          input shrink. */}
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        {section.fields.map((field) => {
                          const nonce = fieldNonce[field.name] ?? 0;
                          return (
                            <m.div
                              key={`${field.name}-${nonce}`}
                              className={field.full ? "sm:col-span-2" : undefined}
                              // Animate only the reset (nonce > 0); on first paint
                              // the card's own entrance covers the fields.
                              initial={
                                nonce > 0
                                  ? { opacity: 0, filter: "blur(4px)" }
                                  : false
                              }
                              animate={{ opacity: 1, filter: "blur(0px)" }}
                              transition={{ duration: 0.22, ease: REVEAL_EASE }}
                            >
                              <SettingsField
                                field={field}
                                value={values[field.name]}
                                error={errorFor(field.name)}
                                onValueChange={(v) => setFieldValue(field.name, v)}
                              />
                            </m.div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </MotionCard>
                );
              })}

              <div className="sticky bottom-4 z-20 mt-1">
                <m.div
                  initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: ENTRANCE_DURATION, ease: REVEAL_EASE, delay: 0.32 }}
                >
                  <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-card px-5 py-3.5 shadow-elev">
                    <SaveButton
                      pending={pending}
                      disabled={pending || !dirty}
                      label={t.save}
                      pendingLabel={t.saving}
                    />
                    {/* Hidden while saving (popLayout) so the Save button's
                        width-morph doesn't shove it sideways — you can't discard
                        mid-save anyway. */}
                    <AnimatePresence initial={false} mode="popLayout">
                      {dirty && !pending ? (
                        <m.div
                          key="discard"
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -8 }}
                          transition={{ duration: 0.2, ease: REVEAL_EASE }}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={discard}
                            disabled={pending}
                            className="whitespace-nowrap"
                          >
                            <RotateCcw className="size-4" aria-hidden />
                            {t.discard}
                          </Button>
                        </m.div>
                      ) : null}
                    </AnimatePresence>
                    <span className="ml-auto hidden text-xs text-mute sm:block">
                      {t.saveHint}
                    </span>
                  </div>
                </m.div>
              </div>
            </m.div>
          </form>
        </div>

        <Toaster />
      </MotionConfig>
    </LazyMotion>
  );
}
