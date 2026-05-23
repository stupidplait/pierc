"use server";

import { put, del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/admin/auth-helpers";
import { asPhotos, type JewelryPhoto } from "@/lib/jewelry/format";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export type ActionState =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string }
  | undefined;

function revalidateForJewelry(id?: string) {
  revalidatePath("/admin/jewelry");
  if (id) revalidatePath(`/admin/jewelry/${id}/edit`);
  revalidatePath("/catalog");
  if (id) revalidatePath(`/catalog/${id}`);
  revalidatePath("/", "layout"); // featured items affect the landing later
}

// Strip empty strings -> undefined so optional fields stay null in DB.
function emptyToUndef(v: FormDataEntryValue | null): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length === 0 ? undefined : s;
}

const STATUSES = [
  "DRAFT",
  "PROCESSING",
  "PENDING_REVIEW",
  "PUBLISHED",
  "REJECTED",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Upsert / delete
// ─────────────────────────────────────────────────────────────────────────────

const jewelrySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Название обязательно"),
  description: z.string().trim().optional(),
  categoryId: z.string().min(1, "Выберите категорию"),
  material: z.string().trim().min(1, "Материал обязателен"),
  gauge: z
    .preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().positive().optional()),
  size: z
    .preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().positive().optional()),
  color: z.string().trim().optional(),
  stones: z.string().trim().optional(),
  price: z.coerce.number().nonnegative("Цена не может быть отрицательной"),
  inStock: z.coerce.number().int().nonnegative("Остаток >= 0"),
  glbUrl: z.string().trim().optional(),
  glbThumbUrl: z.string().trim().optional(),
  status: z.enum(STATUSES),
  featured: z.preprocess((v) => v === "on" || v === true, z.boolean()),
  anchorIds: z.array(z.string()).default([]),
});

export async function upsertJewelry(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();

  const parsed = jewelrySchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    description: emptyToUndef(formData.get("description")),
    categoryId: formData.get("categoryId"),
    material: formData.get("material"),
    gauge: formData.get("gauge"),
    size: formData.get("size"),
    color: emptyToUndef(formData.get("color")),
    stones: emptyToUndef(formData.get("stones")),
    price: formData.get("price"),
    inStock: formData.get("inStock"),
    glbUrl: emptyToUndef(formData.get("glbUrl")),
    glbThumbUrl: emptyToUndef(formData.get("glbThumbUrl")),
    status: formData.get("status") ?? "DRAFT",
    featured: formData.get("featured"),
    anchorIds: ((): string[] => {
      const out: string[] = [];
      for (const v of formData.getAll("anchorIds")) {
        const s = String(v);
        if (s) out.push(s);
      }
      return out;
    })(),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ошибка" };
  }

  const { id, anchorIds, ...rest } = parsed.data;
  const data = {
    name: rest.name,
    description: rest.description ?? null,
    categoryId: rest.categoryId,
    material: rest.material,
    gauge: rest.gauge ?? null,
    size: rest.size ?? null,
    color: rest.color ?? null,
    stones: rest.stones ?? null,
    price: rest.price,
    inStock: rest.inStock,
    glbUrl: rest.glbUrl ?? null,
    glbThumbUrl: rest.glbThumbUrl ?? null,
    status: rest.status,
    featured: rest.featured,
  };

  let newId: string;
  if (id) {
    await prisma.jewelry.update({
      where: { id },
      data: {
        ...data,
        anchors: { set: anchorIds.map((aid) => ({ id: aid })) },
      },
    });
    newId = id;
  } else {
    const created = await prisma.jewelry.create({
      data: {
        ...data,
        photos: [],
        anchors: { connect: anchorIds.map((aid) => ({ id: aid })) },
      },
    });
    newId = created.id;
  }

  revalidateForJewelry(newId);

  if (!id) {
    // Redirect to the edit page so the admin can immediately upload photos.
    redirect(`/admin/jewelry/${newId}/edit`);
  }
  return { ok: true, message: "Сохранено", id: newId };
}

