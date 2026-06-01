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
  // No success toast — the photo appearing in the grid is the feedback.
  return { ok: true };
}

/**
 * Add-page entry point: create the piece then attach the first photos in one
 * step.
 *
 * The /admin/jewelry/new editor persists nothing until a save, so a photo
 * dropped there has no row to attach to. The add-page dropzone submits the
 * editor form's current fields alongside the files; if they validate we create
 * a fully-populated piece (no data loss — this is what the studio expects after
 * filling the form), otherwise we fall back to a blank DRAFT for a true
 * photo-first drop. Either way we redirect into the piece's edit page where
 * photos, 3D and attributes all work normally. A draft that's never named is
 * reaped by the cleanup-drafts cron (empty `name` is its sentinel).
 */
export async function createDraftAndUploadPhotos(
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

  // Create the piece WITH whatever the studio already filled. The add-page
  // dropzone submits the editor form's fields alongside the files, so a piece
  // saved via a photo upload is fully populated — no silent blank record. Only
  // a true photo-first drop (empty/invalid fields) falls back to a blank DRAFT
  // (empty `name` is the abandoned-draft sentinel the cleanup cron keys off).
  const parsed = parseJewelryFormData(formData);

  let createData: Parameters<typeof prisma.jewelry.create>[0]["data"];
  if (parsed.success) {
    const { id: _id, anchorIds, ...rest } = parsed.data;
    const rule = ATTACH_RULES[rest.type];
    const bindingsCreate =
      rule.semantics === "compat-list"
        ? anchorIds.map((aid) => ({ anchorId: aid, order: 0 }))
        : anchorIds.map((aid, i) => ({ anchorId: aid, order: i }));
    createData = {
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
      photos: [],
      anchorBindings: { create: bindingsCreate },
    };
  } else {
    // The form failed validation. Distinguish a deliberate photo-first drop on a
    // BLANK form (→ blank DRAFT, the intended lazy-create) from a half-filled
    // form that just has an invalid/missing field (→ surface the errors and
    // create NOTHING). Silently minting a blank draft here discarded everything
    // the studio had typed — name, material, price, anchors — with no feedback.
    const startedFilling =
      String(formData.get("name") ?? "").trim() !== "" ||
      String(formData.get("material") ?? "").trim() !== "" ||
      String(formData.get("price") ?? "").trim() !== "" ||
      String(formData.get("inStock") ?? "").trim() !== "" ||
      formData.getAll("anchorIds").some((v) => String(v).trim() !== "");
    if (startedFilling) {
      return {
        ok: false,
        error: "Заполните обязательные поля карточки, затем загрузите фото.",
        fieldErrors: fieldErrorsFromZod(parsed.error),
      };
    }

    // A draft needs a category (FK). The new page only renders the editor when
    // at least one exists, but re-check here as the authority.
    const category = await prisma.jewelryCategory.findFirst({
      orderBy: { order: "asc" },
      select: { id: true },
    });
    if (!category) {
      return { ok: false, error: "Сначала создайте категорию украшений." };
    }
    createData = {
      name: "",
      categoryId: category.id,
      material: "",
      price: 0,
      photos: [],
    };
  }

  // Files validated above, so a bad upload never leaves a stray row behind.
  const draft = await prisma.jewelry.create({
    data: createData,
    select: { id: true },
  });

  const uploaded = await Promise.all(
    files.map(async (file) => {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `jewelry/${draft.id}/${Date.now()}-${safeName}`;
      const blob = await put(key, file, {
        access: "public",
        addRandomSuffix: false,
      });
      return { url: blob.url, alt: "" };
    }),
  );

  await prisma.jewelry.update({
    where: { id: draft.id },
    data: { photos: uploaded as unknown as object },
  });

  revalidateForJewelry(draft.id);
  // Continue editing on the draft's own page — the photos already show there.
  redirect(`/admin/jewelry/${draft.id}/edit`);
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
 * catalog cover (and the default 3D source when no photos are flagged for it),
 * so this is how the studio chooses which shot represents the piece. No-op if
 * the photo is gone or already first.
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

/**
 * Flip a photo's "include in 3D generation" flag. The flagged set is what
 * `genPhotoUrls` feeds the provider (falling back to the cover when none are
 * flagged). No-op if the photo is gone.
 */
export async function toggleJewelryPhotoGen(formData: FormData): Promise<void> {
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
  if (!photos.some((p) => p.url === url)) return;

  const next: JewelryPhoto[] = photos.map((p) =>
    p.url === url ? { ...p, gen: !p.gen } : p,
  );

  await prisma.jewelry.update({
    where: { id },
    data: { photos: next as unknown as object },
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
    select: { glbUrl: true, gauge: true, size: true },
  });
  if (!jewelry) return { ok: false, error: "Украшение не найдено" };

  // Optimize on upload (meshopt + WebP textures) so a hand-authored or
  // exported .glb is shrunk before it ever reaches the catalog. Best-effort:
  // falls back to the original bytes on failure. See lib/admin/glb-pipeline.ts.
  const buffer = await file.arrayBuffer();
  const { optimizeGlb, formatOptimizeDelta, measureGlbSizeM } =
    await import("@/lib/admin/glb-pipeline");
  const opt = await optimizeGlb(buffer);

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `jewelry/${id}/models/${Date.now()}-${safeName}`;
  const blob = await put(key, Buffer.from(opt.bytes), {
    access: "public",
    addRandomSuffix: false,
    contentType: "model/gltf-binary",
  });

  // Point the row at the NEW blob first, THEN delete the old one. If the delete
  // (or anything after) fails, glbUrl still references a blob that exists — never
  // a dangling URL that 404s in the catalog proxy.
  const previousUrl = jewelry.glbUrl;
  await prisma.jewelry.update({
    where: { id },
    data: { glbUrl: blob.url },
  });

  if (previousUrl && previousUrl !== blob.url) {
    try {
      await del(previousUrl);
    } catch {
      // ignore — orphan blob is acceptable; a dangling glbUrl is not
    }
  }

  // Auto-scale: a hand-authored / exported .glb arrives in arbitrary units, so
  // measure its real geometry and set glbScale automatically — the same
  // suggestion the scale panel offers. Best-effort, and only when the model is
  // clearly mis-scaled (ratio far from 1), so a model already authored in
  // real-world meters is left at the default and we never churn a write. The
  // admin can still recalc/override from the scale panel.
  let scaleNote = "";
  try {
    const sizeM = await measureGlbSizeM(opt.bytes);
    if (sizeM) {
      const suggestion = computeSuggestedScale(sizeM, jewelry.gauge, jewelry.size);
      if (
        suggestion &&
        suggestion.scale > 0 &&
        (suggestion.scale < 0.8 || suggestion.scale > 1.25)
      ) {
        await prisma.jewelry.update({
          where: { id },
          data: { glbScale: suggestion.scale },
        });
        scaleNote = ` Масштаб подобран автоматически: ${suggestion.scale.toFixed(4)}.`;
      }
    }
  } catch {
    /* best-effort — leave glbScale at its default */
  }

  revalidateForJewelry(id);
  return {
    ok: true,
    message:
      (opt.optimized
        ? `Модель загружена и оптимизирована: ${formatOptimizeDelta(opt)}`
        : "Модель загружена") + scaleNote,
  };
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

// Manual orientation nudge — bake the exact orientation the admin set by
// dragging/rolling the model in the preview (a quaternion) into the current
// model. The fallback when auto-placement got the pose wrong (or no Gemini key).
// Baked into the GLB (geometry + attach:primary) so the renderer needs no change.
// See lib/admin/glb-pipeline.ts `nudgeGlbOrientation`.
export async function nudgeJewelryGlb(
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();

  const id = String(formData.get("id") ?? "");
  const quat: [number, number, number, number] = [
    Number(formData.get("qx") ?? 0),
    Number(formData.get("qy") ?? 0),
    Number(formData.get("qz") ?? 0),
    Number(formData.get("qw") ?? 1),
  ];
  if (!id) return { ok: false, error: "Не указан id украшения" };
  if (!quat.every(Number.isFinite)) {
    return { ok: false, error: "Некорректная ориентация" };
  }
  // Identity (within tolerance) → nothing to bake. The client only saves when
  // there are changes, but guard so a no-op doesn't re-write the blob.
  const isIdentity =
    Math.abs(quat[0]) < 1e-4 &&
    Math.abs(quat[1]) < 1e-4 &&
    Math.abs(quat[2]) < 1e-4 &&
    Math.abs(Math.abs(quat[3]) - 1) < 1e-4;
  if (isIdentity) return { ok: true, message: "Без изменений" };
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      ok: false,
      error:
        "Хранилище Vercel Blob не настроено. Установите BLOB_READ_WRITE_TOKEN в .env.",
    };
  }

  const jewelry = await prisma.jewelry.findUnique({
    where: { id },
    select: { glbUrl: true },
  });
  if (!jewelry?.glbUrl)
    return { ok: false, error: "У украшения нет 3D-модели" };

  // Server-side fetch of our own blob — not subject to the cross-origin challenge
  // that blocks the browser (see lib/jewelry/glb-proxy.ts).
  const res = await fetch(jewelry.glbUrl);
  if (!res.ok) {
    return {
      ok: false,
      error: `Не удалось загрузить модель: HTTP ${res.status}`,
    };
  }
  const buffer = await res.arrayBuffer();

  const { nudgeGlbOrientation } = await import("@/lib/admin/glb-pipeline");
  let bytes: Uint8Array;
  try {
    bytes = await nudgeGlbOrientation(buffer, quat);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Не удалось повернуть модель",
    };
  }

  const key = `jewelry/${id}/models/${Date.now()}-nudge.glb`;
  const blob = await put(key, Buffer.from(bytes), {
    access: "public",
    addRandomSuffix: false,
    contentType: "model/gltf-binary",
  });

  // Update the pointer FIRST, then delete the old blob — never leave glbUrl
  // dangling (the prior delete-before-update order could 404 the catalog proxy).
  const previousUrl = jewelry.glbUrl;
  await prisma.jewelry.update({ where: { id }, data: { glbUrl: blob.url } });
  if (previousUrl !== blob.url) {
    try {
      await del(previousUrl);
    } catch {
      // ignore — orphan blob is acceptable; a dangling glbUrl is not
    }
  }

  // Scoped revalidation — just the edit page + catalog, NOT the root layout
  // (that full-tree revalidate is what made the panel flash/reload per click).
  revalidatePath(`/admin/jewelry/${id}/edit`);
  revalidatePath("/catalog");
  revalidatePath(`/catalog/${id}`);
  return { ok: true, message: "Ориентация сохранена" };
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
 * Pure scale suggestion from a measured GLB bounding box (meters) + the piece's
 * real-world gauge/size (mm). `glbScale` maps GLB units → meters so the model
 * lands at its real size: prefer overall `size` vs the largest dimension, fall
 * back to `gauge` (wire/post thickness) vs the thinnest. Returns null when
 * neither metadata field is usable. Shared by the analyzer and the auto-scale
 * applied on manual upload (`uploadJewelryGlb`).
 */
