"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendBookingNotifications } from "@/lib/notifications";

// ─────────────────────────────────────────────────────────────────────────────
// Input validation
// ─────────────────────────────────────────────────────────────────────────────

const bookingSchema = z
  .object({
    purpose: z.enum(["appointment", "jewelry", "both"]),
    items: z.string().optional(), // "id1,id2,id3"
    serviceId: z.string().optional(),
    slotId: z.string().optional(),
    name: z.string().trim().min(1, "Укажите имя"),
    email: z.string().trim().email("Укажите корректный email"),
    phone: z.string().trim().min(3, "Укажите телефон"),
    notes: z.string().trim().optional(),
  })
  .superRefine((v, ctx) => {
    const itemIds: string[] = [];
    for (const s of (v.items ?? "").split(",")) {
      const t = s.trim();
      if (t) itemIds.push(t);
    }

    if ((v.purpose === "appointment" || v.purpose === "both") && !v.slotId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Выберите время",
        path: ["slotId"],
      });
    }
    if ((v.purpose === "jewelry" || v.purpose === "both") && itemIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Выберите хотя бы одно украшение",
        path: ["items"],
      });
    }
  });

export type BookingActionState =
  | { ok: true }
  | { ok: false; error: string }
  | undefined;

// ─────────────────────────────────────────────────────────────────────────────
// createBooking — single server action that handles all three flows atomically.
//
// On success, redirects to /book/success?ids=<bookingIds>&apt=<appointmentId>.
// On failure, throws back to the client with a friendly RU message.
// ─────────────────────────────────────────────────────────────────────────────

export async function createBooking(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const parsed = bookingSchema.safeParse({
    purpose: formData.get("purpose"),
    items: formData.get("items") ?? "",
    serviceId: formData.get("serviceId") || undefined,
    slotId: formData.get("slotId") || undefined,
    // Coalesce required text fields so an absent field yields the friendly RU
    // validation message ("Укажите имя") instead of a raw Zod null error.
    name: (formData.get("name") ?? "").toString(),
    email: (formData.get("email") ?? "").toString(),
    phone: (formData.get("phone") ?? "").toString(),
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте данные формы",
    };
  }
  const { purpose, name, email, phone, notes, slotId, serviceId } = parsed.data;
  const itemIds: string[] = [];
  for (const s of (parsed.data.items ?? "").split(",")) {
    const t = s.trim();
    if (t) itemIds.push(t);
  }

  let appointmentId: string | null = null;
  let bookingIds: string[] = [];
  let userId: string | null = null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // ── Upsert user. Always treat as guest in v1 — public auth is Task 9. ──
      const user = await tx.user.upsert({
        where: { email },
        update: {
          // Don't clobber a real (non-guest) user's profile; only fill empties.
          name: name,
          phone: phone,
        },
        create: {
          email,
          name,
          phone,
          isGuest: true,
        },
      });

      // ── Create appointment if needed. Slot uniqueness is enforced at DB
      //    level by Appointment.slotId @unique — concurrent attempts will
      //    surface as P2002 here.
      let apt: { id: string } | null = null;
      if (purpose === "appointment" || purpose === "both") {
        if (!slotId) throw new BookingError("Выберите время");
        // Verify slot is open + not yet booked.
        const slot = await tx.availabilitySlot.findUnique({
          where: { id: slotId },
          include: { appointment: { select: { id: true } } },
        });
        if (!slot || !slot.isOpen) {
          throw new BookingError("Это окно недоступно для брони");
        }
        if (slot.appointment) {
          throw new BookingError("Это окно уже забронировали. Выберите другое.");
        }
        apt = await tx.appointment.create({
          data: {
            userId: user.id,
            slotId,
            serviceId: serviceId ?? null,
            status: "PENDING",
            notes: notes ?? null,
          },
          select: { id: true },
        });
      }

      // ── Decrement stock + create JewelryBooking rows. ──
      const createdBookingIds: string[] = [];
      if (purpose === "jewelry" || purpose === "both") {
        for (const jewelryId of itemIds) {
          // Atomic decrement via updateMany — the WHERE clause guarantees we
          // only succeed when stock is still > 0 at update time. Postgres
          // re-evaluates predicates under row lock, so two concurrent calls
          // can't both pass.
          const updated = await tx.jewelry.updateMany({
            where: {
              id: jewelryId,
              status: "PUBLISHED",
              inStock: { gte: 1 },
            },
            data: { inStock: { decrement: 1 } },
          });
          if (updated.count === 0) {
            const j = await tx.jewelry.findUnique({
              where: { id: jewelryId },
              select: { name: true },
            });
            throw new BookingError(
              `«${j?.name ?? "Украшение"}» закончилось — выберите другое.`,
            );
          }

          const booking = await tx.jewelryBooking.create({
            data: {
              jewelryId,
              userId: user.id,
              appointmentId: apt?.id ?? null,
              status: "RESERVED",
            },
            select: { id: true },
          });
          createdBookingIds.push(booking.id);
        }
      }

      return {
        userId: user.id,
        appointmentId: apt?.id ?? null,
        bookingIds: createdBookingIds,
      };
    });

    appointmentId = result.appointmentId;
    bookingIds = result.bookingIds;
    userId = result.userId;
  } catch (err) {
    if (err instanceof BookingError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002: unique constraint (slot already booked, race-condition lost).
      if (err.code === "P2002") {
        return {
          ok: false,
          error: "Это окно уже забронировали. Выберите другое.",
        };
      }
    }
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Не удалось оформить бронь. Попробуйте ещё раз.",
    };
  }

  // Revalidate surfaces that show stock / slots / bookings.
  revalidatePath("/catalog");
  revalidatePath("/book");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/appointments");
  revalidatePath("/admin/slots");

  // Fire notifications after the response is sent — they don't block the
  // user's redirect to /book/success and don't fail the booking if
  // Resend/Telegram are misconfigured. See lib/notifications/index.ts.
  if (userId) {
    const notifyInput = { userId, appointmentId, bookingIds };
    after(async () => {
      try {
        const result = await sendBookingNotifications(notifyInput);
        console.log("[booking] notifications:", result);
      } catch (err) {
        console.error("[booking] notification dispatch failed:", err);
      }
    });
  }

  // Build success URL with the created ids so the confirmation page can
  // render a summary without re-fetching everything.
  const params = new URLSearchParams();
  if (appointmentId) params.set("apt", appointmentId);
  if (bookingIds.length > 0) params.set("ids", bookingIds.join(","));
  redirect(`/book/success?${params.toString()}`);
}

// Sentinel for friendly business-rule failures inside the transaction.
class BookingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingError";
  }
}
