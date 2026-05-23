"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "./auth-helpers";
import { sendStatusChangeNotification } from "@/lib/notifications";

export type AppointmentActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string }
  | undefined;

const transitionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["confirm", "complete", "no_show", "cancel"]),
  notify: z.preprocess(
    (v) => v === "on" || v === "true" || v === true,
    z.boolean(),
  ),
});

const NEXT_STATUS = {
  confirm: "CONFIRMED",
  complete: "COMPLETED",
  no_show: "NO_SHOW",
  cancel: "CANCELLED",
} as const;

function revalidateForAppointments(id?: string) {
  revalidatePath("/admin/appointments");
  if (id) revalidatePath(`/admin/appointments/${id}`);
  revalidatePath("/admin/bookings"); // cascade may flip linked bookings
  revalidatePath("/admin");
  revalidatePath("/admin/slots"); // cancellation frees the slot
}

// ─────────────────────────────────────────────────────────────────────────────
// Transition: PENDING → CONFIRMED → COMPLETED / NO_SHOW, or anywhere → CANCELLED
//
// COMPLETED cascades all linked JewelryBookings to FULFILLED.
// CANCELLED does NOT auto-cancel linked bookings (per spec — admin chooses
// per booking). Cancellation frees the slot via the @unique relation.
// ─────────────────────────────────────────────────────────────────────────────

export async function transitionAppointment(
  _prev: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  await assertAdmin();
  const parsed = transitionSchema.safeParse({
    id: formData.get("id"),
    action: formData.get("action"),
    notify: formData.get("notify"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Не удалось распознать действие" };
  }
  const { id, action, notify } = parsed.data;
  const newStatus = NEXT_STATUS[action];

  let cascadedCount = 0;

  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.appointment.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!current) throw new Error("Запись не найдена");
      if (current.status === newStatus) return;

      // Lock down terminal states (already cancelled / completed / no_show).
      if (
        current.status === "CANCELLED" ||
        current.status === "COMPLETED" ||
        current.status === "NO_SHOW"
      ) {
        throw new Error(
          `Нельзя изменить статус из «${current.status}» — запись закрыта.`,
        );
      }
      if (action === "complete" && current.status !== "CONFIRMED") {
        throw new Error("Сначала подтвердите запись.");
      }
      if (action === "no_show" && current.status !== "CONFIRMED") {
        throw new Error("«Не явился» применимо только к подтверждённой записи.");
      }

      await tx.appointment.update({
        where: { id },
        data: { status: newStatus },
      });

      // Cascade COMPLETED → all linked active bookings become FULFILLED.
      if (newStatus === "COMPLETED") {
        const result = await tx.jewelryBooking.updateMany({
          where: {
            appointmentId: id,
            status: { in: ["RESERVED", "CONFIRMED"] },
          },
          data: { status: "FULFILLED" },
        });
        cascadedCount = result.count;
      }
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Не удалось обновить статус",
    };
  }

  revalidateForAppointments(id);

  if (notify) {
    after(async () => {
      try {
        await sendStatusChangeNotification({
          kind: "appointment",
          id,
          newStatus,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[admin] appointment notify failed:", e);
      }
    });
  }

  return {
    ok: true,
    message:
      newStatus === "COMPLETED" && cascadedCount > 0
        ? `Статус обновлён. ${cascadedCount} связанн${cascadedCount === 1 ? "ая бронь" : "ых броней"} выполнен${cascadedCount === 1 ? "а" : "ы"}.`
        : "Статус обновлён.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Save admin notes on an appointment.
// ─────────────────────────────────────────────────────────────────────────────

const notesSchema = z.object({
  id: z.string().min(1),
  notes: z.string().trim().optional(),
});

export async function saveAppointmentNotes(
  _prev: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  await assertAdmin();
  const parsed = notesSchema.safeParse({
    id: formData.get("id"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Ошибка валидации" };

  await prisma.appointment.update({
    where: { id: parsed.data.id },
    data: { notes: parsed.data.notes ?? null },
  });
  revalidateForAppointments(parsed.data.id);
  return { ok: true, message: "Заметка сохранена" };
}
