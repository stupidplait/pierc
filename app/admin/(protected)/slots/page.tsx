import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { SlotsManager } from "@/components/admin/slots/SlotsManager";
import { buildWeek, weekStartOf } from "@/lib/admin/slots-view";

export const metadata: Metadata = {
  title: ru.admin.slots.title,
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;

interface Props {
  searchParams: Promise<{ date?: string }>;
}

export default async function AdminSlotsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const now = new Date();
  // Rolling 7-day window. An explicit ?date is the window's first day as-is (so
  // day-stepping shifts it freely); with no param we default to Monday of the
  // current week to keep the familiar Mon–Sun grid on first load.
  const weekStart =
    sp.date && YMD.test(sp.date)
      ? new Date(`${sp.date}T00:00:00`)
      : weekStartOf(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const slots = await prisma.availabilitySlot.findMany({
    where: { startsAt: { gte: weekStart, lt: weekEnd } },
    orderBy: { startsAt: "asc" },
    include: {
      appointment: {
        select: {
          id: true,
          status: true,
          user: { select: { name: true } },
          service: { select: { name: true } },
        },
      },
    },
  });

  const week = buildWeek(slots, weekStart, now);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <SlotsManager week={week} />
    </div>
  );
}
