"use client";

import { useActionState } from "react";
import {
  transitionBooking,
  saveBookingNotes,
  type BookingActionState,
} from "@/lib/admin/booking-actions";
import { ru } from "@/lib/i18n/ru";
import { FIELD_AREA, GHOST_DELETE, SUBMIT } from "@/components/admin/form/styles";

type BookingStatus = "RESERVED" | "CONFIRMED" | "FULFILLED" | "CANCELLED";

// Small-caps section label shared with the dossier card next to this form.
const SECTION_LABEL =
  "text-xs font-medium uppercase tracking-[0.2em] text-mute";

// Neutral secondary button — the notes save, kept quieter than the ink action
// pills so it doesn't compete with the status transition.
const GHOST_NEUTRAL =
  "inline-flex h-11 items-center justify-center rounded-xl border border-ink/15 px-5 text-sm font-medium text-ink transition-colors duration-150 hover:border-ink/40 hover:bg-ink/[0.03] active:scale-[0.98] disabled:opacity-50";

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

            <NotifyToggle />

            <div className="flex flex-wrap gap-2.5">
              {status === "RESERVED" ? (
                <ActionButton
                  value="confirm"
                  pending={transitionPending}
                  variant="primary"
                >
                  {t.confirm}
                </ActionButton>
              ) : null}
              {status === "CONFIRMED" ? (
                <ActionButton
                  value="fulfill"
                  pending={transitionPending}
                  variant="primary"
                >
                  {t.fulfill}
                </ActionButton>
              ) : null}
              <ActionButton
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

      {/* ── Admin notes ───────────────────────────────────────────── */}
      <section>
        <h3 className={SECTION_LABEL}>{t.notesHeading}</h3>
        <form action={notesAction} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="id" value={bookingId} />
          <textarea
            name="notes"
            defaultValue={initialNotes ?? ""}
            placeholder={t.notesPlaceholder}
            rows={5}
            autoComplete="off"
            className={FIELD_AREA}
          />
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={notesPending}
              className={GHOST_NEUTRAL}
            >
              {notesPending ? "…" : t.notesSave}
            </button>
            <FeedbackLine state={notesState} />
          </div>
        </form>
      </section>
    </div>
  );
}

/** Accent pill switch — the same toggle the Steel Atelier form kit uses. */
function NotifyToggle() {
  return (
    <label className="flex items-center gap-3">
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          name="notify"
          defaultChecked
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-ink/15 transition-colors duration-150 peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card" />
        <span className="pointer-events-none absolute left-0.5 top-0.5 size-5 rounded-full bg-ink shadow-sm transition-transform duration-150 peer-checked:translate-x-5 peer-checked:bg-bg" />
      </span>
      <span className="text-sm text-ink">{ru.admin.bookings.detail.notify}</span>
    </label>
  );
}

function ActionButton({
  value,
  pending,
  variant,
  children,
}: {
  value: string;
  pending: boolean;
  variant: "primary" | "ghost";
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      name="action"
      value={value}
      disabled={pending}
      className={variant === "primary" ? SUBMIT : GHOST_DELETE}
    >
      {pending ? "…" : children}
    </button>
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
