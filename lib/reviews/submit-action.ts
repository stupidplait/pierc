"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { verifyReviewToken } from "./token";

export type SubmitReviewState =
  | { ok: false; error: string }
  | undefined;

const submitSchema = z.object({
  token: z.string().min(1, "Ссылка не содержит токен."),
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().min(1, "Расскажите, как всё прошло."),
  authorName: z.string().trim().min(1, "Как вас представить?"),
  jewelryIds: z.array(z.string()).default([]),
});

const PHOTO_MAX_BYTES = 4 * 1024 * 1024;

/**
 * Magic-link review submission. Public — no auth required, but the
 * token is signed with AUTH_SECRET so it must come from a real
 * appointment-COMPLETED email. Once accepted, the appointment's
 * `reviewedAt` is set and the same token can no longer be reused.
 *
 * On success, redirects to /review/thanks. On any validation failure,
 * returns the action state so the client form can display it.
 */
export async function submitReviewFromMagicLink(
  _prev: SubmitReviewState,
  formData: FormData,
): Promise<SubmitReviewState> {
  // Throttle review submissions by IP to blunt spam against the magic-link form.
  const ip = await clientIp();
  const throttle = await rateLimit(`review:${ip}`, {
    limit: 5,
    windowMs: 10 * 60_000,
  });
  if (!throttle.ok) {
    return { ok: false, error: "Слишком много попыток. Попробуйте позже." };
  }

  const parsed = submitSchema.safeParse({
    token: formData.get("token"),
    rating: formData.get("rating") ?? "5",
    text: formData.get("text"),
    authorName: formData.get("authorName"),
    jewelryIds: ((): string[] => {
      const out: string[] = [];
      for (const v of formData.getAll("jewelryIds")) {
        const s = String(v);
        if (s) out.push(s);
      }
      return out;
    })(),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ошибка" };
  }

  const verification = await verifyReviewToken(parsed.data.token);
  if (!verification.ok) {
    return {
      ok: false,
      error:
        verification.reason === "expired"
          ? "Срок ссылки истёк. Свяжитесь со студией, чтобы получить новую."
          : "Ссылка недействительна. Откройте её из письма ещё раз.",
    };
  }
  const appointmentId = verification.appointmentId;

  // Re-load the appointment fresh to enforce one-shot submission.
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      reviewedAt: true,
      bookings: { select: { jewelryId: true } },
    },
  });
  if (!appointment) {
    return { ok: false, error: "Запись не найдена." };
  }
  if (appointment.reviewedAt) {
    return { ok: false, error: "Отзыв уже оставлен по этой ссылке." };
  }

  // Sanitize jewelryIds — only allow ones actually linked to the appointment.
  const allowedIds = new Set(
    appointment.bookings.map((b) => b.jewelryId).filter((id): id is string => !!id),
  );
  const safeJewelryIds = parsed.data.jewelryIds.filter((id) =>
    allowedIds.has(id),
  );

  // Optional photo — server-side validation mirrors the admin path.
  const file = formData.get("photo");
  let photoUrl: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return {
        ok: false,
        error: "Загрузка фото временно недоступна. Попробуйте без фото.",
      };
    }
    if (!file.type.startsWith("image/")) {
      return { ok: false, error: "Файл должен быть изображением." };
    }
    if (file.size > PHOTO_MAX_BYTES) {
      return {
        ok: false,
        error: `Размер файла превышает 4 МБ (получено ${(
          file.size /
          1024 /
          1024
        ).toFixed(1)} МБ).`,
      };
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `reviews/incoming/${Date.now()}-${safeName}`;
    const blob = await put(key, file, {
      access: "public",
      addRandomSuffix: true,
    });
    photoUrl = blob.url;
  }

  // Atomic: create review + flip reviewedAt. Single-use is now enforced at the
  // DB level by Review.appointmentId @unique — a concurrent second submission
  // (that slipped past the reviewedAt re-fetch above) fails with P2002, which
  // we translate to the same friendly "already reviewed" message.
  try {
    await prisma.$transaction(async (tx) => {
      await tx.review.create({
        data: {
          rating: parsed.data.rating,
          text: parsed.data.text,
          authorName: parsed.data.authorName,
          photoUrl,
          status: "PENDING",
          appointmentId,
          jewelryItems: {
            connect: safeJewelryIds.map((id) => ({ id })),
          },
        },
      });
      await tx.appointment.update({
        where: { id: appointmentId },
        data: { reviewedAt: new Date() },
      });
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { ok: false, error: "Отзыв уже оставлен по этой ссылке." };
    }
    throw err;
  }

  revalidatePath("/admin/reviews");
  redirect("/review/thanks");
}
