import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { pluralRu } from "@/lib/i18n/plural";
import { PageHeader } from "@/components/ui/PageHeader";
import { Reveal } from "@/components/admin/form/atelier";
import { CARD } from "@/components/admin/form/styles";
import { SlotForm } from "@/components/admin/SlotForm";
import { BulkSlotForm } from "@/components/admin/BulkSlotForm";
import { ConfirmDeleteButton } from "@/components/admin/ConfirmDeleteButton";
import { deleteSlot, toggleSlotOpen } from "@/lib/admin/slot-actions";

export const metadata: Metadata = {
  title: `${ru.admin.slots.title} — ${ru.admin.panel}`,
};

const RU_DATE = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const RU_TIME = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

const t = ru.admin.slots;

// Compact ghost buttons sized for the list rows — same hairline-border / ink
// hover vocabulary as the Steel Atelier form kit, just shorter than the h-11
// pills used inside the cards.
const ROW_TOGGLE =
  "inline-flex h-9 items-center justify-center rounded-lg border border-ink/15 px-3.5 text-xs font-medium text-mute transition-colors hover:border-ink/40 hover:text-ink active:scale-[0.98]";
const ROW_DELETE =
  "inline-flex h-9 items-center justify-center rounded-lg border border-ink/15 px-3.5 text-xs font-medium text-mute transition-colors hover:border-error/50 hover:text-error active:scale-[0.98]";

const PILL =
  "inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-medium";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function AdminSlotsPage() {
  const slots = await prisma.availabilitySlot.findMany({
    where: { startsAt: { gte: startOfToday() } },
    orderBy: { startsAt: "asc" },
    include: {
      appointment: {
        select: { id: true, status: true },
      },
    },
  });

  // Group by yyyy-mm-dd for the headings.
  const grouped = new Map<string, typeof slots>();
  for (const s of slots) {
    const key = s.startsAt.toISOString().slice(0, 10);
    const arr = grouped.get(key) ?? [];
    arr.push(s);
    grouped.set(key, arr);
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader title={t.title} lead={t.lead} />

      <div className="flex flex-col gap-6">
        {/* Bulk create — primary path for monthly planning. */}
        <BulkSlotForm delay={0} />

        {/* Single create — collapsed; for one-off tweaks. */}
        <SlotForm delay={0.05} />

        {/* Schedule list */}
        <section className="mt-4 flex flex-col gap-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-medium tracking-tight text-ink">
              {t.scheduleHeading}
            </h2>
            {slots.length > 0 ? (
              <span className="text-sm text-mute tabular-nums">
                {slots.length} {pluralRu(slots.length, t.windows)}
              </span>
            ) : null}
          </div>

          {grouped.size === 0 ? (
            <Reveal delay={0.1}>
              <div className={`${CARD} px-6 py-12 text-center text-sm text-mute`}>
                {t.empty}
              </div>
            </Reveal>
          ) : (
            [...grouped.entries()].map(([date, list], i) => (
              <Reveal key={date} delay={Math.min(i, 6) * 0.05 + 0.1}>
                <section className={`${CARD} p-6 sm:p-7`}>
                  <div className="flex items-baseline justify-between gap-3 border-b border-line/70 pb-4">
                    <h3 className="font-display text-lg font-medium tracking-tight text-ink">
                      {capitalize(RU_DATE.format(new Date(date)))}
                    </h3>
                    <span className="shrink-0 text-xs text-mute tabular-nums">
                      {list.length} {pluralRu(list.length, t.windows)}
                    </span>
                  </div>

                  <ul className="flex flex-col">
                    {list.map((s) => {
                      const taken =
                        s.appointment && s.appointment.status !== "CANCELLED";
                      return (
                        <li
                          key={s.id}
                          className="flex flex-wrap items-center justify-between gap-3 border-b border-line/50 py-3.5 last:border-0 last:pb-0"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-base font-medium tabular-nums text-ink">
                              {RU_TIME.format(s.startsAt)} –{" "}
                              {RU_TIME.format(s.endsAt)}
                            </span>
                            {taken ? (
                              <span
                                title={t.cantDelete}
                                className={`${PILL} border-primary/40 bg-primary/10 text-primary`}
                              >
                                {t.list.booked}
                              </span>
                            ) : !s.isOpen ? (
                              <span
                                className={`${PILL} border-mute/40 bg-card text-mute`}
                              >
                                {t.list.closed}
                              </span>
                            ) : (
                              <span
                                className={`${PILL} border-success/30 bg-success-soft text-success`}
                              >
                                {t.list.free}
                              </span>
                            )}
                          </div>

                          {!taken ? (
                            <div className="flex items-center gap-2">
                              <form>
                                <input type="hidden" name="id" value={s.id} />
                                <button
                                  type="submit"
                                  formAction={toggleSlotOpen}
                                  className={ROW_TOGGLE}
                                >
                                  {s.isOpen ? t.toggleClose : t.toggleOpen}
                                </button>
                              </form>
                              <form>
                                <input type="hidden" name="id" value={s.id} />
                                <ConfirmDeleteButton
                                  formAction={deleteSlot}
                                  confirmText={t.confirmDelete}
                                  className={ROW_DELETE}
                                >
                                  {t.delete}
                                </ConfirmDeleteButton>
                              </form>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              </Reveal>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
