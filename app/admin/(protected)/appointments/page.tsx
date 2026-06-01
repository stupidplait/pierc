import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { Reveal } from "@/components/admin/form/atelier";
import { Card } from "@/components/shadcn/ui/card";
import { Input } from "@/components/shadcn/ui/input";
import { Button } from "@/components/shadcn/ui/button";
import { formatPrice } from "@/lib/jewelry/format";
import {
  APPT_STATUSES,
  groupByDay,
  type ApptItem,
  type ApptStatus,
} from "@/lib/admin/appointments-view";
import {
  ConsoleView,
  type ConsoleAppointment,
} from "@/components/admin/appointments/views/ConsoleView";

export const metadata: Metadata = {
  title: ru.admin.appointments.title,
};

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
  searchParams: Promise<{
    status?: string;
    today?: string;
    q?: string;
    sel?: string;
  }>;
}

export default async function AdminAppointmentsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = APPT_STATUSES.includes(sp.status as ApptStatus)
    ? (sp.status as ApptStatus)
    : "";
  const todayOnly = sp.today === "1";
  const q = (sp.q ?? "").trim();

  const todayStart = startOfToday();
  const todayEnd = endOfToday();
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const where: Prisma.AppointmentWhereInput = {};
  if (status) where.status = status;
  if (todayOnly) where.slot = { startsAt: { gte: todayStart, lt: todayEnd } };
  if (q) {
    where.user = {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    };
  }

  // List honours the active filter; the chip counts are unfiltered totals (each
  // chip always shows its own total) — same convention as the bookings console.
  const [appointments, grouped, todayCount] = await Promise.all([
    prisma.appointment.findMany({
      where,
      orderBy: [{ slot: { startsAt: "asc" } }, { createdAt: "desc" }],
      include: {
        user: { select: { name: true, email: true, phone: true } },
        slot: true,
        service: { select: { name: true, durationMin: true } },
        bookings: {
          where: { status: { not: "CANCELLED" } },
          select: { id: true },
        },
      },
      take: 200,
    }),
    prisma.appointment.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.appointment.count({
      where: { slot: { startsAt: { gte: todayStart, lt: todayEnd } } },
    }),
  ]);

  const counts: Record<ApptStatus, number> = {
    PENDING: 0,
    CONFIRMED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    NO_SHOW: 0,
  };
  for (const g of grouped) counts[g.status] = g._count._all;
  const total = APPT_STATUSES.reduce((sum, s) => sum + counts[s], 0);

  const items: ApptItem[] = appointments.map((a) => ({
    id: a.id,
    status: a.status,
    userName: a.user.name,
    userEmail: a.user.email,
    userPhone: a.user.phone,
    serviceName: a.service?.name ?? null,
    durationMin: a.service?.durationMin ?? null,
    startsAt: a.slot?.startsAt ?? null,
    endsAt: a.slot?.endsAt ?? null,
    bookingsCount: a.bookings.length,
  }));

  const groups = groupByDay(items, todayStart, tomorrowStart);

  const t = ru.admin.appointments;
  const L = t.list;

  // Console selection — the open appointment's full dossier. Falls back to the
  // first row when ?sel is missing or stale.
  let selected: ConsoleAppointment | null = null;
  let selectedId: string | null = null;
  if (items.length > 0) {
    selectedId =
      sp.sel && items.some((i) => i.id === sp.sel) ? sp.sel : items[0].id;
    selected = await loadConsoleAppointment(selectedId);
    if (!selected) selectedId = null;
  }

  /** Build a list URL, carrying whichever facets are still active. */
  const buildHref = (next: {
    status?: string;
    today?: boolean;
    q?: string;
    sel?: string;
  }): string => {
    const params = new URLSearchParams();
    const s = next.status ?? status;
    const tday = next.today ?? todayOnly;
    const query = next.q ?? q;
    if (s) params.set("status", s);
    if (tday) params.set("today", "1");
    if (query) params.set("q", query);
    if (next.sel) params.set("sel", next.sel);
    const qs = params.toString();
    return qs ? `/admin/appointments?${qs}` : "/admin/appointments";
  };

  const statusOptions = [
    { value: "", label: t.statusAny, count: total },
    ...APPT_STATUSES.map((s) => ({
      value: s,
      label: ru.admin.statusLabels.appointment[s],
      count: counts[s],
    })),
  ];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-8 pt-2 sm:mb-10 sm:pt-4">
        <h1 className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          {t.title}
        </h1>
        <p className="mt-3 text-base text-mute">{t.lead}</p>
      </header>

      {/* ── Summary strip ─────────────────────────────────────────── */}
      <Reveal className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        <SummaryCard label={L.summaryTotal} value={total} />
        <SummaryCard label={L.summaryPending} value={counts.PENDING} accent />
        <SummaryCard label={L.summaryToday} value={todayCount} />
      </Reveal>

      {/* ── Filters: status segments + today toggle + search ──────── */}
      <Reveal delay={0.06} className="mb-7 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-line bg-card p-1">
            {statusOptions.map((opt) => {
              const active = opt.value === status;
              return (
                <Link
                  key={opt.value || "any"}
                  href={buildHref({ status: opt.value })}
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ${
                    active ? "bg-ink text-bg" : "text-mute hover:text-ink"
                  }`}
                >
                  <span>{opt.label}</span>
                  <span
                    className={`text-xs tabular-nums ${
                      active ? "text-bg/65" : "text-mute/65"
                    }`}
                  >
                    {opt.count}
                  </span>
                </Link>
              );
            })}
          </div>

          <Button
            asChild
            variant={todayOnly ? "default" : "outline"}
            size="sm"
            className="sm:ml-auto"
          >
            <Link
              href={buildHref({ today: !todayOnly })}
              scroll={false}
              aria-current={todayOnly ? "true" : undefined}
            >
              {L.today}
            </Link>
          </Button>
        </div>

        <form
          method="get"
          action="/admin/appointments"
          className="flex items-center gap-2"
        >
          {status ? <input type="hidden" name="status" value={status} /> : null}
          {todayOnly ? <input type="hidden" name="today" value="1" /> : null}
          <div className="relative flex-1 sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute/50" />
            <Input
              name="q"
              defaultValue={q}
              placeholder={L.searchPlaceholder}
              className="h-9 pl-9"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            {L.searchAction}
          </Button>
          {q ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={buildHref({ q: "" })} scroll={false}>
                {L.searchClear}
              </Link>
            </Button>
          ) : null}
        </form>
      </Reveal>

      {/* ── Console ───────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <Reveal delay={0.1}>
          <Card className="px-6 py-16 text-center">
            <p className="text-sm text-mute">{t.empty}</p>
          </Card>
        </Reveal>
      ) : (
        <Reveal delay={0.1}>
          <ConsoleView
            groups={groups}
            selected={selected}
            selectedId={selectedId}
            buildSelHref={(id) => buildHref({ sel: id })}
          />
        </Reveal>
      )}
    </div>
  );
}

/** Full dossier for the console's open row — mirrors the detail page's query. */
async function loadConsoleAppointment(
  id: string,
): Promise<ConsoleAppointment | null> {
  const a = await prisma.appointment.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      slot: true,
      service: { select: { name: true, price: true, durationMin: true } },
      bookings: {
        include: { jewelry: { select: { id: true, name: true, price: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!a) return null;

  return {
    id: a.id,
    status: a.status,
    createdAtLabel: RU_DT.format(a.createdAt),
    userName: a.user.name,
    userEmail: a.user.email,
    userPhone: a.user.phone,
    service: a.service
      ? {
          name: a.service.name,
          priceLabel: formatPrice(a.service.price.toString()),
          durationMin: a.service.durationMin,
        }
      : null,
    slotLabel: a.slot
      ? `${RU_DT.format(a.slot.startsAt)} – ${RU_TIME.format(a.slot.endsAt)}`
      : null,
    bookings: a.bookings.map((b) => ({
      id: b.id,
      status: b.status,
      jewelryName: b.jewelry.name,
      jewelryPrice: formatPrice(b.jewelry.price.toString()),
    })),
    notes: a.notes,
  };
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-xs text-mute">{label}</p>
      <p
        className={`mt-1 text-2xl font-medium tabular-nums ${
          accent && value > 0 ? "text-accent" : "text-ink"
        }`}
      >
        {value}
      </p>
    </Card>
  );
}

function SearchIcon({ className }: { className?: string }) {
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
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
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
