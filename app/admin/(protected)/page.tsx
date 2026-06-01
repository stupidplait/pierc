import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import type { Metric, QuickAction } from "@/components/admin/dashboard/types";
import { StatusBoard } from "@/components/admin/dashboard/StatusBoard";

export const metadata: Metadata = {
  title: ru.admin.dashboard.title,
};

export default async function AdminDashboardPage() {
  const session = await auth();
  const adminName = session?.user?.name ?? session?.user?.email ?? "";

  const start = startOfToday();
  const end = endOfToday();

  const [pendingBookings, todayAppointments, pendingReview, lowStock] =
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
    ]);

  const c = ru.admin.dashboard.cards;
  const cs = ru.admin.dashboard.cardsShort;

  const metrics: Metric[] = [
    {
      key: "pendingBookings",
      href: "/admin/bookings?status=RESERVED",
      title: c.pendingBookingsTitle,
      titleShort: cs.pendingBookings,
      lead: c.pendingBookingsLead,
      count: pendingBookings,
      tone: pendingBookings > 0 ? "primary" : "neutral",
      urgent: pendingBookings > 0,
    },
    {
      key: "todayAppointments",
      href: "/admin/appointments?today=1",
      title: c.todayAppointmentsTitle,
      titleShort: cs.todayAppointments,
      lead: c.todayAppointmentsLead,
      count: todayAppointments,
      tone: "neutral",
      urgent: false,
    },
    {
      key: "pendingReview",
      href: "/admin/jewelry?status=PENDING_REVIEW",
      title: c.pendingReviewTitle,
      titleShort: cs.pendingReview,
      lead: c.pendingReviewLead,
      count: pendingReview,
      tone: pendingReview > 0 ? "primary" : "neutral",
      urgent: pendingReview > 0,
    },
    {
      key: "lowStock",
      href: "/admin/jewelry?lowStock=1",
      title: c.lowStockTitle,
      titleShort: cs.lowStock,
      lead: c.lowStockLead,
      count: lowStock,
      tone: lowStock > 0 ? "warn" : "neutral",
      urgent: lowStock > 0,
    },
  ];

  const qa = ru.admin.dashboard.quickActions;
  const quickActions: QuickAction[] = [
    // Lazy create — a plain link to the editor; the row is only persisted on the
    // first save there (no more abandoned blank drafts from a stray click).
    { href: "/admin/jewelry/new", label: qa.newJewelry, kind: "jewelry" },
    { href: "/admin/slots", label: qa.slots, kind: "slots" },
    { href: "/admin/bookings", label: qa.bookings, kind: "bookings" },
    { href: "/admin/appointments", label: qa.appointments, kind: "appointments" },
    { href: "/admin/content", label: qa.content, kind: "content" },
    { href: "/admin/settings", label: qa.settings, kind: "settings" },
  ];

  return (
    <StatusBoard
      adminName={adminName}
      metrics={metrics}
      quickActions={quickActions}
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
