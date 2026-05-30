"use client";

import { useActionState } from "react";
import {
  transitionAppointment,
  saveAppointmentNotes,
  type AppointmentActionState,
} from "@/lib/admin/appointment-actions";
import { ru } from "@/lib/i18n/ru";
import { FIELD_AREA } from "@/components/admin/form/styles";

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

// Steel Atelier action pills — ink fill for the forward step, hairline ghost for
// the quieter ones, hairline-warming-to-error for the destructive cancel.
const PILL =
  "inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-medium transition-colors duration-150 active:scale-[0.98] disabled:opacity-50";
const PRIMARY = "bg-ink text-bg hover:bg-ink/90";
const GHOST =
  "border border-ink/15 text-mute hover:border-ink/30 hover:text-ink";
const DANGER =
  "border border-ink/15 text-mute hover:border-error/50 hover:text-error";

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

  const t = ru.admin.appointments.detail;
  const closed =
    status === "CANCELLED" || status === "COMPLETED" || status === "NO_SHOW";

  return (
    <div className="flex flex-col gap-8">
      {/* ── Status & transition buttons ───────────────────────────── */}
      <section>
        <h3 className={SECTION_HEADING}>{t.statusHeading}</h3>

        {closed ? (
          <p className="text-sm text-mute">
            {ru.admin.statusLabels.appointment[status]}.
          </p>
        ) : (
          <form action={transitionAction} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={appointmentId} />

            <label className="flex items-center gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                name="notify"
                defaultChecked
                className="size-4 rounded border-ink/25 bg-ink/3 text-accent focus:ring-accent/40"
              />
              <span>{t.notify}</span>
            </label>

            <div className="flex flex-wrap gap-2">
              {status === "PENDING" ? (
                <ActionButton
                  value="confirm"
                  pending={transitionPending}
                  variant="primary"
                >
                  {t.confirm}
                </ActionButton>
              ) : null}
              {status === "CONFIRMED" ? (
                <>
                  <ActionButton
                    value="complete"
                    pending={transitionPending}
                    variant="primary"
                  >
                    {t.complete}
                  </ActionButton>
                  <ActionButton
                    value="no_show"
                    pending={transitionPending}
                    variant="ghost"
                  >
                    {t.noShow}
                  </ActionButton>
                </>
              ) : null}
              <ActionButton
                value="cancel"
                pending={transitionPending}
                variant="danger"
              >
                {t.cancel}
              </ActionButton>
            </div>

            {status === "CONFIRMED" ? (
              <p className="text-xs leading-relaxed text-mute">
                {t.cascadeNotice}
              </p>
            ) : null}

            <FeedbackLine state={transitionState} />
          </form>
        )}
      </section>

      <div className="h-px bg-line/60" />

      {/* ── Admin notes ───────────────────────────────────────────── */}
      <section>
        <h3 className={SECTION_HEADING}>{t.notesHeading}</h3>
        <form action={notesAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={appointmentId} />
          <textarea
            name="notes"
            defaultValue={initialNotes ?? ""}
            placeholder={t.notesPlaceholder}
            rows={4}
            autoComplete="off"
            className={FIELD_AREA}
          />
          <div>
            <button
              type="submit"
              disabled={notesPending}
              className={`${PILL} ${GHOST}`}
            >
              {notesPending ? "…" : t.notesSave}
            </button>
          </div>
          <FeedbackLine state={notesState} />
        </form>
      </section>
    </div>
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
  variant: "primary" | "ghost" | "danger";
  children: React.ReactNode;
}) {
  const tone =
    variant === "primary" ? PRIMARY : variant === "danger" ? DANGER : GHOST;
  return (
    <button
      type="submit"
      name="action"
      value={value}
      disabled={pending}
      className={`${PILL} ${tone}`}
    >
      {pending ? "…" : children}
    </button>
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
