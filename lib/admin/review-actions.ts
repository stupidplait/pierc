"use server";

import { put, del } from "@vercel/blob";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/admin/auth-helpers";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export type ReviewActionState =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string }
  | undefined;

function emptyToUndef(v: FormDataEntryValue | null): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length === 0 ? undefined : s;
}

function revalidateForReviews(id?: string, jewelryIds: string[] = []) {
  revalidatePath("/admin/reviews");
  if (id) revalidatePath(`/admin/reviews/${id}/edit`);
  // Public surfaces that might render this review.
  revalidatePath("/about");
  revalidateTag("reviews", { expire: 0 }); // drop getFeaturedTestimonials() cache
  for (const jid of jewelryIds) {
    revalidatePath(`/catalog/${jid}`);
  }
}

const STATUSES = ["PENDING", "PUBLISHED", "REJECTED"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Upsert / delete
// ─────────────────────────────────────────────────────────────────────────────

const reviewSchema = z.object({
  id: z.string().optional(),
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().min(1, "Текст отзыва обязателен"),
  authorName: z.string().trim().min(1, "Имя обязательно"),
  appointmentId: z.string().optional(),
  status: z.enum(STATUSES),
  featured: z.preprocess((v) => v === "on" || v === true, z.boolean()),
  moderatorNotes: z.string().trim().optional(),
  jewelryIds: z.array(z.string()).default([]),
});

export async function upsertReview(
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  await assertAdmin();

  const parsed = reviewSchema.safeParse({
    id: formData.get("id") || undefined,
    rating: formData.get("rating") ?? "5",
    text: formData.get("text"),
    authorName: formData.get("authorName"),
    appointmentId: emptyToUndef(formData.get("appointmentId")),
    status: formData.get("status") ?? "PENDING",
    featured: formData.get("featured"),
    moderatorNotes: emptyToUndef(formData.get("moderatorNotes")),
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

  const { id, jewelryIds, ...rest } = parsed.data;

  const wasPublished = id
    ? (await prisma.review.findUnique({ where: { id }, select: { status: true } }))?.status === "PUBLISHED"
    : false;
  const isPublished = rest.status === "PUBLISHED";

  // Set publishedAt the first time a review transitions into PUBLISHED.
  // Subsequent edits while published preserve the original publishedAt.
  const publishedAtUpdate =
    isPublished && !wasPublished
      ? { publishedAt: new Date() }
      : rest.status !== "PUBLISHED"
        ? { publishedAt: null }
        : {};

  const data = {
    rating: rest.rating,
    text: rest.text,
    authorName: rest.authorName,
    appointmentId: rest.appointmentId ?? null,
    status: rest.status,
    featured: rest.featured,
    moderatorNotes: rest.moderatorNotes ?? null,
    ...publishedAtUpdate,
  };

  let newId: string;
  if (id) {
    await prisma.review.update({
      where: { id },
      data: {
        ...data,
        jewelryItems: { set: jewelryIds.map((jid) => ({ id: jid })) },
      },
    });
    newId = id;
  } else {
    const created = await prisma.review.create({
      data: {
        ...data,
        jewelryItems: { connect: jewelryIds.map((jid) => ({ id: jid })) },
      },
    });
    newId = created.id;
  }

  revalidateForReviews(newId, jewelryIds);

  if (!id) {
    redirect(`/admin/reviews/${newId}/edit`);
  }
  return { ok: true, message: "Сохранено", id: newId };
}

export async function deleteReview(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const review = await prisma.review.findUnique({
    where: { id },
    include: { jewelryItems: { select: { id: true } } },
  });
  if (!review) return;

  await prisma.review.delete({ where: { id } });

  if (review.photoUrl && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(review.photoUrl);
    } catch {
      // ignore
    }
  }

  revalidateForReviews(
    undefined,
    review.jewelryItems.map((j) => j.id),
  );
  redirect("/admin/reviews");
}

// ─────────────────────────────────────────────────────────────────────────────
// Transition (one-click approve / reject from the list view)
// ─────────────────────────────────────────────────────────────────────────────

const transitionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["approve", "reject", "unpublish"]),
});

export async function transitionReview(formData: FormData): Promise<void> {
  await assertAdmin();

  const parsed = transitionSchema.safeParse({
    id: formData.get("id"),
    action: formData.get("action"),
  });
  if (!parsed.success) return;

  const { id, action } = parsed.data;
  const existing = await prisma.review.findUnique({
    where: { id },
    include: { jewelryItems: { select: { id: true } } },
  });
  if (!existing) return;

  const data: { status: "PENDING" | "PUBLISHED" | "REJECTED"; publishedAt?: Date | null } =
    action === "approve"
      ? { status: "PUBLISHED", publishedAt: existing.publishedAt ?? new Date() }
      : action === "reject"
        ? { status: "REJECTED", publishedAt: null }
        : { status: "PENDING", publishedAt: null };

  await prisma.review.update({ where: { id }, data });
  revalidateForReviews(
    id,
    existing.jewelryItems.map((j) => j.id),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Photo upload + remove
// ─────────────────────────────────────────────────────────────────────────────

const PHOTO_MAX_BYTES = 4 * 1024 * 1024; // 4 MB

export async function uploadReviewPhoto(
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  await assertAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Не указан id отзыва" };

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      ok: false,
      error:
        "Хранилище Vercel Blob не настроено. Установите BLOB_READ_WRITE_TOKEN в .env.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Выберите файл" };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Файл должен быть изображением" };
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return {
      ok: false,
      error: `Размер файла превышает 4 МБ (получено ${(
        file.size /
        1024 /
        1024
      ).toFixed(1)} МБ)`,
    };
  }

  const review = await prisma.review.findUnique({
    where: { id },
    include: { jewelryItems: { select: { id: true } } },
  });
  if (!review) return { ok: false, error: "Отзыв не найден" };

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `reviews/${id}/${Date.now()}-${safeName}`;
  const blob = await put(key, file, {
    access: "public",
    addRandomSuffix: false,
  });

  // Best-effort cleanup of the previous photo so we don't accumulate orphans.
  if (review.photoUrl) {
    try {
      await del(review.photoUrl);
    } catch {
      // ignore
    }
  }

  await prisma.review.update({
    where: { id },
    data: { photoUrl: blob.url },
  });

  revalidateForReviews(
    id,
    review.jewelryItems.map((j) => j.id),
  );
  return { ok: true, message: "Фото загружено" };
}

export async function removeReviewPhoto(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const review = await prisma.review.findUnique({
    where: { id },
    include: { jewelryItems: { select: { id: true } } },
  });
  if (!review?.photoUrl) return;

  await prisma.review.update({
    where: { id },
    data: { photoUrl: null },
  });

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(review.photoUrl);
    } catch {
      // ignore
    }
  }

  revalidateForReviews(
    id,
    review.jewelryItems.map((j) => j.id),
  );
}
