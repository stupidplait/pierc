import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: `${ru.admin.dashboard.title} — ${ru.admin.panel}`,
};

export default async function AdminDashboardPage() {
  const session = await auth();
  const adminName = session?.user?.name ?? session?.user?.email ?? "";

  const start = startOfToday();
  const end = endOfToday();

  const [
    pendingBookings,
    todayAppointments,
    pendingReview,
    lowStock,
  ] = await Promise.all([
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

  const t = ru.admin.dashboard;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        eyebrow={ru.admin.panel}
        title={t.title}
        lead={
          adminName
            ? `${t.welcome}, ${adminName}. ${t.lead}`
            : t.lead
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card
          href="/admin/bookings?status=RESERVED"
          title={t.cards.pendingBookingsTitle}
          lead={t.cards.pendingBookingsLead}
          count={pendingBookings}
          tone={pendingBookings > 0 ? "primary" : "neutral"}
        />
        <Card
          href="/admin/appointments?today=1"
          title={t.cards.todayAppointmentsTitle}
          lead={t.cards.todayAppointmentsLead}
          count={todayAppointments}
          tone="neutral"
        />
        <Card
          href="/admin/jewelry?status=PENDING_REVIEW"
          title={t.cards.pendingReviewTitle}
          lead={t.cards.pendingReviewLead}
          count={pendingReview}
          tone={pendingReview > 0 ? "primary" : "neutral"}
        />
        <Card
          href="/admin/jewelry?lowStock=1"
          title={t.cards.lowStockTitle}
          lead={t.cards.lowStockLead}
          count={lowStock}
          tone={lowStock > 0 ? "warn" : "neutral"}
        />
      </div>
    </div>
  );
}

function Card({
  href,
  title,
  lead,
  count,
  tone,
}: {
  href: string;
  title: string;
  lead: string;
  count: number;
  tone: "primary" | "warn" | "neutral";
}) {
  const accent =
    tone === "primary"
      ? "text-primary"
      : tone === "warn"
        ? "text-warn"
        : "text-ink";
  return (
    <Link
      href={href}
      className="flex flex-col gap-3 rounded-2xl border border-line bg-card/40 p-6 transition-colors hover:border-primary"
    >
      <p className={`font-display text-4xl font-medium tabular-nums ${accent}`}>{count}</p>
      <h3 className="text-base font-medium text-ink">{title}</h3>
      <p className="text-sm text-mute">{lead}</p>
    </Link>
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
