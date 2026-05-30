"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "./auth-helpers";
import { sendStatusChangeNotification } from "@/lib/notifications";

export type BookingActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string }
  | undefined;

const transitionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["confirm", "fulfill", "cancel"]),
  notify: z.preprocess(
    (v) => v === "on" || v === "true" || v === true,
    z.boolean(),
  ),
});

const NEXT_STATUS = {
  confirm: "CONFIRMED",
  fulfill: "FULFILLED",
  cancel: "CANCELLED",
} as const;

function revalidateForBookings(id?: string) {
  revalidatePath("/admin/bookings");
  if (id) revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin"); // dashboard counts
  revalidatePath("/catalog"); // stock changed
}

// ─────────────────────────────────────────────────────────────────────────────
// Transition: RESERVED → CONFIRMED → FULFILLED, or anywhere → CANCELLED.
// Restoring stock on cancel is atomic with the status update.
// ─────────────────────────────────────────────────────────────────────────────

export async function transitionBooking(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
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

  let restoredStock = false;

  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.jewelryBooking.findUnique({
        where: { id },
        select: { status: true, jewelryId: true },
      });
      if (!current) throw new Error("Бронирование не найдено");

      // Idempotent — same status, no-op.
      if (current.status === newStatus) return;

      // Reject illegal transitions (e.g. CANCELLED → CONFIRMED).
      if (
        current.status === "CANCELLED" ||
        current.status === "FULFILLED"
      ) {
        if (newStatus !== current.status) {
          throw new Error(
            `Нельзя изменить статус из «${current.status}» — действие закрыто.`,
          );
        }
      }
      if (action === "fulfill" && current.status !== "CONFIRMED") {
        throw new Error("Сначала подтвердите бронь.");
      }

      await tx.jewelryBooking.update({
        where: { id },
        data: { status: newStatus },
      });

      // Restore stock when transitioning to CANCELLED for the first time.
      // FULFILLED keeps stock decremented (the customer kept the piece).
      if (
        newStatus === "CANCELLED" &&
        current.status !== "CANCELLED"
      ) {
        await tx.jewelry.update({
          where: { id: current.jewelryId },
          data: { inStock: { increment: 1 } },
        });
        restoredStock = true;
      }
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Не удалось обновить статус",
    };
  }

  revalidateForBookings(id);

  if (notify) {
    after(async () => {
      try {
        await sendStatusChangeNotification({
          kind: "booking",
          id,
          newStatus,
        });
      } catch (e) {
        console.error("[admin] booking notify failed:", e);
      }
    });
  }

  return {
    ok: true,
    message: restoredStock
      ? "Статус обновлён. Остаток восстановлен."
      : "Статус обновлён.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Save admin notes on a booking (free-text, never sent to the client).
// ─────────────────────────────────────────────────────────────────────────────

const notesSchema = z.object({
  id: z.string().min(1),
  notes: z.string().trim().optional(),
});

export async function saveBookingNotes(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  await assertAdmin();
  const parsed = notesSchema.safeParse({
    id: formData.get("id"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Ошибка валидации" };

  await prisma.jewelryBooking.update({
    where: { id: parsed.data.id },
    data: { notes: parsed.data.notes ?? null },
  });
  revalidateForBookings(parsed.data.id);
  return { ok: true, message: "Заметка сохранена" };
}
