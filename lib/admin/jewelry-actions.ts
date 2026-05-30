"use server";

import { put, del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/admin/auth-helpers";
import { asPhotos, type JewelryPhoto } from "@/lib/jewelry/format";
import {
  ATTACH_RULES,
  fieldErrorsFromZod,
  parseJewelryFormData,
  VALIDATION_SUMMARY,
  type FieldErrors,
} from "@/lib/admin/jewelry-schema";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export type ActionState =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string; fieldErrors?: FieldErrors }
  | undefined;

function revalidateForJewelry(id?: string) {
  revalidatePath("/admin/jewelry");
  if (id) revalidatePath(`/admin/jewelry/${id}/edit`);
  revalidatePath("/catalog");
  if (id) revalidatePath(`/catalog/${id}`);
  revalidatePath("/", "layout"); // featured items affect the landing later
}

// ─────────────────────────────────────────────────────────────────────────────
// Upsert / delete
// ─────────────────────────────────────────────────────────────────────────────

export async function upsertJewelry(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();

  // Same schema the client runs for instant feedback — re-run here as the
  // authority (category deleted mid-edit, hand-forged POST, anchor-count rule).
  const parsed = parseJewelryFormData(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: VALIDATION_SUMMARY,
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const { id, anchorIds, ...rest } = parsed.data;

  // Anchor count is enforced inside the schema's superRefine; the rule still
  // drives binding semantics (compat-list vs ordered) below.
  const rule = ATTACH_RULES[rest.type];

  // For "compat-list" types: every row gets order=0 (interchangeable).
  // For "fixed" types: the array is treated as ordered (0=primary, 1=secondary).
  const bindingsCreate =
    rule.semantics === "compat-list"
      ? anchorIds.map((aid) => ({ anchorId: aid, order: 0 }))
      : anchorIds.map((aid, i) => ({ anchorId: aid, order: i }));

  const data = {
    name: rest.name,
    description: rest.description ?? null,
    categoryId: rest.categoryId,
    type: rest.type,
    material: rest.material,
    gauge: rest.gauge ?? null,
    size: rest.size ?? null,
    color: rest.color ?? null,
    stones: rest.stones ?? null,
    price: rest.price,
    inStock: rest.inStock,
    status: rest.status,
    featured: rest.featured,
  };

  let newId: string;
  if (id) {
    await prisma.jewelry.update({
      where: { id },
      data: {
        ...data,
        anchorBindings: {
          deleteMany: {},
          create: bindingsCreate,
        },
      },
    });
    newId = id;
  } else {
    const created = await prisma.jewelry.create({
      data: {
        ...data,
        photos: [],
        anchorBindings: { create: bindingsCreate },
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

// Creates a blank DRAFT row and jumps straight into the edit page, so photo +
// 3D-model upload (which need a persisted id) are available during "creation".
// An empty name marks the draft as never-saved — the admin list hides those and
// the edit page shows the "Новое украшение" title until the first save.
export async function createDraftJewelry(): Promise<void> {
  await assertAdmin();

  const category = await prisma.jewelryCategory.findFirst({
    orderBy: { order: "asc" },
    select: { id: true },
  });
  if (!category) {
    throw new Error(
      "Нет ни одной категории украшений — создайте категорию перед добавлением.",
    );
  }

  const draft = await prisma.jewelry.create({
    data: { name: "", categoryId: category.id, material: "", price: 0 },
    select: { id: true },
  });

  revalidateForJewelry(draft.id);
  redirect(`/admin/jewelry/${draft.id}/edit`);
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

/**
 * Promote a saved photo to the front of the list. The first photo is the
 * catalog cover (and the source for 3D auto-generation), so this is how the
 * studio chooses which shot represents the piece. No-op if the photo is gone
 * or already first.
 */
export async function setJewelryCoverPhoto(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const url = String(formData.get("url") ?? "");
  if (!id || !url) return;

  const jewelry = await prisma.jewelry.findUnique({
    where: { id },
    select: { photos: true },
  });
  if (!jewelry) return;

  const photos = asPhotos(jewelry.photos);
  const target = photos.find((p) => p.url === url);
  if (!target || photos[0]?.url === url) return;

  const reordered: JewelryPhoto[] = [
    target,
    ...photos.filter((p) => p.url !== url),
  ];

  await prisma.jewelry.update({
    where: { id },
    data: { photos: reordered as unknown as object },
  });

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

// ─────────────────────────────────────────────────────────────────────────────
// Sprite upload + remove (per-jewelry, transparent PNG for lite-mode try-on)
// ─────────────────────────────────────────────────────────────────────────────

const SPRITE_MAX_BYTES = 4 * 1024 * 1024; // 4 MB

export async function uploadJewelrySprite(
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
    return { ok: false, error: "Выберите PNG-файл" };
  }
  if (file.type !== "image/png" && !file.name.toLowerCase().endsWith(".png")) {
    return {
      ok: false,
      error: "Поддерживается только формат PNG (для прозрачного фона)",
    };
  }
  if (file.size > SPRITE_MAX_BYTES) {
    return {
      ok: false,
      error: `Размер файла превышает 4 МБ (получено ${(
        file.size /
        1024 /
        1024
      ).toFixed(1)} МБ)`,
    };
  }

  const jewelry = await prisma.jewelry.findUnique({
    where: { id },
    select: { spriteUrl: true },
  });
  if (!jewelry) return { ok: false, error: "Украшение не найдено" };

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `jewelry/${id}/sprite/${Date.now()}-${safeName}`;
  const blob = await put(key, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: "image/png",
  });

  // Best-effort cleanup of the previous sprite so we don't accumulate orphans.
  if (jewelry.spriteUrl) {
    try {
      await del(jewelry.spriteUrl);
    } catch {
      // ignore — orphan blob is acceptable
    }
  }

  await prisma.jewelry.update({
    where: { id },
    data: { spriteUrl: blob.url },
  });

  revalidateForJewelry(id);
  return { ok: true, message: "Спрайт загружен" };
}

export async function removeJewelrySprite(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const jewelry = await prisma.jewelry.findUnique({
    where: { id },
    select: { spriteUrl: true },
  });
  if (!jewelry?.spriteUrl) return;

  await prisma.jewelry.update({
    where: { id },
    data: { spriteUrl: null },
  });

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(jewelry.spriteUrl);
    } catch {
      // ignore
    }
  }

  revalidateForJewelry(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// AI-powered scale analysis and suggestions
// ─────────────────────────────────────────────────────────────────────────────

export interface ScaleAnalysisResult {
  ok: boolean;
  suggestedScale?: number;
  currentScale?: number;
  boundingBox?: {
    size: { x: number; y: number; z: number };
  };
  attachPoint?: { x: number; y: number; z: number } | null;
  confidence?: number;
  reasoning?: string;
  error?: string;
}

/**
 * Analyze a jewelry GLB and suggest optimal scale based on gauge/size fields.
 * Returns analysis data for display in the admin UI.
 */
export async function analyzeJewelryScale(
  jewelryId: string,
): Promise<ScaleAnalysisResult> {
  await assertAdmin();

  const jewelry = await prisma.jewelry.findUnique({
    where: { id: jewelryId },
    select: {
      glbUrl: true,
      glbScale: true,
      gauge: true,
      size: true,
      type: true,
    },
  });

  if (!jewelry?.glbUrl) {
    return { ok: false, error: "У украшения нет 3D-модели" };
  }

  try {
    // Use fast analyzer that doesn't load Three.js
    const { calculateScaleFromGlb } = await import("@/lib/admin/glb-scale-fast");
    const analysis = await calculateScaleFromGlb(jewelry.glbUrl, {
      gauge: jewelry.gauge,
      size: jewelry.size,
      type: jewelry.type,
    });

    if (!analysis.ok) {
      return { ok: false, error: analysis.error };
    }

    return {
      ok: true,
      suggestedScale: analysis.suggestedScale ?? undefined,
      currentScale: jewelry.glbScale,
      confidence: analysis.confidence,
      reasoning: analysis.reasoning,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Ошибка анализа модели",
    };
  }
}

/**
 * Apply suggested scale to a jewelry item.
 */
export async function applyJewelryScale(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();

  const id = String(formData.get("id") ?? "");
  const scaleStr = String(formData.get("scale") ?? "");

  if (!id) return { ok: false, error: "Не указан id украшения" };

  const scale = parseFloat(scaleStr);
  if (isNaN(scale) || scale <= 0 || scale > 100) {
    return { ok: false, error: "Некорректное значение масштаба" };
  }

  await prisma.jewelry.update({
    where: { id },
    data: { glbScale: scale },
  });

  revalidateForJewelry(id);
  return { ok: true, message: `Масштаб установлен: ${scale.toFixed(4)}` };
}
