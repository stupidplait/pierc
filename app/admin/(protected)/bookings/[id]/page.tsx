import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BookingStatusBadge } from "@/components/admin/StatusBadges";
import { BookingTransitionForm } from "@/components/admin/BookingTransitionForm";
import { formatPrice } from "@/lib/jewelry/format";

const RU_DT = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const b = await prisma.jewelryBooking.findUnique({
    where: { id },
    select: { jewelry: { select: { name: true } } },
  });
  return {
    title: `${b?.jewelry?.name ?? ru.admin.bookings.detail.title} — ${ru.admin.panel}`,
  };
}

export default async function AdminBookingDetailPage({ params }: Props) {
  const { id } = await params;
  const booking = await prisma.jewelryBooking.findUnique({
    where: { id },
    include: {
      jewelry: { select: { id: true, name: true, price: true, material: true } },
      user: { select: { id: true, name: true, email: true, phone: true } },
      appointment: {
        select: {
          id: true,
          status: true,
          slot: { select: { startsAt: true, endsAt: true } },
        },
      },
    },
  });

  if (!booking) notFound();
  const t = ru.admin.bookings;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        eyebrow={ru.admin.panel}
        title={t.detail.title}
      >
        <Button href="/admin/bookings" variant="ghost" size="sm">
          ← {t.backToList}
        </Button>
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <BookingStatusBadge status={booking.status} />
        <span className="text-xs text-mute">
          {RU_DT.format(booking.createdAt)}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ── Left column: client + jewelry + appointment summary ─── */}
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-mute">
              {t.detail.clientHeading}
            </h2>
            <p className="text-base text-ink">{booking.user.name}</p>
            <p className="mt-1 text-sm text-mute">
              <a
                href={`mailto:${booking.user.email}`}
                className="hover:text-primary"
              >
                {booking.user.email}
              </a>
              {booking.user.phone ? (
                <>
                  {" · "}
                  <a
                    href={`tel:${booking.user.phone.replace(/\s|\(|\)|-/g, "")}`}
                    className="hover:text-primary"
                  >
                    {booking.user.phone}
                  </a>
                </>
              ) : null}
            </p>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-mute">
              {t.detail.jewelryHeading}
            </h2>
            <Link
              href={`/admin/jewelry/${booking.jewelry.id}/edit`}
              className="text-base font-medium text-ink hover:text-primary"
            >
              {booking.jewelry.name}
            </Link>
            <p className="mt-1 text-sm text-mute">
              {booking.jewelry.material} ·{" "}
              {formatPrice(booking.jewelry.price.toString())}
            </p>
          </Card>

          {booking.appointment ? (
            <Card>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-mute">
                {t.detail.appointmentHeading}
              </h2>
              <Link
                href={`/admin/appointments/${booking.appointment.id}`}
                className="text-base text-ink hover:text-primary"
              >
                {booking.appointment.slot
                  ? RU_DT.format(booking.appointment.slot.startsAt)
                  : "Без слота"}
              </Link>
            </Card>
          ) : null}
        </div>

        {/* ── Right column: transition + notes ────────────────────── */}
        <div className="rounded-2xl border border-line bg-card/40 p-5">
          <BookingTransitionForm
            bookingId={booking.id}
            status={booking.status}
            initialNotes={booking.notes}
          />
        </div>
      </div>
    </div>
  );
}
