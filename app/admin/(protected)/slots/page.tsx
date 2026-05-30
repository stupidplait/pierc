import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { pluralRu } from "@/lib/i18n/plural";
import { BulkSlotForm } from "@/components/admin/BulkSlotForm";
import { SingleSlotPopover } from "@/components/admin/slots/SingleSlotPopover";
import {
  SlotSchedule,
  type SlotCounts,
  type SlotDayGroup,
} from "@/components/admin/slots/SlotSchedule";
import {
  SLOT_STATUS_STYLES,
  slotStatusLabel,
  type SlotStatus,
} from "@/components/admin/slots/status";

export const metadata: Metadata = {
  title: ru.admin.slots.title,
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

  // Group by yyyy-mm-dd (UTC date key, as before) into the serializable shape
  // the client schedule renders, deriving a status + tallying counts as we go.
  const groupMap = new Map<string, SlotDayGroup>();
  const counts: SlotCounts = { all: 0, free: 0, booked: 0, closed: 0 };

  for (const s of slots) {
    const taken = s.appointment && s.appointment.status !== "CANCELLED";
    const status: SlotStatus = taken ? "booked" : s.isOpen ? "free" : "closed";
    counts.all += 1;
    counts[status] += 1;

    const dateKey = s.startsAt.toISOString().slice(0, 10);
    let group = groupMap.get(dateKey);
    if (!group) {
      group = {
        dateKey,
        dateLabel: capitalize(RU_DATE.format(new Date(dateKey))),
        slots: [],
      };
      groupMap.set(dateKey, group);
    }
    group.slots.push({
      id: s.id,
      timeLabel: RU_TIME.format(s.startsAt),
      rangeLabel: `${RU_TIME.format(s.startsAt)}–${RU_TIME.format(s.endsAt)}`,
      status,
    });
  }

  const groups = [...groupMap.values()];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-10 flex flex-col gap-4 pt-2 sm:mb-12 sm:flex-row sm:items-end sm:justify-between sm:pt-4">
        <div>
          <h1 className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
            {t.title}
          </h1>
          <p className="mt-3 text-base text-mute">{t.lead}</p>
          {counts.all > 0 ? (
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <span className="text-mute">
                <span className="font-medium tabular-nums text-ink">
                  {counts.all}
                </span>{" "}
                {pluralRu(counts.all, t.windows)}
              </span>
              {(["free", "booked", "closed"] as const).map((s) => (
                <span key={s} className="flex items-center gap-1.5 text-mute">
                  <span
                    className={`size-1.5 rounded-full ${SLOT_STATUS_STYLES[s].dot}`}
                  />
                  <span className="font-medium tabular-nums text-ink">
                    {counts[s]}
                  </span>{" "}
                  {slotStatusLabel(s).toLowerCase()}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="shrink-0">
          <SingleSlotPopover />
        </div>
      </header>

      <div className="flex flex-col gap-8">
        {/* Bulk create — primary path for monthly planning. */}
        <BulkSlotForm delay={0} />

        {/* Schedule */}
        <SlotSchedule groups={groups} counts={counts} />
      </div>
    </div>
  );
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
