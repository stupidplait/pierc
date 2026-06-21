#!/usr/bin/env tsx
/**
 * Demo data seed — fills the DB with everything needed to make the admin panel
 * and the public booking flow look "lived-in":
 *
 *   1. Settings    — studio contact card (address / phone / working hours).
 *   2. Services    — a starter price list (only if the Service table is empty,
 *                    mirroring scripts/seed-services.ts — admin edits are kept).
 *   3. Slots       — Mon–Fri 09:00–18:00 hourly windows. A full month AHEAD
 *                    (the bookable inventory) plus ~3 weeks of PAST windows so
 *                    completed / no-show visits have real linked times.
 *   4. Users       — 10 registered customers, password "test" (so you can log
 *                    in as any of them and see their /account history).
 *   5. Appointments+ each user gets 6–10 visits spanning EVERY status
 *      bookings      (PENDING / CONFIRMED / COMPLETED / CANCELLED / NO_SHOW),
 *                    some carrying reserved jewelry — with the booking status
 *                    cascaded to match the appointment (see the admin
 *                    transition rules in lib/admin/appointment-actions.ts).
 *   6. Reviews     — customer testimonials seeded the way the real magic-link
 *                    flow produces them: tied to COMPLETED appointments
 *                    (→ "проверенный клиент" badge), tagged to the jewelry
 *                    booked on that visit (→ per-piece reviews on
 *                    /catalog/[id]), across all three moderation states
 *                    (PENDING / PUBLISHED / REJECTED) with up to 6 featured
 *                    for the /about wall. A handful of admin-manual
 *                    (non-verified) testimonials are added for variety.
 *
 * Idempotent & deterministic. Re-running:
 *   - upserts Settings / services / users in place (no duplicates),
 *   - re-creates slots only for windows that don't exist yet (deterministic
 *     ids, overlap-safe against admin-made slots),
 *   - wipes & rebuilds the 10 demo users' appointments + bookings, so the
 *     dataset is stable run-to-run (a fixed PRNG seed drives all the choices),
 *   - clears & rebuilds the seeded reviews (matched by a marker stamped into
 *     moderatorNotes) so they never accumulate across runs.
 *
 * Run with:   npm run db:seed:demo
 */

