import { ru } from "@/lib/i18n/ru";
import type { BookingStatus } from "@/lib/admin/bookings-view";

// The happy-path lifecycle. CANCELLED is an off-path terminal state and gets a
// distinct banner instead of a position on the rail.
const STEPS = [
  { key: "RESERVED", label: ru.admin.statusLabels.booking.RESERVED },
  { key: "CONFIRMED", label: ru.admin.statusLabels.booking.CONFIRMED },
  { key: "FULFILLED", label: ru.admin.statusLabels.booking.FULFILLED },
] as const;

/**
 * Compact lifecycle stepper for the booking dossier — makes the
 * RESERVED → CONFIRMED → FULFILLED progression legible at a glance. The twin of
 * AppointmentStatusStepper. Server component (status-derived, no state).
 */
export function BookingStatusStepper({ status }: { status: BookingStatus }) {
  if (status === "CANCELLED") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-mute/40 bg-card px-3.5 py-2.5 text-sm font-medium text-mute">
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
        {ru.admin.statusLabels.booking.CANCELLED}
      </div>
    );
  }

  const activeIndex =
    status === "RESERVED" ? 0 : status === "CONFIRMED" ? 1 : 2;

  return (
    <ol className="flex items-center">
      {STEPS.map((step, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <li key={step.key} className="flex flex-1 items-center last:flex-none">
            <span className="flex items-center gap-1.5">
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium ${
                  active
                    ? "border-accent bg-accent text-bg"
                    : done
                      ? "border-success/50 bg-success-soft text-success"
                      : "border-line text-mute/60"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={`whitespace-nowrap text-xs ${
                  active ? "text-ink" : done ? "text-mute" : "text-mute/50"
                }`}
              >
                {step.label}
              </span>
            </span>
            {i < STEPS.length - 1 ? (
              <span
                aria-hidden
                className={`mx-2 h-px flex-1 ${
                  i < activeIndex ? "bg-success/40" : "bg-line"
                }`}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
