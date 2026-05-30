"use client";

import { useActionState } from "react";
import {
  transitionBooking,
  saveBookingNotes,
  type BookingActionState,
} from "@/lib/admin/booking-actions";
import { ru } from "@/lib/i18n/ru";
import { Button } from "@/components/shadcn/ui/button";
import { Switch } from "@/components/shadcn/ui/switch";
import { Textarea } from "@/components/shadcn/ui/textarea";
import { Label } from "@/components/shadcn/ui/label";

type BookingStatus = "RESERVED" | "CONFIRMED" | "FULFILLED" | "CANCELLED";

// Small-caps section label shared with the dossier card next to this form.
const SECTION_LABEL =
  "text-xs font-medium uppercase tracking-[0.2em] text-mute";

interface Props {
  bookingId: string;
  status: BookingStatus;
  initialNotes: string | null;
}

export function BookingTransitionForm({
  bookingId,
  status,
  initialNotes,
}: Props) {
  const [transitionState, transitionAction, transitionPending] = useActionState<
    BookingActionState,
    FormData
  >(transitionBooking, undefined);

  const [notesState, notesAction, notesPending] = useActionState<
    BookingActionState,
    FormData
  >(saveBookingNotes, undefined);

  const t = ru.admin.bookings.detail;
  const closed = status === "CANCELLED" || status === "FULFILLED";
  const notifyId = `notify-${bookingId}`;

  return (
    <div className="flex flex-col gap-8">
      {/* ── Status & transition actions ───────────────────────────── */}
      <section>
        <h3 className={SECTION_LABEL}>{t.statusHeading}</h3>

        {closed ? (
          <p className="mt-3 text-sm text-mute">
            {ru.admin.statusLabels.booking[status]}.
          </p>
        ) : (
          <form action={transitionAction} className="mt-4 flex flex-col gap-4">
            <input type="hidden" name="id" value={bookingId} />

            <div className="flex items-center gap-3">
              {/* Radix Switch posts `notify=on` when checked — exactly what the
                  server action's `v === "on"` preprocess expects. */}
              <Switch id={notifyId} name="notify" defaultChecked />
              <Label htmlFor={notifyId} className="text-sm text-ink">
                {t.notify}
              </Label>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {status === "RESERVED" ? (
                <Button type="submit" name="action" value="confirm" disabled={transitionPending}>
                  {transitionPending ? "…" : t.confirm}
                </Button>
              ) : null}
              {status === "CONFIRMED" ? (
                <Button type="submit" name="action" value="fulfill" disabled={transitionPending}>
                  {transitionPending ? "…" : t.fulfill}
                </Button>
              ) : null}
              <Button
                type="submit"
                name="action"
                value="cancel"
                variant="outline"
                disabled={transitionPending}
                className="hover:border-error/50 hover:text-error"
              >
                {transitionPending ? "…" : t.cancel}
              </Button>
            </div>

            <FeedbackLine state={transitionState} />
          </form>
        )}
      </section>

      {/* ── Admin notes ───────────────────────────────────────────── */}
      <section>
        <h3 className={SECTION_LABEL}>{t.notesHeading}</h3>
        <form action={notesAction} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="id" value={bookingId} />
          <Textarea
            name="notes"
            defaultValue={initialNotes ?? ""}
            placeholder={t.notesPlaceholder}
            rows={5}
            autoComplete="off"
          />
          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" variant="outline" disabled={notesPending}>
              {notesPending ? "…" : t.notesSave}
            </Button>
            <FeedbackLine state={notesState} />
          </div>
        </form>
      </section>
    </div>
  );
}

function FeedbackLine({ state }: { state: BookingActionState }) {
  if (!state) return null;
  if (state.ok) {
    return (
      <p role="status" aria-live="polite" className="text-sm text-success">
        {state.message}
      </p>
    );
  }
  return (
    <p role="alert" aria-live="assertive" className="text-sm text-error">
      {state.error}
    </p>
  );
}
