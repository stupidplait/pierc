import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatRuPhone } from "@/lib/phone";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { PageHeader } from "@/components/ui/PageHeader";
import { AppointmentStatusBadge } from "@/components/admin/StatusBadges";
import { CARD } from "@/components/admin/form/styles";
import { Reveal } from "@/components/admin/form/atelier";

export const metadata: Metadata = {
  title: `${ru.admin.appointments.title} — ${ru.admin.panel}`,
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

/** Build a filter URL, carrying whichever facets are still active. */
function filterHref(status: string, today: boolean): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (today) params.set("today", "1");
  const qs = params.toString();
  return qs ? `/admin/appointments?${qs}` : "/admin/appointments";
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

  // Status segmented control: "any" + each status, as links so the filter works
  // without client JS — same trick as the rest of the redesigned admin.
  const statusOptions = [
    { value: "", label: t.statusAny },
    ...STATUSES.map((s) => ({
      value: s,
      label: ru.admin.statusLabels.appointment[s],
    })),
  ];

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader eyebrow={ru.admin.panel} title={t.title} lead={t.lead} />

      {/* ── Filter: status segments + today toggle, mirroring the settings tab bar ── */}
      <Reveal className="mb-8 flex flex-wrap items-center gap-3">
        <div className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-card p-1">
          {statusOptions.map((opt) => {
            const active = opt.value === status;
            return (
              <Link
                key={opt.value || "any"}
                href={filterHref(opt.value, todayOnly)}
                aria-current={active ? "true" : undefined}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-ink text-bg" : "text-mute hover:text-ink"
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>

        <Link
          href={filterHref(status, !todayOnly)}
          aria-current={todayOnly ? "true" : undefined}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors sm:ml-auto ${
            todayOnly
              ? "border-transparent bg-ink text-bg"
              : "border-line text-mute hover:border-ink/30 hover:text-ink"
          }`}
        >
          <CalendarDot active={todayOnly} />
          {t.todayLabel}
        </Link>
      </Reveal>

      {/* ── List: one elevated panel, hairline-separated rows ── */}
      <Reveal delay={0.08} className={`${CARD} overflow-hidden`}>
        {appointments.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-mute">{t.empty}</p>
        ) : (
          <ul>
            {appointments.map((a) => (
              <li
                key={a.id}
                className="border-b border-line/60 last:border-b-0"
              >
                <Link
                  href={`/admin/appointments/${a.id}`}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-ink/3 sm:px-6"
                >
                  <AppointmentStatusBadge status={a.status} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {a.user.name}
                    </p>
                    <p className="truncate text-xs text-mute">
                      {a.user.email}
                      {a.user.phone ? ` · ${formatRuPhone(a.user.phone)}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm text-ink">
                      {a.slot ? RU_DT.format(a.slot.startsAt) : t.noSlot}
                    </p>
                    {a.bookings.length > 0 ? (
                      <p className="text-xs text-mute">
                        {t.linkedBookings}: {a.bookings.length}
                      </p>
                    ) : null}
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-mute/40 transition-transform group-hover:translate-x-0.5 group-hover:text-mute" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Reveal>
    </div>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

// Tiny status dot for the "today" toggle — fills with the page bg when the pill
// is active (ink ground), hollow-mute when it is not.
function CalendarDot({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={`size-1.5 rounded-full ${active ? "bg-bg" : "bg-mute/50"}`}
    />
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
