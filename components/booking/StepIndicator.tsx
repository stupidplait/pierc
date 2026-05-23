import {
  type BookingPurpose,
  type BookingStep,
  BOOKING_STEP_ORDER,
} from "@/lib/booking/url-state";
import { ru } from "@/lib/i18n/ru";

interface StepIndicatorProps {
  step: BookingStep;
  purpose: BookingPurpose | null;
}

export function StepIndicator({ step, purpose }: StepIndicatorProps) {
  // Hide steps that don't apply to the current purpose.
  const visible = BOOKING_STEP_ORDER.filter((s) => {
    if (purpose === "appointment" && s === "jewelry") return false;
    if (purpose === "jewelry" && s === "slot") return false;
    return true;
  });
  const current = visible.indexOf(step) + 1;
  const total = visible.length;

  const labels: Record<BookingStep, string> = {
    purpose: ru.pages.book.steps.purposeLabel,
    jewelry: ru.pages.book.steps.jewelryLabel,
    slot: ru.pages.book.steps.slotLabel,
    contact: ru.pages.book.steps.contactLabel,
  };

  return (
    <div className="mb-8 flex flex-col gap-3">
      <p className="text-xs uppercase tracking-[0.2em] text-mute">
        {ru.pages.book.stepProgress
          .replace("{current}", String(current))
          .replace("{total}", String(total))}
      </p>
      <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {visible.map((s, i) => {
          const active = s === step;
          return (
            <li
              key={s}
              className={`flex items-center gap-2 ${active ? "text-primary" : "text-mute"}`}
            >
              <span
                className={`flex size-6 items-center justify-center rounded-full border text-xs ${
                  active
                    ? "border-primary bg-primary text-on-primary"
                    : "border-line text-mute"
                }`}
              >
                {i + 1}
              </span>
              <span className={active ? "font-medium" : ""}>{labels[s]}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
