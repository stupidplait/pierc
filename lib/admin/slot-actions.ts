"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/admin/auth-helpers";

export type SlotActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string }
  | undefined;

function revalidateForSlots() {
  revalidatePath("/admin/slots");
  revalidatePath("/book");
}

// ─────────────────────────────────────────────────────────────────────────────
// Create — single slot at a time. Bulk-create deferred to a later polish task.
// ─────────────────────────────────────────────────────────────────────────────

const createSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Неверная дата"),
    start: z.string().regex(/^\d{2}:\d{2}$/, "Неверное время начала"),
    end: z.string().regex(/^\d{2}:\d{2}$/, "Неверное время окончания"),
    isOpen: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  })
  .refine(
    (v) => combineDate(v.date, v.start) < combineDate(v.date, v.end),
    { message: "Окончание должно быть позже начала", path: ["end"] },
  );

function combineDate(date: string, time: string): Date {
  // ISO local time — timezone of the server (Vercel UTC by default).
  // Studio operators in v1 are expected to be in one zone; add Settings.tz later.
  return new Date(`${date}T${time}:00`);
}

export async function createSlot(
  _prev: SlotActionState,
  formData: FormData,
): Promise<SlotActionState> {
  await assertAdmin();
  const parsed = createSchema.safeParse({
    date: formData.get("date"),
    start: formData.get("start"),
    end: formData.get("end"),
    isOpen: formData.get("isOpen"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ошибка" };
  }
  const { date, start, end, isOpen } = parsed.data;
  const startsAt = combineDate(date, start);
  const endsAt = combineDate(date, end);
  // Reject overlap with any existing window.
  const conflict = await prisma.availabilitySlot.findFirst({
    where: { startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
    select: { id: true },
  });
  if (conflict) {
    return { ok: false, error: "Окно пересекается с существующим" };
  }
  await prisma.availabilitySlot.create({ data: { startsAt, endsAt, isOpen } });
  revalidateForSlots();
  return { ok: true, message: "Слот создан" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk create — the primary path for monthly planning. Iterates the date
// range, generates slots on each matching day-of-week between `start` and
// `end` of `slotMin` minutes each, then dedupes against existing slots by
// startsAt so re-running the same form is idempotent.
// ─────────────────────────────────────────────────────────────────────────────

const HHMM = /^\d{2}:\d{2}$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

const bulkSchema = z
  .object({
    from: z.string().regex(YMD, "Неверная дата начала"),
    to: z.string().regex(YMD, "Неверная дата окончания"),
    // Day-of-week (0=Mon..6=Sun, ISO weekday minus 1).
    days: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Выберите хотя бы один день"),
    start: z.string().regex(HHMM, "Неверное время начала"),
    end: z.string().regex(HHMM, "Неверное время окончания"),
    slotMin: z.coerce.number().int().min(15, "Минимум 15 минут").max(480, "Максимум 8 часов"),
    isOpen: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  })
  .refine(
    (v) => combineDate(v.from, v.start) <= combineDate(v.to, v.start),
    { message: "Дата окончания раньше начала", path: ["to"] },
  )
  .refine(
    (v) => combineDate(v.from, v.start) < combineDate(v.from, v.end),
    { message: "Часы заданы неверно: окончание раньше начала", path: ["end"] },
  );

export type BulkSlotState =
  | { ok: true; created: number; skipped: number }
  | { ok: false; error: string }
  | undefined;

export async function bulkCreateSlots(
  _prev: BulkSlotState,
  formData: FormData,
): Promise<BulkSlotState> {
  await assertAdmin();

  const parsed = bulkSchema.safeParse({
    from: formData.get("from"),
    to: formData.get("to"),
    days: formData.getAll("days"),
    start: formData.get("start"),
    end: formData.get("end"),
    slotMin: formData.get("slotMin"),
    isOpen: formData.get("isOpen"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ошибка" };
  }
  const { from, to, days, start, end, slotMin, isOpen } = parsed.data;

  // Generate (startsAt, endsAt) tuples for every matching day in [from, to].
  const candidates: { startsAt: Date; endsAt: Date }[] = [];
  const dayCursor = new Date(from + "T00:00:00");
  const last = new Date(to + "T00:00:00");
  const daysSet = new Set(days);
  // Cap at 366 iterations defensively.
  let safety = 0;
  while (dayCursor <= last && safety < 400) {
    safety++;
    // 0=Sun..6=Sat → re-map to 0=Mon..6=Sun.
    const jsDow = dayCursor.getDay();
    const isoDow = jsDow === 0 ? 6 : jsDow - 1;
    if (daysSet.has(isoDow)) {
      const dateKey = `${dayCursor.getFullYear()}-${String(dayCursor.getMonth() + 1).padStart(2, "0")}-${String(dayCursor.getDate()).padStart(2, "0")}`;
      const dayStart = combineDate(dateKey, start);
      const dayEnd = combineDate(dateKey, end);
      for (
        let t = dayStart.getTime();
        t + slotMin * 60_000 <= dayEnd.getTime();
        t += slotMin * 60_000
      ) {
        candidates.push({
          startsAt: new Date(t),
          endsAt: new Date(t + slotMin * 60_000),
        });
      }
    }
    dayCursor.setDate(dayCursor.getDate() + 1);
  }

  if (candidates.length === 0) {
    return { ok: false, error: "В выбранном диапазоне нет ни одного окна" };
  }
  if (candidates.length > 500) {
    return {
      ok: false,
      error: `Слишком много окон (${candidates.length}) — сократите диапазон или дни.`,
    };
  }

  // Skip candidates that overlap an existing slot — windows must never
  // intersect. Fetch every slot touching the candidate span, then filter by
  // the half-open overlap test `existing.start < cand.end && existing.end >
  // cand.start`. (Generated candidates are contiguous, so they never overlap
  // each other.)
  const spanStart = candidates[0].startsAt;
  let spanEnd = candidates[0].endsAt;
  for (const c of candidates) if (c.endsAt > spanEnd) spanEnd = c.endsAt;
  const existing = await prisma.availabilitySlot.findMany({
    where: { startsAt: { lt: spanEnd }, endsAt: { gt: spanStart } },
    select: { startsAt: true, endsAt: true },
  });
  const fresh = candidates.filter(
    (c) => !existing.some((e) => e.startsAt < c.endsAt && e.endsAt > c.startsAt),
  );

  if (fresh.length === 0) {
    revalidateForSlots();
    return { ok: true, created: 0, skipped: candidates.length };
  }

  await prisma.availabilitySlot.createMany({
    data: fresh.map((c) => ({
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      isOpen,
    })),
  });

  revalidateForSlots();
  return {
    ok: true,
    created: fresh.length,
    skipped: candidates.length - fresh.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Toggle open / closed
// ─────────────────────────────────────────────────────────────────────────────

export async function toggleSlotOpen(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const slot = await prisma.availabilitySlot.findUnique({
    where: { id },
    select: { isOpen: true },
  });
  if (!slot) return;
  await prisma.availabilitySlot.update({
    where: { id },
    data: { isOpen: !slot.isOpen },
  });
  revalidateForSlots();
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk update — powers the per-day "⋯" menu (open all / close free / delete
// free) and any future multi-select. `open`/`close` flip `isOpen`; `delete`
// removes the given slots but refuses any that carry a live appointment (the
// same guard `deleteSlot` enforces), so a stray booked id can never be dropped.
// ─────────────────────────────────────────────────────────────────────────────

export async function bulkUpdateSlots(
  ids: string[],
  op: "open" | "close" | "delete",
): Promise<void> {
  await assertAdmin();
  const clean = ids.filter((id) => typeof id === "string" && id.length > 0);
  if (clean.length === 0) return;

  if (op === "delete") {
    // Only delete slots with no live (non-cancelled) appointment.
    const deletable = await prisma.availabilitySlot.findMany({
      where: {
        id: { in: clean },
        OR: [{ appointment: null }, { appointment: { status: "CANCELLED" } }],
      },
      select: { id: true },
    });
    if (deletable.length > 0) {
      await prisma.availabilitySlot.deleteMany({
        where: { id: { in: deletable.map((s) => s.id) } },
      });
    }
  } else {
    await prisma.availabilitySlot.updateMany({
      where: { id: { in: clean } },
      data: { isOpen: op === "open" },
    });
  }
  revalidateForSlots();
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete (refuses if a non-cancelled appointment is attached)
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteSlot(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const slot = await prisma.availabilitySlot.findUnique({
    where: { id },
    include: { appointment: { select: { status: true } } },
  });
  if (!slot) return;
  if (slot.appointment && slot.appointment.status !== "CANCELLED") {
    // Caller (the admin list page) already shows a "cantDelete" hint; the
    // form action just no-ops in that case.
    return;
  }
  await prisma.availabilitySlot.delete({ where: { id } });
  revalidateForSlots();
}
