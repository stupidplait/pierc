import Link from "next/link";
import { ru } from "@/lib/i18n/ru";

interface PurposeStepProps {
  /** Carry-over from `?items=` so deep-linked tray items survive purpose pick. */
  itemIds: string[];
}

const OPTIONS = [
  {
    value: "appointment" as const,
    title: ru.pages.book.purpose.appointment,
    lead: ru.pages.book.purpose.appointmentLead,
  },
  {
    value: "jewelry" as const,
    title: ru.pages.book.purpose.jewelry,
    lead: ru.pages.book.purpose.jewelryLead,
  },
  {
    value: "both" as const,
    title: ru.pages.book.purpose.both,
    lead: ru.pages.book.purpose.bothLead,
  },
];

export function PurposeStep({ itemIds }: PurposeStepProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {OPTIONS.map((o) => {
        // Build the next-step href per option. If items pre-filled the URL,
        // we already know the customer wants jewelry — but we still let them
        // change their mind by picking appointment-only.
        const params = new URLSearchParams();
        params.set("step", o.value === "appointment" ? "slot" : "jewelry");
        params.set("purpose", o.value);
        if (itemIds.length > 0 && o.value !== "appointment") {
          params.set("items", itemIds.join(","));
        }
        return (
          <Link
            key={o.value}
            href={`/book?${params.toString()}`}
            className="flex flex-col gap-2 rounded-2xl border border-line bg-card/40 p-6 transition-colors hover:border-primary"
          >
            <h3 className="font-display text-xl font-medium text-ink">
              {o.title}
            </h3>
            <p className="text-sm text-mute">{o.lead}</p>
          </Link>
        );
      })}
    </div>
  );
}
