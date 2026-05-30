"use client";

import { useActionState, useState } from "react";
import {
  transitionAppointment,
  saveAppointmentNotes,
  type AppointmentActionState,
} from "@/lib/admin/appointment-actions";
import { ru } from "@/lib/i18n/ru";
import { Button } from "@/components/shadcn/ui/button";
import { Switch } from "@/components/shadcn/ui/switch";
import { Label } from "@/components/shadcn/ui/label";
import { Textarea } from "@/components/shadcn/ui/textarea";
import { Separator } from "@/components/shadcn/ui/separator";

type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

interface Props {
  appointmentId: string;
  status: AppointmentStatus;
  initialNotes: string | null;
}

const SECTION_HEADING =
  "mb-3 text-xs font-medium uppercase tracking-[0.2em] text-mute";

export function AppointmentTransitionForm({
  appointmentId,
  status,
  initialNotes,
}: Props) {
  const [transitionState, transitionAction, transitionPending] = useActionState<
    AppointmentActionState,
    FormData
  >(transitionAppointment, undefined);

  const [notesState, notesAction, notesPending] = useActionState<
    AppointmentActionState,
    FormData
  >(saveAppointmentNotes, undefined);

  // Cancel cascades (frees the slot, cancels linked bookings, restores stock),
  // so it's gated behind a one-click inline confirm rather than firing instantly.
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const t = ru.admin.appointments.detail;
  const closed =
    status === "CANCELLED" || status === "COMPLETED" || status === "NO_SHOW";

  return (
    <div className="flex flex-col gap-6">
      {/* ── Status & transition actions ───────────────────────────── */}
      <section>
        <h3 className={SECTION_HEADING}>{t.statusHeading}</h3>

        {closed ? (
          <p className="text-sm text-mute">
            {ru.admin.statusLabels.appointment[status]}.
          </p>
        ) : (
          <form action={transitionAction} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={appointmentId} />

            <div className="flex items-center gap-3">
              <Switch id="notify" name="notify" defaultChecked />
              <Label htmlFor="notify" className="text-sm text-ink">
                {t.notify}
              </Label>
            </div>

            {confirmingCancel ? (
              <div className="flex flex-col gap-2.5 rounded-xl border border-error/30 bg-error/5 p-3.5">
                <p className="text-sm font-medium text-ink">
                  {t.cancelConfirm.prompt}
                </p>
                <p className="text-xs leading-relaxed text-mute">
                  {t.cancelConfirm.hint}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    name="action"
                    value="cancel"
                    variant="destructive"
                    disabled={transitionPending}
                  >
                    {transitionPending ? "…" : t.cancelConfirm.confirm}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setConfirmingCancel(false)}
                    disabled={transitionPending}
                  >
                    {t.cancelConfirm.back}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {status === "PENDING" ? (
                  <Button
                    type="submit"
                    name="action"
                    value="confirm"
                    disabled={transitionPending}
                  >
                    {transitionPending ? "…" : t.confirm}
                  </Button>
                ) : null}
                {status === "CONFIRMED" ? (
                  <>
                    <Button
                      type="submit"
                      name="action"
                      value="complete"
                      disabled={transitionPending}
                    >
                      {transitionPending ? "…" : t.complete}
                    </Button>
                    <Button
                      type="submit"
                      name="action"
                      value="no_show"
                      variant="outline"
                      disabled={transitionPending}
                    >
                      {t.noShow}
                    </Button>
                  </>
                ) : null}
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setConfirmingCancel(true)}
                  disabled={transitionPending}
                >
                  {t.cancel}
                </Button>
              </div>
            )}

            {status === "CONFIRMED" ? (
              <p className="text-xs leading-relaxed text-mute">
                {t.cascadeNotice}
              </p>
            ) : null}

            <FeedbackLine state={transitionState} />
          </form>
        )}
      </section>

      <Separator />

      {/* ── Admin notes ───────────────────────────────────────────── */}
      <section>
        <h3 className={SECTION_HEADING}>{t.notesHeading}</h3>
        <form action={notesAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={appointmentId} />
          <Textarea
            name="notes"
            defaultValue={initialNotes ?? ""}
            placeholder={t.notesPlaceholder}
            rows={4}
            autoComplete="off"
          />
          <div>
            <Button type="submit" variant="outline" disabled={notesPending}>
              {notesPending ? "…" : t.notesSave}
            </Button>
          </div>
          <FeedbackLine state={notesState} />
        </form>
      </section>
    </div>
  );
}

function FeedbackLine({ state }: { state: AppointmentActionState }) {
  if (!state) return null;
  return (
    <p className={`text-xs ${state.ok ? "text-success" : "text-error"}`}>
      {state.ok ? state.message : state.error}
    </p>
  );
}
