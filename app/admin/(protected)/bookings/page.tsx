import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { PageHeader } from "@/components/ui/PageHeader";
import { BookingStatusBadge } from "@/components/admin/StatusBadges";
import { formatPrice } from "@/lib/jewelry/format";

export const metadata: Metadata = {
  title: `${ru.admin.bookings.title} вЂ” ${ru.admin.panel}`,
};

const RU_DT = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const STATUSES = ["RESERVED", "CONFIRMED", "FULFILLED", "CANCELLED"] as const;

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminBookingsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as (typeof STATUSES)[number])
    ? (sp.status as (typeof STATUSES)[number])
    : "";

  const where: Prisma.JewelryBookingWhereInput = {};
  if (status) where.status = status;

  const bookings = await prisma.jewelryBooking.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      jewelry: { select: { id: true, name: true, price: true } },
      user: { select: { id: true, name: true, email: true, phone: true } },
      appointment: {
        select: { id: true, slot: { select: { startsAt: true } } },
      },
    },
    take: 200,
  });

  const t = ru.admin.bookings;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        eyebrow={ru.admin.panel}
        title={t.title}
        lead={t.lead}
      />

      <form
        method="get"
        className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-card/40 p-4"
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.15em] text-mute">
            {t.statusLabel}
          </span>
          <select
            name="status"
            defaultValue={status}
            className="h-10 rounded-lg border border-line bg-page px-3 text-sm text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <option value="">{t.statusAny}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {ru.admin.statusLabels.booking[s]}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex gap-2">
          <Link
            href="/admin/bookings"
            className="inline-flex h-10 items-center rounded-full border border-line px-4 text-sm text-mute hover:border-primary"
          >
            {t.reset}
          </Link>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-soft"
          >
            {t.apply}
          </button>
        </div>
      </form>

      {bookings.length === 0 ? (
        <p className="text-mute">{t.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {bookings.map((b) => (
            <li key={b.id}>
              <Link
                href={`/admin/bookings/${b.id}`}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-page p-4 transition-colors hover:border-primary"
              >
                <BookingStatusBadge status={b.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {b.jewelry.name}
                  </p>
                  <p className="truncate text-xs text-mute">
                    {b.user.name} В· {b.user.email}
                    {b.user.phone ? ` В· ${b.user.phone}` : ""}
                  </p>
                </div>
                <div className="text-right text-xs text-mute">
                  <p className="text-ink">
                    {formatPrice(b.jewelry.price.toString())}
                  </p>
                  <p>{RU_DT.format(b.createdAt)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
