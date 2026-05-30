import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatRuPhone } from "@/lib/phone";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatPrice } from "@/lib/jewelry/format";
import {
  BookingsBoard,
  type BookingRow,
  type BookingStatus,
} from "@/components/admin/bookings/BookingsBoard";

export const metadata: Metadata = {
  title: `${ru.admin.bookings.title} — ${ru.admin.panel}`,
};

const RU_DT = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const STATUSES: BookingStatus[] = [
  "RESERVED",
  "CONFIRMED",
  "FULFILLED",
  "CANCELLED",
];

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminBookingsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as BookingStatus)
    ? (sp.status as BookingStatus)
    : "";

  const where: Prisma.JewelryBookingWhereInput = {};
  if (status) where.status = status;

  // The list honours the active filter; the counts feeding the filter chips are
  // unfiltered, so each chip always shows its total regardless of selection.
  const [bookings, grouped] = await Promise.all([
    prisma.jewelryBooking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        jewelry: { select: { id: true, name: true, price: true } },
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
      take: 200,
    }),
    prisma.jewelryBooking.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const counts: Record<BookingStatus, number> = {
    RESERVED: 0,
    CONFIRMED: 0,
    FULFILLED: 0,
    CANCELLED: 0,
  };
  for (const g of grouped) counts[g.status] = g._count._all;
  const total = STATUSES.reduce((sum, s) => sum + counts[s], 0);

  const rows: BookingRow[] = bookings.map((b) => ({
    id: b.id,
    status: b.status,
    jewelryName: b.jewelry.name,
    price: formatPrice(b.jewelry.price.toString()),
    client: [
      b.user.name,
      b.user.email,
      b.user.phone ? formatRuPhone(b.user.phone) : null,
    ]
      .filter(Boolean)
      .join(" · "),
    createdAt: RU_DT.format(b.createdAt),
  }));

  const t = ru.admin.bookings;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader eyebrow={ru.admin.panel} title={t.title} lead={t.lead} />
      <BookingsBoard
        rows={rows}
        status={status}
        counts={counts}
        total={total}
      />
    </div>
  );
}
