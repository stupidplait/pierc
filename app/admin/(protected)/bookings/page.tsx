import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatRuPhone } from "@/lib/phone";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { formatPrice } from "@/lib/jewelry/format";
import {
  BookingsBoard,
  type BookingRow,
  type BookingStatus,
} from "@/components/admin/bookings/BookingsBoard";

export const metadata: Metadata = {
  title: ru.admin.bookings.title,
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
  searchParams: Promise<{ status?: string; q?: string }>;
}

export default async function AdminBookingsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as BookingStatus)
    ? (sp.status as BookingStatus)
    : "";
  const q = sp.q?.trim() || "";

  // Search spans the linked jewelry name + the client's name/email, so the box
  // finds a booking whether the admin remembers the piece or the person.
  const baseWhere: Prisma.JewelryBookingWhereInput = {};
  if (q) {
    baseWhere.OR = [
      { jewelry: { name: { contains: q, mode: "insensitive" } } },
      { user: { name: { contains: q, mode: "insensitive" } } },
      { user: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  // The list narrows by the active status too; the chip counts honour the search
  // but not the status, so each chip shows how many of the *matched* bookings
  // sit in that status.
  const listWhere: Prisma.JewelryBookingWhereInput = status
    ? { ...baseWhere, status }
    : baseWhere;

  const [bookings, grouped] = await Promise.all([
    prisma.jewelryBooking.findMany({
      where: listWhere,
      orderBy: { createdAt: "desc" },
      include: {
        jewelry: { select: { id: true, name: true, price: true, material: true } },
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
      take: 200,
    }),
    prisma.jewelryBooking.groupBy({
      by: ["status"],
      where: baseWhere,
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
    material: b.jewelry.material,
    price: formatPrice(b.jewelry.price.toString()),
    clientName: b.user.name,
    clientContact: [
      b.user.email,
      b.user.phone ? formatRuPhone(b.user.phone) : null,
    ]
      .filter(Boolean)
      .join(" · "),
    createdAt: RU_DT.format(b.createdAt),
  }));

  const t = ru.admin.bookings;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-10 pt-2 sm:mb-12 sm:pt-4">
        <h1 className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          {t.title}
        </h1>
        <p className="mt-3 text-base text-mute">{t.lead}</p>
      </header>
      <BookingsBoard
        rows={rows}
        status={status}
        query={q}
        counts={counts}
        total={total}
      />
    </div>
  );
}
