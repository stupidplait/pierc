"use server";

import { put, del } from "@vercel/blob";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/admin/auth-helpers";
import { isFaqCategoryKey } from "@/components/faq/faqData";
import {
  parseSettingsFormData,
  settingsFieldErrors,
  SETTINGS_VALIDATION_SUMMARY,
} from "@/lib/admin/settings-schema";
import {
  parseServiceFormData,
  serviceFieldErrors,
  parseFaqFormData,
  faqFieldErrors,
  CONTENT_VALIDATION_SUMMARY,
} from "@/lib/admin/content-schema";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export type ActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | undefined;

function revalidatePublic() {
  // Public pages that read CMS content. Revalidating after each mutation
  // keeps the public site immediately in sync with admin edits.
  revalidatePath("/about");
  revalidatePath("/services");
  revalidatePath("/faq");
  revalidatePath("/gallery");
  revalidatePath("/", "layout"); // header/footer read Settings
  revalidateTag("settings", { expire: 0 }); // /about contacts + JSON-LD cache
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
  revalidateTag("about", { expire: 0 }); // drop getAboutBody() cache now
  return { ok: true, message: "Сохранено" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export async function upsertService(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();
  // The drawer runs this same schema client-side first; the server re-validates
  // as the authority. Per-field errors flow back so the form can mark fields.
  const parsed = parseServiceFormData(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: CONTENT_VALIDATION_SUMMARY,
      fieldErrors: serviceFieldErrors(parsed.error),
    };
  }

  const { id, description, ...rest } = parsed.data;
  const data = { ...rest, description: description || null };

  if (id) {
    // `order` is owned by drag-to-reorder, so an edit never resets it.
    await prisma.service.update({ where: { id }, data });
  } else {
    const last = await prisma.service.findFirst({
      orderBy: { order: "desc" },
      select: { order: true },
    });
    await prisma.service.create({ data: { ...data, order: (last?.order ?? -1) + 1 } });
  }

  revalidatePath("/admin/content");
  revalidatePath("/services");
  revalidateTag("services", { expire: 0 }); // drop getPublishedServices() cache now
  return { ok: true, message: id ? "Услуга сохранена" : "Услуга добавлена" };
}

export async function reorderServices(ids: string[]): Promise<void> {
  await assertAdmin();
  await prisma.$transaction(
    ids.map((id, i) =>
      prisma.service.update({ where: { id }, data: { order: i } }),
    ),
  );
  revalidatePath("/admin/content");
  revalidatePath("/services");
  revalidateTag("services", { expire: 0 }); // drop getPublishedServices() cache now
}

export async function deleteService(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.service.delete({ where: { id } });
  revalidatePath("/admin/content");
  revalidatePath("/services");
  revalidateTag("services", { expire: 0 }); // drop getPublishedServices() cache now
}

// ─────────────────────────────────────────────────────────────────────────────
// FAQItem
// ─────────────────────────────────────────────────────────────────────────────

export async function upsertFaq(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();
  const parsed = parseFaqFormData(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: CONTENT_VALIDATION_SUMMARY,
      fieldErrors: faqFieldErrors(parsed.error),
    };
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
    const last = await prisma.fAQItem.findFirst({
      orderBy: { order: "desc" },
      select: { order: true },
    });
    await prisma.fAQItem.create({ data: { ...data, order: (last?.order ?? -1) + 1 } });
  }

  revalidatePath("/admin/content");
  revalidatePath("/faq");
  revalidateTag("faq", { expire: 0 }); // drop getPublishedFaqItems() cache now
  return { ok: true, message: id ? "Вопрос сохранён" : "Вопрос добавлен" };
}

export async function reorderFaq(ids: string[]): Promise<void> {
  await assertAdmin();
  await prisma.$transaction(
    ids.map((id, i) =>
      prisma.fAQItem.update({ where: { id }, data: { order: i } }),
    ),
  );
  revalidatePath("/admin/content");
  revalidatePath("/faq");
  revalidateTag("faq", { expire: 0 }); // drop getPublishedFaqItems() cache now
}

export async function deleteFaq(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.fAQItem.delete({ where: { id } });
  revalidatePath("/admin/content");
  revalidatePath("/faq");
  revalidateTag("faq", { expire: 0 }); // drop getPublishedFaqItems() cache now
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
  revalidateTag("gallery", { expire: 0 }); // drop getGalleryPhotos() cache now
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
  revalidateTag("gallery", { expire: 0 }); // drop getGalleryPhotos() cache now
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
  revalidateTag("gallery", { expire: 0 }); // drop getGalleryPhotos() cache now
}

export async function reorderGalleryPhotos(ids: string[]): Promise<void> {
  await assertAdmin();
  await prisma.$transaction(
    ids.map((id, i) =>
      prisma.galleryPhoto.update({ where: { id }, data: { order: i } }),
    ),
  );
  revalidatePath("/admin/content");
  revalidatePath("/gallery");
  revalidateTag("gallery", { expire: 0 }); // drop getGalleryPhotos() cache now
}

/**
 * Swap a photo's image file while keeping its row (caption, order, published).
 * Uploads the new blob, repoints the record, then best-effort deletes the old
 * blob so it doesn't linger toward the storage quota.
 */
export async function replaceGalleryPhoto(
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

  const id = String(formData.get("id") ?? "");
  const file = formData.get("file");
  if (!id) return { ok: false, error: "Фото не найдено" };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Выберите файл" };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Файл должен быть изображением" };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, error: "Размер файла > 8 МБ" };
  }

  const photo = await prisma.galleryPhoto.findUnique({ where: { id } });
  if (!photo) return { ok: false, error: "Фото не найдено" };

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `gallery/${Date.now()}-${safeName}`;
  const blob = await put(key, file, { access: "public", addRandomSuffix: false });

  const oldUrl = photo.url;
  await prisma.galleryPhoto.update({ where: { id }, data: { url: blob.url } });

  // Best-effort cleanup of the now-orphaned old blob (skip if it's the same key).
  if (oldUrl !== blob.url) {
    try {
      await del(oldUrl);
    } catch {
      // ignore — the row already points at the new blob
    }
  }

  revalidatePath("/admin/content");
  revalidatePath("/gallery");
  revalidateTag("gallery", { expire: 0 }); // drop getGalleryPhotos() cache now
  return { ok: true, message: "Фото заменено" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings (singleton)
// ─────────────────────────────────────────────────────────────────────────────

export async function updateSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();
  // The client runs this same schema before submitting; the server re-validates
  // as the authority (never trust the client). See lib/admin/settings-schema.ts.
  const parsed = parseSettingsFormData(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: SETTINGS_VALIDATION_SUMMARY,
      fieldErrors: settingsFieldErrors(parsed.error),
    };
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