import {
  PrismaClient,
  AppointmentStatus,
  JewelryBookingStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// Tunables
// ─────────────────────────────────────────────────────────────────────────────

const STUDIO = {
  address: "г. Казань, ул. Краснококшайская, 60",
  phone: "+7 (843) 239-29-55",
  workingHours: "Пн–Пт, 9:00–18:00",
};

const DEMO_PASSWORD = "test";

// Slot grid: Mon–Fri, hourly windows from 09:00 (inclusive) to 18:00 (last
// window 17:00–18:00). 0=Mon … 4=Fri.
const WORK_DAYS = new Set([0, 1, 2, 3, 4]);
const DAY_START_HOUR = 9;
const DAY_END_HOUR = 18; // exclusive upper edge of the last window's start
const SLOT_HOURS = 1;

const FUTURE_DAYS = 31; // ~a month ahead (the requirement)
const PAST_DAYS = 21; // ~3 weeks back — coherent history for completed visits

const DAY_MS = 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic PRNG (mulberry32) — fixed seed ⇒ identical dataset every run.
// ─────────────────────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0xc0ffee);
const randInt = (min: number, max: number) =>
  min + Math.floor(rand() * (max - min + 1));
const chance = (p: number) => rand() < p;
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function sample<T>(arr: readonly T[], k: number): T[] {
  return shuffle([...arr]).slice(0, Math.min(k, arr.length));
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo customers (latin transliterated emails @example.com — the reserved demo
// domain — so they never collide with real signups). Password is "test".
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_USERS: Array<{
  name: string;
  email: string;
  phone: string;
  telegram: string;
}> = [
  { name: "Анна Смирнова", email: "anna.smirnova@example.com", phone: "+7 917 390-12-45", telegram: "@anna_smr" },
  { name: "Мария Кузнецова", email: "maria.kuznetsova@example.com", phone: "+7 927 411-58-03", telegram: "@mkuznetsova" },
  { name: "Екатерина Попова", email: "ekaterina.popova@example.com", phone: "+7 919 622-74-19", telegram: "@kate_pop" },
  { name: "Дарья Соколова", email: "daria.sokolova@example.com", phone: "+7 937 280-65-31", telegram: "@dasha_skl" },
  { name: "Полина Новикова", email: "polina.novikova@example.com", phone: "+7 905 318-49-77", telegram: "@polly_nv" },
  { name: "София Морозова", email: "sofia.morozova@example.com", phone: "+7 987 254-90-12", telegram: "@sofia_mrz" },
  { name: "Виктория Волкова", email: "victoria.volkova@example.com", phone: "+7 960 047-23-58", telegram: "@vika_vlk" },
  { name: "Дмитрий Лебедев", email: "dmitry.lebedev@example.com", phone: "+7 939 165-82-40", telegram: "@dlebedev" },
  { name: "Артём Козлов", email: "artem.kozlov@example.com", phone: "+7 977 503-61-29", telegram: "@artem_kzl" },
  { name: "Иван Соловьёв", email: "ivan.solovyov@example.com", phone: "+7 996 712-34-86", telegram: "@ivan_slv" },
];

// Starter services — used only when the Service table is empty (same guard as
// scripts/seed-services.ts). Kept in sync with that file.
const STARTER_SERVICES = [
  { name: "Прокол мочки уха", durationMin: 30, price: 2000, description: "Классический прокол мочки. Цена за одну мочку." },
  { name: "Прокол хеликса", durationMin: 40, price: 2800, description: "Прокол хряща уха (хеликс)." },
  { name: "Прокол носа (ноздря)", durationMin: 30, price: 2500, description: "Прокол крыла носа." },
  { name: "Прокол септума", durationMin: 40, price: 3200, description: "Прокол носовой перегородки." },
  { name: "Прокол брови", durationMin: 30, price: 2800, description: "Вертикальный или горизонтальный прокол брови." },
  { name: "Прокол губы (лабрет)", durationMin: 40, price: 2800, description: "Прокол губы — лабрет, медуза и др." },
  { name: "Прокол пупка", durationMin: 40, price: 3000, description: "Прокол пупка." },
  { name: "Консультация", durationMin: 20, price: 0, description: "Подбор места, украшения и ухода — без прокола." },
];

const NOTES_GENERAL = [
  "Первый прокол — попросить рассказать про уход.",
  "Постоянный клиент.",
  "Чувствительная кожа — только имплант-титан.",
  "Аллергия на никель.",
  "Просила подобрать золото 585.",
  "Хочет симметрию с уже имеющимся проколом.",
];
const NOTES_CANCELLED = [
  "Отмена по просьбе клиента.",
  "Перенос на другую дату.",
  "Клиент заболел.",
  "Не смогла прийти, перезапишется.",
];

// Appointment status → cascaded jewelry-booking status. Mirrors the cascades in
// lib/admin/appointment-actions.ts: CONFIRMED→CONFIRMED, COMPLETED→FULFILLED,
// CANCELLED→CANCELLED, PENDING→RESERVED. NO_SHOW has no cascade in the app, so
// the held piece stays CONFIRMED.
const BOOKING_STATUS_FOR: Record<AppointmentStatus, JewelryBookingStatus> = {
  PENDING: JewelryBookingStatus.RESERVED,
  CONFIRMED: JewelryBookingStatus.CONFIRMED,
  COMPLETED: JewelryBookingStatus.FULFILLED,
  CANCELLED: JewelryBookingStatus.CANCELLED,
  NO_SHOW: JewelryBookingStatus.CONFIRMED,
};

// ─────────────────────────────────────────────────────────────────────────────
// Reviews
// ─────────────────────────────────────────────────────────────────────────────

// Stamped into every seeded review's moderatorNotes so a re-run can find and
// delete the previous batch (even rows whose appointment was wiped + relinked
// to null by seedAppointments) without touching real / admin-made reviews.
const REVIEW_MARKER = "seed:demo-review";

const FEATURED_CAP = 6; // /about renders the top 6 PUBLISHED + featured

// 5★ reviews about the session / studio / master (no specific piece tagged).
const REVIEW_GENERAL_5 = [
  "Делала прокол мочек — всё прошло спокойно и аккуратно. Подробно рассказали про уход, совсем не болело. Спасибо!",
  "Очень внимательный мастер, стерильность на высоте. Каждый шаг объяснили, было совсем не страшно.",
  "Переколола хеликс после неудачного опыта в другом месте — здесь сделали ровно и без боли. Рекомендую!",
  "Уютная студия и приятная атмосфера. Прокол сделали быстро, заживает отлично уже вторую неделю.",
  "Спасибо за профессионализм! Помогли выбрать место под мой образ и ничего не навязывали.",
  "Чисто, аккуратно, всё по стандартам. Через месяц приду за вторым проколом.",
  "Боялась боли, но всё оказалось терпимо. Мастер поддерживал и комментировал каждый этап. Очень довольна.",
  "Записалась онлайн, пришла — и за полчаса всё сделали. Удобно и без нервов.",
  "Подобрали имплант-титан под чувствительную кожу, аллергии нет. Огромное спасибо!",
  "Заживление прошло без проблем, рекомендации по уходу очень помогли. Студия топ!",
];

// 5★ reviews focused on the jewelry itself (used when a piece is tagged).
const REVIEW_PIECE_5 = [
  "Украшение село идеально, смотрится дорого и аккуратно. Титан не вызывает раздражения.",
  "Очень довольна кольцом — блестит, держится надёжно, выглядит стильно.",
  "Лабрет с кристаллом — именно то, что хотела. Качество металла чувствуется сразу.",
  "Колечко аккуратное и невесомое, совсем не мешает. За месяц ни намёка на раздражение.",
  "Золото 585 вживую выглядит роскошно, на фото даже не передать. Очень рада!",
  "Гвоздик миниатюрный и элегантный, идеально подошёл к хеликсу.",
  "Кликер удобно снимать и надевать, посадка плотная. Беру второй на другую сторону.",
  "Материал приятный, никакого дискомфорта — украшение полностью оправдало ожидания.",
];

// 4★ — positive but with a small caveat.
const REVIEW_GOOD_4 = [
  "В целом всё понравилось: аккуратно и чисто. Немного подождала начала, но результат хороший.",
  "Хороший мастер, прокол ровный. Заживало чуть дольше, чем ожидала, но всё ок.",
  "Сделали аккуратно, украшение нравится. Снизила звезду только за небольшую очередь.",
  "Всё на уровне, придраться почти не к чему. Вернусь ещё.",
];

// 3★ — mixed.
const REVIEW_MIXED_3 = [
  "Сам прокол сделали нормально, но хотелось бы побольше деталей по уходу.",
  "Результатом довольна, хотя место немного сложно было найти. В остальном неплохо.",
  "Нормально, но ждала чуть большего. Заживает потихоньку.",
];

// Admin-manual testimonials (no appointment link → no verified badge), mirroring
// the "pasted from Instagram/Telegram" path in docs/16-reviews.md. The featured
// ones backfill the /about wall if the appointment-linked batch doesn't reach 6.
const MANUAL_REVIEWS: Array<{
  author: string;
  rating: number;
  featured: boolean;
  text: string;
}> = [
  { author: "Алина Г.", rating: 5, featured: true, text: "Лучшая студия в городе! Делаю здесь уже третий прокол — всегда стерильно и аккуратно." },
  { author: "Тимур Х.", rating: 5, featured: true, text: "Записался на септум — сделали ровно и быстро, подробно объяснили уход. Очень доволен." },
  { author: "Регина С.", rating: 5, featured: true, text: "Перенесла сюда все свои проколы. Мастера — настоящие профессионалы, украшения качественные." },
  { author: "Никита П.", rating: 4, featured: false, text: "Хороший сервис и приятная атмосфера. Прокол брови зажил без проблем." },
  { author: "Камилла Ю.", rating: 5, featured: false, text: "Спасибо за титановое украшение под чувствительную кожу — наконец-то без раздражения!" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Date helpers (server-local, matching combineDate in lib/admin/slot-actions.ts)
// ─────────────────────────────────────────────────────────────────────────────

/** 0=Mon … 6=Sun (ISO weekday minus 1) for a JS Date. */
function isoDow(d: Date): number {
  const js = d.getDay(); // 0=Sun … 6=Sat
  return js === 0 ? 6 : js - 1;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Public display name from a full name: first name + last initial ("Анна С.").
 *  Matches the privacy guidance in docs/16-reviews.md (no full surname public). */
function displayAuthor(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "Гость";
  const last = parts[1];
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

function overlaps(aS: Date, aE: Date, bS: Date, bE: Date): boolean {
  return aS < bE && aE > bS;
}

/** A plausible past weekday datetime within the work day, for cancelled /
 *  slot-less records (so their date isn't lost when there's no slot link). */
function randomPastWorkDatetime(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - randInt(2, PAST_DAYS));
  // Nudge onto a weekday.
  let guard = 0;
  while (!WORK_DAYS.has(isoDow(d)) && guard < 7) {
    d.setDate(d.getDate() - 1);
    guard++;
  }
  d.setHours(randInt(DAY_START_HOUR, DAY_END_HOUR - 1), 0, 0, 0);
  return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed steps
// ─────────────────────────────────────────────────────────────────────────────

async function seedSettings() {
  await prisma.settings.upsert({
    where: { id: "default" },
    update: {
      contactAddress: STUDIO.address,
      contactPhone: STUDIO.phone,
      workingHoursHint: STUDIO.workingHours,
    },
    create: {
      id: "default",
      contactAddress: STUDIO.address,
      contactPhone: STUDIO.phone,
      workingHoursHint: STUDIO.workingHours,
    },
  });
  console.log(`✓ Settings: contacts set (${STUDIO.address} · ${STUDIO.phone})`);
}

async function seedServices(): Promise<Array<{ id: string }>> {
  const count = await prisma.service.count();
  if (count === 0) {
    for (let i = 0; i < STARTER_SERVICES.length; i++) {
      const s = STARTER_SERVICES[i];
      await prisma.service.create({
        data: {
          name: s.name,
          description: s.description,
          price: s.price,
          durationMin: s.durationMin,
          order: i,
          published: true,
        },
      });
    }
    console.log(`✓ Services: created ${STARTER_SERVICES.length} starter rows`);
  } else {
    console.log(`✓ Services: ${count} already present — kept as-is`);
  }
  return prisma.service.findMany({ select: { id: true } });
}

/** Build all Mon–Fri hourly windows in [−PAST_DAYS, +FUTURE_DAYS] and create the
 *  ones that don't exist yet. Deterministic ids make re-runs no-ops; an overlap
 *  check skips any window that would collide with an admin-made slot. */
async function seedSlots(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const windowStart = new Date(today.getTime() - PAST_DAYS * DAY_MS);
  const windowEnd = new Date(today.getTime() + (FUTURE_DAYS + 1) * DAY_MS);

  type Candidate = { id: string; startsAt: Date; endsAt: Date };
  const candidates: Candidate[] = [];

  for (let offset = -PAST_DAYS; offset <= FUTURE_DAYS; offset++) {
    const day = new Date(today.getTime() + offset * DAY_MS);
    if (!WORK_DAYS.has(isoDow(day))) continue;
    for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h += SLOT_HOURS) {
      const startsAt = new Date(day);
      startsAt.setHours(h, 0, 0, 0);
      const endsAt = new Date(startsAt.getTime() + SLOT_HOURS * 60 * 60 * 1000);
      // Stable id keyed by local date+hour → idempotent across same-day re-runs.
      candidates.push({ id: `seed-slot-${ymd(startsAt)}-${String(h).padStart(2, "0")}`, startsAt, endsAt });
    }
  }

  // Existing slots in the window: skip our own ids (already present) and avoid
  // overlapping any non-seed (admin-made) window so the EXCLUDE constraint
  // (prisma/sql/001_slot_overlap_exclusion.sql) never rejects the insert.
  const existing = await prisma.availabilitySlot.findMany({
    where: { startsAt: { gte: windowStart, lt: windowEnd } },
    select: { id: true, startsAt: true, endsAt: true },
  });
  const existingIds = new Set(existing.map((e) => e.id));
  const occupied = existing.filter((e) => !e.id.startsWith("seed-slot-"));

  const toCreate = candidates.filter(
    (c) =>
      !existingIds.has(c.id) &&
      !occupied.some((o) => overlaps(c.startsAt, c.endsAt, o.startsAt, o.endsAt)),
  );

  if (toCreate.length > 0) {
    await prisma.availabilitySlot.createMany({
      data: toCreate.map((c) => ({
        id: c.id,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        isOpen: true,
      })),
      skipDuplicates: true,
    });
  }

  const futureCount = candidates.filter((c) => c.startsAt >= new Date()).length;
  console.log(
    `✓ Slots: ${candidates.length} windows (${futureCount} upcoming), ` +
      `${toCreate.length} newly created, ${candidates.length - toCreate.length} already present`,
  );
}

async function seedUsers(): Promise<Array<{ id: string; email: string }>> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const out: Array<{ id: string; email: string }> = [];
  for (const u of DEMO_USERS) {
    const row = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        phone: u.phone,
        telegram: u.telegram,
        passwordHash,
        isGuest: false,
      },
      create: {
        email: u.email,
        name: u.name,
        phone: u.phone,
        telegram: u.telegram,
        passwordHash,
        isGuest: false,
      },
      select: { id: true, email: true },
    });
    out.push(row);
  }
  console.log(
    `✓ Users: ${out.length} demo customers upserted (password "${DEMO_PASSWORD}")`,
  );
  return out;
}

/** Build a per-user status list that always spans all five statuses, then pads
 *  to `n` with a realistic weighting (history-heavy), shuffled. */
function buildStatusList(n: number): AppointmentStatus[] {
  const guaranteed: AppointmentStatus[] = [
    AppointmentStatus.COMPLETED,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.PENDING,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ];
  const weighted: AppointmentStatus[] = [
    AppointmentStatus.COMPLETED,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.PENDING,
    AppointmentStatus.PENDING,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ];
  const list = [...guaranteed];
  while (list.length < n) list.push(pick(weighted));
  return shuffle(list);
}

async function seedAppointments(
  users: Array<{ id: string; email: string }>,
  services: Array<{ id: string }>,
): Promise<void> {
  const userIds = users.map((u) => u.id);

  // ── Idempotency: wipe these demo users' history, then rebuild it. Deleting
  //    the appointments also frees the slots they held (slotId is on the
  //    appointment), so the slot pool below is accurate.
  await prisma.jewelryBooking.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.appointment.deleteMany({ where: { userId: { in: userIds } } });

  // Jewelry to (optionally) reserve. Any piece works for a demo booking; prefer
  // ones with stock so the data reads sensibly. Empty catalog ⇒ no bookings.
  const jewelry = await prisma.jewelry.findMany({
    select: { id: true },
    orderBy: { inStock: "desc" },
    take: 60,
  });

  // Free-slot pools (no live appointment), split by past/future.
  const now = new Date();
  const freeSlots = await prisma.availabilitySlot.findMany({
    where: { appointment: null },
    select: { id: true, startsAt: true, isOpen: true },
    orderBy: { startsAt: "asc" },
  });
  const pastPool = shuffle(freeSlots.filter((s) => s.startsAt < now));
  const futurePool = shuffle(
    freeSlots.filter((s) => s.startsAt >= now && s.isOpen),
  );

  let apptCount = 0;
  let bookingCount = 0;
  const statusTally: Record<string, number> = {};

  for (const user of users) {
    const n = randInt(6, 10);
    const statuses = buildStatusList(n);

    for (const status of statuses) {
      let slotId: string | null = null;
      let scheduledAt: Date | null = null;
      let baseDate: Date;

      if (status === "COMPLETED" || status === "NO_SHOW") {
        const slot = pastPool.pop();
        if (slot) {
          slotId = slot.id;
          baseDate = slot.startsAt;
        } else {
          baseDate = randomPastWorkDatetime();
          scheduledAt = baseDate; // no slot left → keep the date for display
        }
      } else if (status === "CONFIRMED" || status === "PENDING") {
        const slot = futurePool.pop();
        if (slot) {
          slotId = slot.id;
          baseDate = slot.startsAt;
        } else {
          baseDate = new Date(now.getTime() + randInt(1, FUTURE_DAYS) * DAY_MS);
        }
      } else {
        // CANCELLED — released its slot (slotId=null), date preserved via
        // scheduledAt, exactly like cancelAppointmentInTx leaves it.
        baseDate = randomPastWorkDatetime();
        scheduledAt = baseDate;
      }

      // Booked a few days before the visit.
      const createdAt = new Date(
        baseDate.getTime() - randInt(1, 10) * DAY_MS,
      );

      const serviceId =
        services.length > 0 && chance(0.9) ? pick(services).id : null;

      const note =
        status === "CANCELLED"
          ? pick(NOTES_CANCELLED)
          : chance(0.3)
            ? pick(NOTES_GENERAL)
            : null;

      // Optionally reserve 1–2 jewelry pieces, status cascaded to match.
      const bookingsCreate =
        jewelry.length > 0 && chance(0.45)
          ? sample(jewelry, randInt(1, 2)).map((j) => ({
              jewelryId: j.id,
              userId: user.id,
              status: BOOKING_STATUS_FOR[status],
              quantity: 1,
              createdAt,
            }))
          : [];

      await prisma.appointment.create({
        data: {
          userId: user.id,
          slotId,
          serviceId,
          status,
          notes: note,
          scheduledAt,
          createdAt,
          ...(bookingsCreate.length > 0
            ? { bookings: { create: bookingsCreate } }
            : {}),
        },
      });

      apptCount += 1;
      bookingCount += bookingsCreate.length;
      statusTally[status] = (statusTally[status] ?? 0) + 1;
    }
  }

  console.log(
    `✓ Appointments: ${apptCount} across ${users.length} users ` +
      `(${Object.entries(statusTally)
        .map(([k, v]) => `${k}:${v}`)
        .join(", ")})`,
  );
  console.log(`✓ JewelryBookings: ${bookingCount} reserved across appointments`);
}

/**
 * Seed customer reviews the way the real magic-link flow produces them
 * (lib/reviews/submit-action.ts): each review hangs off a COMPLETED
 * appointment (→ `appointmentId` set → "проверенный клиент" badge), tags the
 * jewelry actually booked on that visit (→ surfaces on /catalog/[id]), and
 * marks the appointment `reviewedAt` (the one-shot the form enforces).
 *
 * Statuses span the full moderation pipeline (PENDING / PUBLISHED / REJECTED)
 * with up to 6 PUBLISHED reviews featured for the /about wall. A few
 * admin-manual (non-verified) testimonials round out the set.
 *
 * Idempotent: every seeded row is stamped with REVIEW_MARKER in moderatorNotes,
 * so a re-run deletes the previous batch first — including rows orphaned when
 * seedAppointments() wiped their appointment (onDelete: SetNull).
 */
async function seedReviews(
  users: Array<{ id: string; email: string }>,
): Promise<void> {
  const userIds = users.map((u) => u.id);

  // Clear the previous seeded batch (linked + orphaned) before rebuilding.
  const wiped = await prisma.review.deleteMany({
    where: { moderatorNotes: { contains: REVIEW_MARKER } },
  });

  // COMPLETED visits are the realistic source of magic-link reviews.
  const completed = await prisma.appointment.findMany({
    where: { userId: { in: userIds }, status: "COMPLETED" },
    select: {
      id: true,
      createdAt: true,
      scheduledAt: true,
      slot: { select: { startsAt: true } },
      user: { select: { name: true } },
      bookings: { select: { jewelryId: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (completed.length === 0) {
    console.log("! Reviews: no COMPLETED appointments to attach to — skipped");
    return;
  }

  const tally: Record<"PENDING" | "PUBLISHED" | "REJECTED", number> = {
    PENDING: 0,
    PUBLISHED: 0,
    REJECTED: 0,
  };
  let created = 0;
  let featuredCount = 0;
  let taggedCount = 0;

  for (const appt of completed) {
    const jewelryIds = appt.bookings
      .map((b) => b.jewelryId)
      .filter((id): id is string => !!id);
    const hasJewelry = jewelryIds.length > 0;

    // Visits with a chosen piece almost always leave a review (the piece is
    // pre-selected in the form); others a bit less often.
    if (!chance(hasJewelry ? 0.9 : 0.65)) continue;

    // Rating: mostly 5, some 4, rare 3 — coherent with the text pools below.
    const rr = rand();
    const rating = rr < 0.7 ? 5 : rr < 0.92 ? 4 : 3;

    // Status: jewelry-tagged reviews skew PUBLISHED so /catalog/[id] is populated.
    const sr = rand();
    const status: "PENDING" | "PUBLISHED" | "REJECTED" = hasJewelry
      ? sr < 0.85
        ? "PUBLISHED"
        : sr < 0.95
          ? "PENDING"
          : "REJECTED"
      : sr < 0.7
        ? "PUBLISHED"
        : sr < 0.9
          ? "PENDING"
          : "REJECTED";

    const text =
      rating === 3
        ? pick(REVIEW_MIXED_3)
        : rating === 4
          ? pick(REVIEW_GOOD_4)
          : hasJewelry
            ? pick(REVIEW_PIECE_5)
            : pick(REVIEW_GENERAL_5);

    // Feature only strong, published reviews — capped for the /about wall.
    const featured =
      status === "PUBLISHED" &&
      rating === 5 &&
      featuredCount < FEATURED_CAP &&
      chance(0.6);

    const visitDate = appt.slot?.startsAt ?? appt.scheduledAt ?? appt.createdAt;
    const reviewCreatedAt = new Date(
      visitDate.getTime() + randInt(1, 7) * DAY_MS,
    );
    const publishedAt =
      status === "PUBLISHED"
        ? new Date(reviewCreatedAt.getTime() + randInt(0, 3) * DAY_MS)
        : null;

    const noteLead =
      status === "PUBLISHED"
        ? "Опубликовано."
        : status === "PENDING"
          ? "На модерации."
          : "Отклонено модератором.";

    await prisma.review.create({
      data: {
        rating,
        text,
        authorName: displayAuthor(appt.user.name),
        status,
        featured,
        moderatorNotes: `${noteLead} [${REVIEW_MARKER}]`,
        appointmentId: appt.id,
        publishedAt,
        createdAt: reviewCreatedAt,
        ...(hasJewelry
          ? { jewelryItems: { connect: jewelryIds.map((id) => ({ id })) } }
          : {}),
      },
    });

    // Mirror the real one-shot flow: any submission marks the visit reviewed.
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { reviewedAt: reviewCreatedAt },
    });

    created += 1;
    if (featured) featuredCount += 1;
    if (hasJewelry) taggedCount += 1;
    tally[status] += 1;
  }

  // Admin-manual testimonials (non-verified). Featured ones backfill /about.
  for (const m of MANUAL_REVIEWS) {
    const featured = m.featured && featuredCount < FEATURED_CAP;
    const createdAt = new Date(Date.now() - randInt(5, 40) * DAY_MS);
    await prisma.review.create({
      data: {
        rating: m.rating,
        text: m.text,
        authorName: m.author,
        status: "PUBLISHED",
        featured,
        moderatorNotes: `Добавлено вручную из соцсетей. [${REVIEW_MARKER}]`,
        publishedAt: createdAt,
        createdAt,
      },
    });
    created += 1;
    if (featured) featuredCount += 1;
    tally.PUBLISHED += 1;
  }

  console.log(
    `✓ Reviews: ${created} created ` +
      `(${tally.PUBLISHED} published, ${tally.PENDING} pending, ${tally.REJECTED} rejected; ` +
      `${featuredCount} featured, ${taggedCount} tagged to jewelry, ${MANUAL_REVIEWS.length} manual), ` +
      `${wiped.count} prior demo reviews cleared`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("→ Seeding demo data…\n");
  await seedSettings();
  const services = await seedServices();
  await seedSlots();
  const users = await seedUsers();
  await seedAppointments(users, services);
  await seedReviews(users);
  console.log("\n✓ Demo seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
