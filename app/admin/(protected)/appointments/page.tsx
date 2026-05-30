import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatRuPhone } from "@/lib/phone";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { AppointmentStatusBadge } from "@/components/admin/StatusBadges";
import { Reveal } from "@/components/admin/form/atelier";
import { Card } from "@/components/shadcn/ui/card";
import { Input } from "@/components/shadcn/ui/input";
import { Button } from "@/components/shadcn/ui/button";

export const metadata: Metadata = {
  title: ru.admin.appointments.title,
};

const RU_TIME = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});
const RU_DAY = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const STATUSES = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;
type Status = (typeof STATUSES)[number];

// Precise row shape from the list query below — lets the row/grouping helpers be
// typed without threading the inferred Prisma payload through by hand.
type ApptRow = Prisma.AppointmentGetPayload<{
  include: {
    user: { select: { name: true; email: true; phone: true } };
    slot: true;
    service: { select: { name: true } };
    bookings: { select: { id: true } };
  };
}>;

interface Props {
  searchParams: Promise<{ status?: string; today?: string; q?: string }>;
}

/** Build a filter URL, carrying whichever facets are still active. */
function filterHref(status: string, today: boolean, q: string): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (today) params.set("today", "1");
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/admin/appointments?${qs}` : "/admin/appointments";
}

export default async function AdminAppointmentsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as Status)
    ? (sp.status as Status)
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
  // chip always shows its own total) — same convention as the bookings board.
  const [appointments, grouped, todayCount] = await Promise.all([
    prisma.appointment.findMany({
      where,
      orderBy: [{ slot: { startsAt: "asc" } }, { createdAt: "desc" }],
      include: {
        user: { select: { name: true, email: true, phone: true } },
        slot: true,
        service: { select: { name: true } },
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

  const counts: Record<Status, number> = {
    PENDING: 0,
    CONFIRMED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    NO_SHOW: 0,
  };
  for (const g of grouped) counts[g.status] = g._count._all;
  const total = STATUSES.reduce((sum, s) => sum + counts[s], 0);

  const t = ru.admin.appointments;
  const L = t.list;

  const statusOptions = [
    { value: "", label: t.statusAny, count: total },
    ...STATUSES.map((s) => ({
      value: s,
      label: ru.admin.statusLabels.appointment[s],
      count: counts[s],
    })),
  ];

  const groups = groupByDay(appointments, todayStart, tomorrowStart, L);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-10 pt-2 sm:mb-12 sm:pt-4">
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
      <Reveal delay={0.06} className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-line bg-card p-1">
            {statusOptions.map((opt) => {
              const active = opt.value === status;
              return (
                <Link
                  key={opt.value || "any"}
                  href={filterHref(opt.value, todayOnly, q)}
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
              href={filterHref(status, !todayOnly, q)}
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
              <Link href={filterHref(status, todayOnly, "")}>
                {L.searchClear}
              </Link>
            </Button>
          ) : null}
        </form>
      </Reveal>

      {/* ── List: day-grouped, hairline-separated rows ────────────── */}
      {appointments.length === 0 ? (
        <Reveal delay={0.1}>
          <Card className="px-6 py-16 text-center">
            <p className="text-sm text-mute">{t.empty}</p>
          </Card>
        </Reveal>
      ) : (
        <Reveal delay={0.1} className="flex flex-col gap-6">
          {groups.map((group) => (
            <div key={group.key}>
              <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-[0.18em] text-mute">
                {group.label}
              </h2>
              <Card className="overflow-hidden">
                <ul>
                  {group.items.map((a) => (
                    <li
                      key={a.id}
                      className="border-b border-line/60 last:border-b-0"
                    >
                      <AppointmentRow a={a} t={t} />
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          ))}
        </Reveal>
      )}
    </div>
  );
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

function AppointmentRow({
  a,
  t,
}: {
  a: ApptRow;
  t: typeof ru.admin.appointments;
}) {
  return (
    <Link
      href={`/admin/appointments/${a.id}`}
      className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-ink/3 sm:gap-4 sm:px-5"
    >
      <span
        aria-hidden
        className="hidden size-9 shrink-0 items-center justify-center rounded-full border border-line bg-ink/5 text-xs font-medium text-mute sm:flex"
      >
        {initials(a.user.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{a.user.name}</p>
        <p className="truncate text-xs text-mute">
          {a.user.email}
          {a.user.phone ? ` · ${formatRuPhone(a.user.phone)}` : ""}
        </p>
      </div>
      {a.service ? (
        <span className="hidden max-w-[14ch] truncate text-xs text-mute md:inline">
          {a.service.name}
        </span>
      ) : null}
      <div className="shrink-0 text-right">
        <p className="text-sm tabular-nums text-ink">
          {a.slot ? RU_TIME.format(a.slot.startsAt) : "—"}
        </p>
        {a.bookings.length > 0 ? (
          <p className="text-xs text-mute">
            {t.linkedBookings}: {a.bookings.length}
          </p>
        ) : null}
      </div>
      <AppointmentStatusBadge status={a.status} />
      <ChevronRight className="size-4 shrink-0 text-mute/40 transition-transform group-hover:translate-x-0.5 group-hover:text-mute" />
    </Link>
  );
}

// ── Day grouping ────────────────────────────────────────────────────────────

function groupByDay(
  items: ApptRow[],
  todayStart: Date,
  tomorrowStart: Date,
  L: typeof ru.admin.appointments.list,
): { key: string; label: string; items: ApptRow[] }[] {
  const map = new Map<string, ApptRow[]>();
  for (const a of items) {
    const key = a.slot ? dayKeyOf(a.slot.startsAt) : "__noslot__";
    const arr = map.get(key);
    if (arr) arr.push(a);
    else map.set(key, [a]);
  }
  const out: { key: string; label: string; items: ApptRow[] }[] = [];
  for (const [key, arr] of map) {
    const label =
      key === "__noslot__"
        ? ru.admin.appointments.noSlot
        : dayLabel(arr[0].slot!.startsAt, todayStart, tomorrowStart, L);
    out.push({ key, label, items: arr });
  }
  return out;
}

function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(
  d: Date,
  todayStart: Date,
  tomorrowStart: Date,
  L: typeof ru.admin.appointments.list,
): string {
  const ds = new Date(d);
  ds.setHours(0, 0, 0, 0);
  if (ds.getTime() === todayStart.getTime()) return L.today;
  if (ds.getTime() === tomorrowStart.getTime()) return L.tomorrow;
  const s = RU_DAY.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
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
