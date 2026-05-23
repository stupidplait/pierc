import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { PageHeader } from "@/components/ui/PageHeader";
import { AppointmentStatusBadge } from "@/components/admin/StatusBadges";

export const metadata: Metadata = {
  title: `${ru.admin.appointments.title} вЂ” ${ru.admin.panel}`,
};

const RU_DT = new Intl.DateTimeFormat("ru-RU", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const STATUSES = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

interface Props {
  searchParams: Promise<{ status?: string; today?: string }>;
}

export default async function AdminAppointmentsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as (typeof STATUSES)[number])
    ? (sp.status as (typeof STATUSES)[number])
    : "";
  const todayOnly = sp.today === "1";

  const where: Prisma.AppointmentWhereInput = {};
  if (status) where.status = status;
  if (todayOnly) {
    const start = startOfToday();
    const end = endOfToday();
    where.slot = { startsAt: { gte: start, lt: end } };
  }

  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: [{ slot: { startsAt: "asc" } }, { createdAt: "desc" }],
    include: {
      user: { select: { name: true, email: true, phone: true } },
      slot: true,
      bookings: {
        where: { status: { not: "CANCELLED" } },
        select: { id: true },
      },
    },
    take: 200,
  });

  const t = ru.admin.appointments;

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
                {ru.admin.statusLabels.appointment[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="today"
            value="1"
            defaultChecked={todayOnly}
            className="size-4 rounded border-line text-primary focus:ring-primary"
          />
          <span>{t.todayLabel}</span>
        </label>
        <div className="ml-auto flex gap-2">
          <Link
            href="/admin/appointments"
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

      {appointments.length === 0 ? (
        <p className="text-mute">{t.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {appointments.map((a) => (
            <li key={a.id}>
              <Link
                href={`/admin/appointments/${a.id}`}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-page p-4 transition-colors hover:border-primary"
              >
                <AppointmentStatusBadge status={a.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {a.user.name}
                  </p>
                  <p className="truncate text-xs text-mute">
                    {a.user.email}
                    {a.user.phone ? ` В· ${a.user.phone}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-ink">
                    {a.slot ? RU_DT.format(a.slot.startsAt) : t.noSlot}
                  </p>
                  {a.bookings.length > 0 ? (
                    <p className="text-xs text-mute">
                      {t.linkedBookings}: {a.bookings.length}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