function computeSuggestedScale(
  sizeM: { x: number; y: number; z: number },
  gauge: number | null,
  size: number | null,
): { scale: number; confidence: number; reasoning: string } | null {
  const maxMm = Math.max(sizeM.x, sizeM.y, sizeM.z) * 1000;
  const minMm = Math.min(sizeM.x, sizeM.y, sizeM.z) * 1000;
  if (size && maxMm > 0.01) {
    return {
      scale: size / maxMm,
      confidence: 0.85,
      reasoning: `Модель ${maxMm.toFixed(1)}мм в GLB, должна быть ${size}мм.`,
    };
  }
  if (gauge && minMm > 0.01) {
    return {
      scale: gauge / minMm,
      confidence: 0.6,
      reasoning: `Толщина модели ${minMm.toFixed(1)}мм в GLB, должна быть ${gauge}мм.`,
    };
  }
  return null;
}

/**
 * Analyze a jewelry GLB and suggest optimal scale based on gauge/size fields.
 * Returns analysis data for display in the admin UI.
 */
export async function analyzeJewelryScale(
  jewelryId: string,
  candidateJobId?: string,
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
  if (!jewelry) return { ok: false, error: "Украшение не найдено" };

  // When reviewing a generated candidate, measure THAT model — not the currently
  // published one — so the suggestion matches what approving will publish. The
  // job is looked up server-side (never trust a client-supplied URL) and verified
  // to belong to this piece.
  let targetUrl = jewelry.glbUrl;
  if (candidateJobId) {
    const job = await prisma.generationJob.findUnique({
      where: { id: candidateJobId },
      select: { jewelryId: true, resultGlbUrl: true },
    });
    if (job?.jewelryId === jewelryId && job.resultGlbUrl) {
      targetUrl = job.resultGlbUrl;
    }
  }

  if (!targetUrl) {
    return { ok: false, error: "У украшения нет 3D-модели" };
  }

  try {
    // Measure the REAL bounding box via gltf-transform getBounds (applies the
    // KHR_mesh_quantization dequant scale). The old JSON-accessor parser read
    // quantized integers (~65535) on compressed models → nonsense km-scale sizes.
    const res = await fetch(targetUrl);
    if (!res.ok) {
      return {
        ok: false,
        error: `Не удалось загрузить модель: HTTP ${res.status}`,
      };
    }
    const { measureGlbSizeM } = await import("@/lib/admin/glb-pipeline");
    const sizeM = await measureGlbSizeM(await res.arrayBuffer());
    if (!sizeM) {
      return { ok: false, error: "Не удалось измерить геометрию модели" };
    }

    const suggestion = computeSuggestedScale(
      sizeM,
      jewelry.gauge,
      jewelry.size,
    );

    return {
      ok: true,
      suggestedScale: suggestion?.scale,
      currentScale: jewelry.glbScale,
      confidence: suggestion?.confidence ?? 0.3,
      reasoning:
        suggestion?.reasoning ??
        "Укажите размер (size) или толщину (gauge) украшения для точного расчёта масштаба.",
      boundingBox: { size: sizeM },
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
