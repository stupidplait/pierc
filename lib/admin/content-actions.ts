"use server";

import { put, del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/admin/auth-helpers";
import { isFaqCategoryKey } from "@/components/faq/faqData";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export type ActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string }
  | undefined;

function revalidatePublic() {
  // Public pages that read CMS content. Revalidating after each mutation
  // keeps the public site immediately in sync with admin edits.
  revalidatePath("/about");
  revalidatePath("/services");
  revalidatePath("/faq");
  revalidatePath("/gallery");
  revalidatePath("/", "layout"); // header/footer read Settings
}

// ─────────────────────────────────────────────────────────────────────────────
// SiteContent (about)
// ─────────────────────────────────────────────────────────────────────────────

const aboutSchema = z.object({ body: z.string().trim().min(1, "Текст не может быть пустым") });

export async function updateAbout(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();
  const parsed = aboutSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ошибка" };
  }

  await prisma.siteContent.upsert({
    where: { key: "about" },
    update: { content: { body: parsed.data.body } },
    create: { key: "about", content: { body: parsed.data.body } },
  });

  revalidatePath("/admin/content");
  revalidatePath("/about");
  return { ok: true, message: "Сохранено" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

const serviceSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Название обязательно"),
  description: z.string().trim().optional().or(z.literal("")),
  price: z.coerce.number().nonnegative("Цена не может быть отрицательной"),
  durationMin: z.coerce.number().int().positive("Длительность > 0"),
  order: z.coerce.number().int().default(0),
  published: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

export async function upsertService(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();
  const parsed = serviceSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price"),
    durationMin: formData.get("durationMin"),
    order: formData.get("order") ?? 0,
    published: formData.get("published"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ошибка" };
  }

  const { id, description, ...rest } = parsed.data;
  const data = { ...rest, description: description || null };

  if (id) {
    await prisma.service.update({ where: { id }, data });
  } else {
    await prisma.service.create({ data });
  }

  revalidatePath("/admin/content");
  revalidatePath("/services");
  return { ok: true, message: "Сохранено" };
}

export async function deleteService(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.service.delete({ where: { id } });
  revalidatePath("/admin/content");
  revalidatePath("/services");
}

// ─────────────────────────────────────────────────────────────────────────────
// FAQItem
// ─────────────────────────────────────────────────────────────────────────────

const faqSchema = z.object({
  id: z.string().optional(),
  question: z.string().trim().min(1, "Вопрос обязателен"),
  answer: z.string().trim().min(1, "Ответ обязателен"),
  order: z.coerce.number().int().default(0),
  published: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

export async function upsertFaq(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();
  const parsed = faqSchema.safeParse({
    id: formData.get("id") || undefined,
    question: formData.get("question"),
    answer: formData.get("answer"),
    order: formData.get("order") ?? 0,
    published: formData.get("published"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ошибка" };
  }

  // Category arrives as a raw key; keep it only if it's a known bucket,
  // otherwise store null (the page falls back to the keyword classifier).
  const rawCategory = String(formData.get("category") ?? "");
  const category = isFaqCategoryKey(rawCategory) ? rawCategory : null;

  const { id, ...rest } = parsed.data;
  const data = { ...rest, category };

  if (id) {
    await prisma.fAQItem.update({ where: { id }, data });
  } else {
    await prisma.fAQItem.create({ data });
  }

  revalidatePath("/admin/content");
  revalidatePath("/faq");
  return { ok: true, message: "Сохранено" };
}

export async function deleteFaq(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.fAQItem.delete({ where: { id } });
  revalidatePath("/admin/content");
  revalidatePath("/faq");
}

// ─────────────────────────────────────────────────────────────────────────────
// GalleryPhoto (with Vercel Blob upload)
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadGalleryPhoto(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      ok: false,
      error:
        "Хранилище Vercel Blob не настроено. Установите BLOB_READ_WRITE_TOKEN в .env.",
    };
  }

  const file = formData.get("file");
  const caption = String(formData.get("caption") ?? "").trim() || null;

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Выберите файл" };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Файл должен быть изображением" };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, error: "Размер файла > 8 МБ" };
  }

  // Sanitize filename to avoid path injections in the blob key.
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `gallery/${Date.now()}-${safeName}`;

  const blob = await put(key, file, {
    access: "public",
    addRandomSuffix: false,
  });

  const last = await prisma.galleryPhoto.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });

  await prisma.galleryPhoto.create({
    data: {
      url: blob.url,
      caption,
      order: (last?.order ?? -1) + 1,
      published: true,
    },
  });

  revalidatePath("/admin/content");
  revalidatePath("/gallery");
  return { ok: true, message: "Загружено" };
}

export async function deleteGalleryPhoto(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const photo = await prisma.galleryPhoto.findUnique({ where: { id } });
  if (!photo) return;

  await prisma.galleryPhoto.delete({ where: { id } });

  // Best-effort blob cleanup. We don't surface errors because the DB row is
  // already gone — orphaned blobs can be cleaned up later if needed.
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(photo.url);
    } catch {
      // ignore
    }
  }

  revalidatePath("/admin/content");
  revalidatePath("/gallery");
}

const galleryUpdateSchema = z.object({
  id: z.string().min(1),
  caption: z.string().trim().optional().or(z.literal("")),
  order: z.coerce.number().int().default(0),
  published: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

export async function updateGalleryPhoto(formData: FormData): Promise<void> {
  await assertAdmin();
  const parsed = galleryUpdateSchema.safeParse({
    id: formData.get("id"),
    caption: formData.get("caption"),
    order: formData.get("order") ?? 0,
    published: formData.get("published"),
  });
  if (!parsed.success) return;

  const { id, caption, ...rest } = parsed.data;
  await prisma.galleryPhoto.update({
    where: { id },
    data: { ...rest, caption: caption || null },
  });

  revalidatePath("/admin/content");
  revalidatePath("/gallery");
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings (singleton)
// ─────────────────────────────────────────────────────────────────────────────

const settingsSchema = z.object({
  contactEmail: z.string().trim().optional().or(z.literal("")),
  contactPhone: z.string().trim().optional().or(z.literal("")),
  contactAddress: z.string().trim().optional().or(z.literal("")),
  instagramUrl: z.string().trim().optional().or(z.literal("")),
  telegramUrl: z.string().trim().optional().or(z.literal("")),
  telegramChatId: z.string().trim().optional().or(z.literal("")),
  workingHoursHint: z.string().trim().optional().or(z.literal("")),
});

export async function updateSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();
  const parsed = settingsSchema.safeParse({
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone"),
    contactAddress: formData.get("contactAddress"),
    instagramUrl: formData.get("instagramUrl"),
    telegramUrl: formData.get("telegramUrl"),
    telegramChatId: formData.get("telegramChatId"),
    workingHoursHint: formData.get("workingHoursHint"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ошибка" };
  }

  // Empty strings -> null so the public side renders placeholders cleanly.
  const data = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v ? String(v) : null]),
  );

  await prisma.settings.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
  });

  revalidatePath("/admin/settings");
  revalidatePublic();
  return { ok: true, message: "Сохранено" };
}
