import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  AppointmentStatusBadge,
  BookingStatusBadge,
} from "@/components/admin/StatusBadges";
import { AppointmentTransitionForm } from "@/components/admin/AppointmentTransitionForm";
import { formatPrice } from "@/lib/jewelry/format";

const RU_DT = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const RU_TIME = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const a = await prisma.appointment.findUnique({
    where: { id },
    select: { user: { select: { name: true } } },
  });
  return {
    title: `${a?.user?.name ?? ru.admin.appointments.detail.title} — ${ru.admin.panel}`,
  };
}

export default async function AdminAppointmentDetailPage({ params }: Props) {
  const { id } = await params;
  const appt = await prisma.appointment.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      slot: true,
      bookings: {
        include: { jewelry: { select: { id: true, name: true, price: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!appt) notFound();

  const t = ru.admin.appointments;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader eyebrow={ru.admin.panel} title={t.detail.title}>
        <Button href="/admin/appointments" variant="ghost" size="sm">
          ← {t.backToList}
        </Button>
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <AppointmentStatusBadge status={appt.status} />
        <span className="text-xs text-mute">
          {RU_DT.format(appt.createdAt)}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ── Left column ────────────────────────────────────────── */}
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-mute">
              {t.detail.clientHeading}
            </h2>
            <p className="text-base text-ink">{appt.user.name}</p>
            <p className="mt-1 text-sm text-mute">
              <a
                href={`mailto:${appt.user.email}`}
                className="hover:text-primary"
              >
                {appt.user.email}
              </a>
              {appt.user.phone ? (
                <>
                  {" · "}
                  <a
                    href={`tel:${appt.user.phone.replace(/\s|\(|\)|-/g, "")}`}
                    className="hover:text-primary"
                  >
                    {appt.user.phone}
                  </a>
                </>
              ) : null}
            </p>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-mute">
              {t.detail.slotHeading}
            </h2>
            {appt.slot ? (
              <p className="text-base text-ink">
                {RU_DT.format(appt.slot.startsAt)} –{" "}
                {RU_TIME.format(appt.slot.endsAt)}
              </p>
            ) : (
              <p className="text-mute">{t.noSlot}</p>
            )}
          </Card>

          {appt.bookings.length > 0 ? (
            <Card>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-mute">
                {t.linkedBookings}
              </h2>
              <ul className="flex flex-col gap-2">
                {appt.bookings.map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2 last:border-0 last:pb-0"
                  >
                    <BookingStatusBadge status={b.status} />
                    <Link
                      href={`/admin/bookings/${b.id}`}
                      className="min-w-0 flex-1 truncate text-sm text-ink hover:text-primary"
                    >
                      {b.jewelry.name}
                    </Link>
                    <span className="text-xs text-mute">
                      {formatPrice(b.jewelry.price.toString())}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        {/* ── Right column ───────────────────────────────────────── */}
        <div className="rounded-2xl border border-line bg-card/40 p-5">
          <AppointmentTransitionForm
            appointmentId={appt.id}
            status={appt.status}
            initialNotes={appt.notes}
          />
        </div>
      </div>
    </div>
  );
}
