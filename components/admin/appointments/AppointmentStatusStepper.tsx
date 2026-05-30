import { ru } from "@/lib/i18n/ru";

type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

// The happy-path lifecycle. NO_SHOW / CANCELLED are off-path terminal states and
// get a distinct banner instead of a position on the rail.
const STEPS = [
  { key: "PENDING", label: ru.admin.statusLabels.appointment.PENDING },
  { key: "CONFIRMED", label: ru.admin.statusLabels.appointment.CONFIRMED },
  { key: "COMPLETED", label: ru.admin.statusLabels.appointment.COMPLETED },
] as const;

/**
 * Compact lifecycle stepper for the appointment detail rail — makes the
 * PENDING → CONFIRMED → COMPLETED progression legible at a glance instead of
 * relying on the lone status badge. Server component (status-derived, no state).
 */
export function AppointmentStatusStepper({
  status,
}: {
  status: AppointmentStatus;
}) {
  if (status === "CANCELLED" || status === "NO_SHOW") {
    const tone =
      status === "CANCELLED"
        ? "border-mute/40 bg-card text-mute"
        : "border-warn/40 bg-warn-soft text-warn";
    return (
      <div
        className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium ${tone}`}
      >
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
        {ru.admin.statusLabels.appointment[status]}
      </div>
    );
  }

  const activeIndex =
    status === "PENDING" ? 0 : status === "CONFIRMED" ? 1 : 2;

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
