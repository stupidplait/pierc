import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import {
  type BookingPurpose,
  nextStep,
  previousStep,
  serializeBookingParams,
} from "@/lib/booking/url-state";

interface SlotStepProps {
  purpose: BookingPurpose;
  itemIds: string[];
  selectedSlotId: string | null;
}

const RU_DATE = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const RU_TIME = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

export async function SlotStep({
  purpose,
  itemIds,
  selectedSlotId,
}: SlotStepProps) {
  // Open slots in the future that aren't already booked.
  const slots = await prisma.availabilitySlot.findMany({
    where: {
      isOpen: true,
      startsAt: { gte: new Date() },
      appointment: null,
    },
    orderBy: { startsAt: "asc" },
    take: 100,
  });

  const t = ru.pages.book.slotStep;
  const back = previousStep("slot", purpose);
  const next = nextStep("slot", purpose);

  // Group by yyyy-mm-dd.
  const grouped = new Map<string, typeof slots>();
  for (const s of slots) {
    const key = s.startsAt.toISOString().slice(0, 10);
    const arr = grouped.get(key) ?? [];
    arr.push(s);
    grouped.set(key, arr);
  }

  return (
    <form method="get" action="/book" className="flex flex-col gap-6">
      <input type="hidden" name="step" value={next ?? "contact"} />
      <input type="hidden" name="purpose" value={purpose} />
      {itemIds.length > 0 ? (
        <input type="hidden" name="items" value={itemIds.join(",")} />
      ) : null}

      <header>
        <h2 className="font-display text-2xl font-medium text-ink">
          {t.heading}
        </h2>
        <p className="mt-1 text-mute">{t.lead}</p>
      </header>

      {grouped.size === 0 ? (
        <p className="text-mute">{t.empty}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {[...grouped.entries()].map(([date, list]) => (
            <fieldset key={date} className="flex flex-col gap-2">
              <legend className="text-xs uppercase tracking-[0.15em] text-mute">
                {RU_DATE.format(new Date(date))}
              </legend>
              <div className="flex flex-wrap gap-2">
                {list.map((s) => {
                  const checked = selectedSlotId === s.id;
                  return (
                    <label
                      key={s.id}
                      className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                        checked
                          ? "border-primary bg-primary text-on-primary"
                          : "border-line text-ink hover:border-primary"
                      }`}
                    >
                      <input
                        type="radio"
                        name="slot"
                        value={s.id}
                        defaultChecked={checked}
                        className="sr-only"
                      />
                      {RU_TIME.format(s.startsAt)} – {RU_TIME.format(s.endsAt)}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-line pt-5">
        {back ? (
          <Link
            href={`/book?${serializeBookingParams({
              step: back,
              purpose,
              itemIds,
              slotId: selectedSlotId,
            })}`}
            className="text-sm text-mute hover:text-primary"
          >
            ← {ru.pages.book.nav.back}
          </Link>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={grouped.size === 0}
          className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-on-primary transition-colors hover:bg-primary-soft disabled:opacity-50"
        >
          {ru.pages.book.nav.next} →
        </button>
      </div>
    </form>
  );
}
