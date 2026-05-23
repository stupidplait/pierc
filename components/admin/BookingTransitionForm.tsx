"use client";

import { useActionState } from "react";
import {
  transitionBooking,
  saveBookingNotes,
  type BookingActionState,
} from "@/lib/admin/booking-actions";
import { ru } from "@/lib/i18n/ru";

type BookingStatus = "RESERVED" | "CONFIRMED" | "FULFILLED" | "CANCELLED";

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

  return (
    <div className="flex flex-col gap-8">
      {/* в”Ђв”Ђ Status & transition buttons в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */}
      <section>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-mute">
          {t.statusHeading}
        </h3>

        {closed ? (
          <p className="text-sm text-mute">
            {ru.admin.statusLabels.booking[status]}.
          </p>
        ) : (
          <form action={transitionAction} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={bookingId} />

            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="notify"
                defaultChecked
                className="size-4 rounded border-line text-primary focus:ring-primary"
              />
              <span>{t.notify}</span>
            </label>

            <div className="flex flex-wrap gap-2">
              {status === "RESERVED" ? (
                <ActionButton
                  name="action"
                  value="confirm"
                  pending={transitionPending}
                  variant="primary"
                >
                  {t.confirm}
                </ActionButton>
              ) : null}
              {status === "CONFIRMED" ? (
                <ActionButton
                  name="action"
                  value="fulfill"
                  pending={transitionPending}
                  variant="primary"
                >
                  {t.fulfill}
                </ActionButton>
              ) : null}
              <ActionButton
                name="action"
                value="cancel"
                pending={transitionPending}
                variant="ghost"
              >
                {t.cancel}
              </ActionButton>
            </div>

            <FeedbackLine state={transitionState} />
          </form>
        )}
      </section>

      {/* в”Ђв”Ђ Notes в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */}
      <section>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-mute">
          {t.notesHeading}
        </h3>
        <form action={notesAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={bookingId} />
          <textarea
            name="notes"
            defaultValue={initialNotes ?? ""}
            placeholder={t.notesPlaceholder}
            rows={4}
            autoComplete="off"
            className="w-full rounded-xl border border-line bg-page px-4 py-3 text-sm text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
          />
          <div>
            <button
              type="submit"
              disabled={notesPending}
              className="inline-flex h-10 items-center rounded-full border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-primary disabled:opacity-60"
            >
              {notesPending ? "вЂ¦" : t.notesSave}
            </button>
          </div>
          <FeedbackLine state={notesState} />
        </form>
      </section>
    </div>
  );
}

function ActionButton({
  name,
  value,
  pending,
  variant,
  children,
}: {
  name: string;
  value: string;
  pending: boolean;
  variant: "primary" | "ghost";
  children: React.ReactNode;
}) {
  const base =
    "inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-colors disabled:opacity-50";
  const tone =
    variant === "primary"
      ? "bg-primary text-on-primary hover:bg-primary-soft"
      : "border border-line text-mute hover:border-primary hover:text-primary";
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`${base} ${tone}`}
    >
      {pending ? "вЂ¦" : children}
    </button>
  );
}

function FeedbackLine({ state }: { state: BookingActionState }) {
  if (!state) return null;
  return (
    <p
      className={`text-xs ${state.ok ? "text-mute" : "text-error"}`}
    >
      {state.ok ? state.message : state.error}
    </p>
  );
}
