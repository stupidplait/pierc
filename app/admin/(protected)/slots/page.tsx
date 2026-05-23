import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
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

  const t = ru.admin.slots;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        eyebrow={ru.admin.panel}
        title={t.title}
        lead={t.lead}
      />

      {/* ── Bulk create — primary path for monthly planning ───── */}
      <section className="mb-6">
        <Card>
          <h2 className="mb-1 text-sm font-medium uppercase tracking-[0.2em] text-mute">
            {t.bulkHeading}
          </h2>
          <p className="mb-5 max-w-prose text-sm text-mute">{t.bulkLead}</p>
          <BulkSlotForm />
        </Card>
      </section>

      {/* ── Single create — collapsed; for one-off tweaks ───────── */}
      <section className="mb-10">
        <details className="group rounded-2xl border border-line bg-card/40 p-4">
          <summary className="cursor-pointer list-none text-sm font-medium uppercase tracking-[0.2em] text-mute group-open:mb-4">
            {t.singleHeading} ▾
          </summary>
          <SlotForm />
        </details>
      </section>

      {/* ── List ──────────────────────────────────────────────── */}
      {grouped.size === 0 ? (
        <p className="text-mute">{t.empty}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {[...grouped.entries()].map(([date, list]) => (
            <section key={date}>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.15em] text-mute">
                {RU_DATE.format(new Date(date))}
              </h2>
              <ul className="flex flex-col gap-2">
                {list.map((s) => {
                  const taken =
                    s.appointment && s.appointment.status !== "CANCELLED";
                  return (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-page p-4"
                    >
                      <div>
                        <p className="text-base font-medium text-ink">
                          {RU_TIME.format(s.startsAt)} –{" "}
                          {RU_TIME.format(s.endsAt)}
                        </p>
                        <p
                          className={`text-xs ${taken ? "text-primary" : !s.isOpen ? "text-mute" : "text-mute"}`}
                        >
                          {taken
                            ? t.list.booked
                            : !s.isOpen
                              ? t.list.closed
                              : t.list.free}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!taken ? (
                          <form>
                            <input type="hidden" name="id" value={s.id} />
                            <button
                              type="submit"
                              formAction={toggleSlotOpen}
                              className="inline-flex h-9 items-center rounded-full border border-line px-3 text-xs font-medium text-ink transition-colors hover:border-primary hover:text-primary"
                            >
                              {s.isOpen ? t.toggleClose : t.toggleOpen}
                            </button>
                          </form>
                        ) : null}
                        {!taken ? (
                          <form>
                            <input type="hidden" name="id" value={s.id} />
                            <ConfirmDeleteButton
                              formAction={deleteSlot}
                              confirmText={t.confirmDelete}
                            >
                              {t.delete}
                            </ConfirmDeleteButton>
                          </form>
                        ) : (
                          <span
                            title={t.cantDelete}
                            className="text-xs text-mute"
                          >
                            {t.cantDelete}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
