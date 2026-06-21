import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";

import { ru } from "@/lib/i18n/ru";
import type { QuickAction } from "@/components/admin/dashboard/types";
import type { MetricV2, TodayItem } from "@/components/admin/dashboard/v2/types";
import { DashboardV2 } from "@/components/admin/dashboard/v2/DashboardV2";

export const metadata: Metadata = {
  title: ru.admin.dashboard.title,
};

const RU_TIME = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdminDashboardPage() {
  const session = await auth();
  const adminName = session?.user?.name ?? session?.user?.email ?? "";

  const start = startOfToday();
  const end = endOfToday();

  const [pendingBookings, todayAppointments, pendingReview, lowStock, todayAppts] =
    await Promise.all([
      prisma.jewelryBooking.count({ where: { status: "RESERVED" } }),
      prisma.appointment.count({
        where: {
          status: "CONFIRMED",
          slot: { startsAt: { gte: start, lt: end } },
        },
      }),
      prisma.jewelry.count({ where: { status: "PENDING_REVIEW" } }),
      prisma.jewelry.count({
        where: { status: "PUBLISHED", inStock: { lte: 1 } },
      }),
      // Today's schedule — confirmed + still-pending visits, time-ordered.
      prisma.appointment.findMany({
        where: {
          status: { in: ["CONFIRMED", "PENDING"] },
          slot: { startsAt: { gte: start, lt: end } },
        },
        orderBy: { slot: { startsAt: "asc" } },
        include: {
          user: { select: { name: true } },
          slot: { select: { startsAt: true } },
          service: { select: { name: true } },
        },
        take: 8,
      }),
    ]);

  const cs = ru.admin.dashboard.cardsShort;
  const metrics: MetricV2[] = [
    {
      key: "pendingBookings",
      href: "/admin/bookings?status=RESERVED",
      label: cs.pendingBookings,
      count: pendingBookings,
      tone: pendingBookings > 0 ? "primary" : "neutral",
      urgent: pendingBookings > 0,
    },
    {
      key: "todayAppointments",
      href: "/admin/appointments?today=1",
      label: cs.todayAppointments,
      count: todayAppointments,
      tone: "neutral",
      urgent: false,
    },
    {
      key: "pendingReview",
      href: "/admin/jewelry?status=PENDING_REVIEW",
      label: cs.pendingReview,
      count: pendingReview,
      tone: pendingReview > 0 ? "primary" : "neutral",
      urgent: pendingReview > 0,
    },
    {
      key: "lowStock",
      href: "/admin/jewelry?lowStock=1",
      label: cs.lowStock,
      count: lowStock,
      tone: lowStock > 0 ? "warn" : "neutral",
      urgent: lowStock > 0,
    },
  ];

  const qa = ru.admin.dashboard.quickActions;
  const quickActions: QuickAction[] = [
    { href: "/admin/jewelry/new", label: qa.newJewelry, kind: "jewelry" },
    { href: "/admin/slots", label: qa.slots, kind: "slots" },
    { href: "/admin/bookings", label: qa.bookings, kind: "bookings" },
    { href: "/admin/appointments", label: qa.appointments, kind: "appointments" },
    { href: "/admin/content", label: qa.content, kind: "content" },
    { href: "/admin/settings", label: qa.settings, kind: "settings" },
  ];

  const today: TodayItem[] = todayAppts.map((a) => ({
    id: a.id,
    href: `/admin/appointments?today=1&sel=${a.id}`,
    time: a.slot ? RU_TIME.format(a.slot.startsAt) : "—",
    customer: a.user.name || "—",
    service: a.service?.name ?? null,
    status: a.status,
  }));

  return (
    <DashboardV2
      adminName={adminName}
      metrics={metrics}
      quickActions={quickActions}
      today={today}
    />
  );
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