export async function deleteJewelry(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const jewelry = await prisma.jewelry.findUnique({ where: { id } });
  if (!jewelry) return;

  await prisma.jewelry.delete({ where: { id } });

  // Best-effort cleanup of associated blob photos.
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const photos = asPhotos(jewelry.photos);
    await Promise.allSettled(photos.map((p) => del(p.url)));
  }

  revalidateForJewelry();
  redirect("/admin/jewelry");
}

// ─────────────────────────────────────────────────────────────────────────────
// Photo upload + remove (per-jewelry)
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadJewelryPhotos(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Не указан id украшения" };

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      ok: false,
      error:
        "Хранилище Vercel Blob не настроено. Установите BLOB_READ_WRITE_TOKEN в .env.",
    };
  }

  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, error: "Выберите файл" };

  for (const f of files) {
    if (!f.type.startsWith("image/")) {
      return { ok: false, error: `Файл не изображение: ${f.name}` };
    }
    if (f.size > 8 * 1024 * 1024) {
      return { ok: false, error: `Размер > 8 МБ: ${f.name}` };
    }
  }

  const jewelry = await prisma.jewelry.findUnique({
    where: { id },
    select: { photos: true },
  });
  if (!jewelry) return { ok: false, error: "Украшение не найдено" };

  const uploaded = await Promise.all(
    files.map(async (file) => {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `jewelry/${id}/${Date.now()}-${safeName}`;
      const blob = await put(key, file, {
        access: "public",
        addRandomSuffix: false,
      });
      return { url: blob.url, alt: "" };
    }),
  );

  const next: JewelryPhoto[] = [...asPhotos(jewelry.photos), ...uploaded];
  await prisma.jewelry.update({
    where: { id },
    data: { photos: next as unknown as object },
  });

  revalidateForJewelry(id);
  return { ok: true, message: "Загружено" };
}

export async function removeJewelryPhoto(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const url = String(formData.get("url") ?? "");
  if (!id || !url) return;

  const jewelry = await prisma.jewelry.findUnique({
    where: { id },
    select: { photos: true },
  });
  if (!jewelry) return;

  const filtered = asPhotos(jewelry.photos).filter((p) => p.url !== url);

  await prisma.jewelry.update({
    where: { id },
    data: { photos: filtered as unknown as object },
  });

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(url);
    } catch {
      // ignore — orphan-blob is acceptable
    }
  }

  revalidateForJewelry(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D model upload (manual path — bypasses GenerationJob)
// ─────────────────────────────────────────────────────────────────────────────

const GLB_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export async function uploadJewelryGlb(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Не указан id украшения" };

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      ok: false,
      error:
        "Хранилище Vercel Blob не настроено. Установите BLOB_READ_WRITE_TOKEN в .env.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Выберите .glb-файл" };
  }
  if (!file.name.toLowerCase().endsWith(".glb")) {
    return { ok: false, error: "Поддерживается только формат .glb" };
  }
  if (file.size > GLB_MAX_BYTES) {
    return {
      ok: false,
      error: `Размер файла превышает 25 МБ (получено ${(
        file.size /
        1024 /
        1024
      ).toFixed(1)} МБ)`,
    };
  }

  const jewelry = await prisma.jewelry.findUnique({
    where: { id },
    select: { glbUrl: true },
  });
  if (!jewelry) return { ok: false, error: "Украшение не найдено" };

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `jewelry/${id}/models/${Date.now()}-${safeName}`;
  const blob = await put(key, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: "model/gltf-binary",
  });

  // Best-effort cleanup of the previous .glb so we don't accumulate orphans.
  if (jewelry.glbUrl) {
    try {
      await del(jewelry.glbUrl);
    } catch {
      // ignore
    }
  }

  await prisma.jewelry.update({
    where: { id },
    data: { glbUrl: blob.url },
  });

  revalidateForJewelry(id);
  return { ok: true, message: "Модель загружена" };
}

export async function removeJewelryGlb(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const jewelry = await prisma.jewelry.findUnique({
    where: { id },
    select: { glbUrl: true },
  });
  if (!jewelry?.glbUrl) return;

  await prisma.jewelry.update({
    where: { id },
    data: { glbUrl: null },
  });

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(jewelry.glbUrl);
    } catch {
      // ignore
    }
  }

  revalidateForJewelry(id);
}
