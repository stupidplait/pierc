"use server";

import { put, del } from "@vercel/blob";
import { Prisma } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/admin/auth-helpers";
import { asPhotos, type JewelryPhoto } from "@/lib/jewelry/format";
import { fetchBlobBytes, BlobFetchError } from "@/lib/jewelry/blob-bytes";
import {
  ATTACH_RULES,
  fieldErrorsFromZod,
  parseJewelryFormData,
  VALIDATION_SUMMARY,
  type FieldErrors,
} from "@/lib/admin/jewelry-schema";
import { suggestScale, suggestScaleFromSizeM } from "@/lib/admin/glb-scale";
import {
  PARAMETRIC_SHAPES,
  type ParametricShape,
  type MaterialColor,
} from "@/lib/admin/parametric-shapes";

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
  revalidateTag("jewelry", { expire: 0 }); // drop getPublishedJewelry() cache now
  revalidatePath("/", "layout"); // featured items affect the landing later
}

/**
 * Load a model blob's bytes for a server-side mutation (orientation nudge, attach
 * picker, hybrid rebuild, scale analysis). Uses the resilient shared fetch
 * (lib/jewelry/blob-bytes.ts): it reuses the bytes the admin's preview just
 * streamed (same-process cache) and retries the transient Vercel Blob Security
 * Checkpoint instead of failing on the first 403. A naked `fetch(glbUrl)` here was
 * why the point-picker / rotate "Save" failed with "HTTP 403" — the blob host
 * challenges server-side fetches too, not just the browser. `noun` names the asset
 * in the error message (e.g. "модель", "ИИ-верх").
 */
async function loadGlbForMutation(
  url: string,
  noun = "модель",
): Promise<{ ok: true; buffer: ArrayBuffer } | { ok: false; error: string }> {
  try {
    // ≤3 retries × 600ms linear backoff ≈ 3.6s worst case — bounded so the action
    // stays under the serverless timeout; the cache hit (preview just loaded it)
    // makes the common case instant, so retries only run on an active checkpoint.
    const { body } = await fetchBlobBytes(url, { retries: 3, retryDelayMs: 600 });
    return { ok: true, buffer: body };
  } catch (err) {
    if (err instanceof BlobFetchError && err.checkpoint) {
      return {
        ok: false,
        error:
          "Хранилище моделей временно недоступно (анти-абуз защита Vercel Blob). Подождите несколько секунд и повторите.",
      };
    }
    const detail =
      err instanceof BlobFetchError && err.status != null
        ? `HTTP ${err.status}`
        : err instanceof Error
          ? err.message
          : "ошибка сети";
    return { ok: false, error: `Не удалось загрузить ${noun}: ${detail}` };
  }
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

  // The Jewelry→JewelryBooking relation is onDelete: Restrict to preserve booking
  // history, so deleting a piece referenced by ANY booking (even cancelled or
  // fulfilled) would throw a raw FK error → 500. Refuse up front with a friendly
  // message instead. Admins should unpublish/archive such pieces, not delete them.
  const bookingCount = await prisma.jewelryBooking.count({
    where: { jewelryId: id },
  });
  if (bookingCount > 0) {
    redirect("/admin/jewelry?error=has-bookings");
  }

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
      const suggestion = suggestScaleFromSizeM(sizeM, jewelry.gauge, jewelry.size);
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

// Parametric self-serve generation — build a finding's GLB from a form (gauge /
// length / diameter / material / gem) entirely server-side, no Blender. The
// builder (lib/admin/parametric-glb.ts) re-implements the 6 Blender shapes with
// three.js geometry, emitting a real-metre GLB with attach:* nodes + PBR, so it
// seats exactly like the Blender pieces (glbScale = 1). Compressed via the same
// optimizeGlb pass as a manual upload (no `normalize` → no AI reorient/quality gate).
export async function generateParametricJewelryGlb(
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

  const shape = String(formData.get("shape") ?? "");
  const materialColor = String(formData.get("materialColor") ?? "");

  const { buildParametricGlb, buildHybridGlb } = await import(
    "@/lib/admin/parametric-glb"
  );
  const def = PARAMETRIC_SHAPES.find((d) => d.shape === shape);
  if (!def) return { ok: false, error: "Неизвестная форма" };

  // Hybrid: fuse the piece's CURRENT (AI-generated) model onto the parametric
  // finding as the decorative top. Only post-type shapes have a top mount.
  const hybrid = String(formData.get("hybrid") ?? "") === "1";
  const HYBRID_SHAPES = new Set(["labret_stud", "nose_stud_l"]);

  // Pull only this shape's declared fields off the form, coercing numbers.
  const params: Record<string, number | string> = {};
  for (const f of def.fields) {
    const raw = formData.get(f.key);
    if (raw == null || raw === "") continue;
    if (f.kind === "number") {
      const n = Number(raw);
      if (Number.isFinite(n)) params[f.key] = n;
    } else {
      params[f.key] = String(raw);
    }
  }

  const jewelry = await prisma.jewelry.findUnique({
    where: { id },
    select: { glbUrl: true },
  });
  if (!jewelry) return { ok: false, error: "Украшение не найдено" };

  if (hybrid && !HYBRID_SHAPES.has(shape)) {
    return { ok: false, error: "ИИ-верх доступен только для лабрета и нострила." };
  }
  if (hybrid && !jewelry.glbUrl) {
    return {
      ok: false,
      error: "Сначала сгенерируйте ИИ-модель — она станет верхом для гибрида.",
    };
  }

  let bytes: Uint8Array;
  try {
    const input = {
      shape: shape as ParametricShape,
      materialColor: materialColor as MaterialColor,
      params,
    };
    let built: Uint8Array;
    if (hybrid) {
      const loaded = await loadGlbForMutation(jewelry.glbUrl!, "ИИ-верх");
      if (!loaded.ok) return { ok: false, error: loaded.error };
      built = await buildHybridGlb(input, loaded.buffer);
    } else {
      built = await buildParametricGlb(input);
    }
    const { optimizeGlb } = await import("@/lib/admin/glb-pipeline");
    const opt = await optimizeGlb(built);
    bytes = opt.bytes;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Не удалось построить модель",
    };
  }

  const key = `jewelry/${id}/models/${Date.now()}-${shape}.glb`;
  const blob = await put(key, Buffer.from(bytes), {
    access: "public",
    addRandomSuffix: false,
    contentType: "model/gltf-binary",
  });

  // Point at the new blob first, then drop the old one (never a dangling URL).
  const previousUrl = jewelry.glbUrl;
  await prisma.jewelry.update({
    where: { id },
    data: { glbUrl: blob.url, glbScale: 1 }, // parametric output is real-metre scale
  });
  if (previousUrl && previousUrl !== blob.url) {
    try {
      await del(previousUrl);
    } catch {
      /* orphan blob is acceptable; a dangling glbUrl is not */
    }
  }

  revalidateForJewelry(id);
  return {
    ok: true,
    message: hybrid
      ? "Гибрид (параметрическая основа + ИИ-верх) построен и опубликован."
      : "Параметрическая модель построена и опубликована.",
  };
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

  // Re-download the current model resiliently (shared cache + checkpoint retry) —
  // see loadGlbForMutation. A naked fetch here hit the blob host's 403 too.
  const loaded = await loadGlbForMutation(jewelry.glbUrl);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const buffer = loaded.buffer;

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
  revalidateTag("jewelry", { expire: 0 }); // drop getPublishedJewelry() cache now
  return { ok: true, message: "Ориентация сохранена" };
}

// Manual attach-point picker — bake an EXACT `attach:primary` position (the local
// point the admin clicked on the model in the preview) into the current model.
// The ultimate backstop when auto-placement (geometry / AI) put the point wrong:
// the admin clicks the real mount and it's fixed, no re-generation. Baked into the
// GLB so the renderer needs no change. See lib/admin/glb-pipeline.ts `setGlbAttachPoint`.
export async function setJewelryAttachPoint(
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();

  const id = String(formData.get("id") ?? "");
  const point: [number, number, number] = [
    Number(formData.get("x") ?? NaN),
    Number(formData.get("y") ?? NaN),
    Number(formData.get("z") ?? NaN),
  ];
  if (!id) return { ok: false, error: "Не указан id украшения" };
  if (!point.every(Number.isFinite)) {
    return { ok: false, error: "Некорректная точка крепления" };
  }
  // Which endpoint to set: primary by default, secondary for the other end of a
  // 2-anchor bar (BARBELL). Anything else falls back to primary.
  const name =
    String(formData.get("slot") ?? "primary") === "secondary"
      ? "attach:secondary"
      : "attach:primary";
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

  // Re-download the current model resiliently. The blob host challenges server-side
  // fetches too (anti-abuse 403), so this reuses the preview's cached bytes and
  // retries the checkpoint — a naked fetch here failed the "Save" with HTTP 403.
  const loaded = await loadGlbForMutation(jewelry.glbUrl);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const buffer = loaded.buffer;

  const { setGlbAttachPoint } = await import("@/lib/admin/glb-pipeline");
  let bytes: Uint8Array;
  try {
    bytes = await setGlbAttachPoint(buffer, point, name);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Не удалось задать точку",
    };
  }

  const key = `jewelry/${id}/models/${Date.now()}-attach.glb`;
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

  revalidatePath(`/admin/jewelry/${id}/edit`);
  revalidatePath("/catalog");
  revalidatePath(`/catalog/${id}`);
  revalidateTag("jewelry", { expire: 0 }); // drop getPublishedJewelry() cache now
  return { ok: true, message: "Точка крепления сохранена" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-(piece × anchor) orientation nudge — Layer 3 of the ring-orientation
// system. Stored on JewelryAnchorBinding.rotationOffset and applied in the
// piece's LOCAL frame by the renderer (place-jewelry.ts orientationForPiece).
// Unlike nudgeJewelryGlb (which bakes a roll into the GLB, identical at every
// anchor), this is scoped to ONE anchor — the escape hatch for an asymmetric
// hoop that needs to sit differently per piercing. Input is in DEGREES:
//   yDeg = yaw, zDeg = roll about the hole-axis, xDeg = pitch.
// ─────────────────────────────────────────────────────────────────────────────

export async function setBindingRotationOffset(
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();

  const jewelryId = String(formData.get("jewelryId") ?? "");
  const anchorId = String(formData.get("anchorId") ?? "");
  if (!jewelryId || !anchorId) {
    return { ok: false, error: "Не указан id украшения или точки" };
  }

  const deg = {
    x: Number(formData.get("xDeg") ?? 0),
    y: Number(formData.get("yDeg") ?? 0),
    z: Number(formData.get("zDeg") ?? 0),
  };
  if (![deg.x, deg.y, deg.z].every(Number.isFinite)) {
    return { ok: false, error: "Некорректный поворот" };
  }

  const D = Math.PI / 180;
  // All ≈0 → clear the override (back to the per-anchor ring default).
  const near0 =
    Math.abs(deg.x) < 0.01 && Math.abs(deg.y) < 0.01 && Math.abs(deg.z) < 0.01;

  const res = await prisma.jewelryAnchorBinding.updateMany({
    where: { jewelryId, anchorId },
    data: {
      rotationOffset: near0
        ? Prisma.DbNull
        : { x: deg.x * D, y: deg.y * D, z: deg.z * D },
    },
  });
  if (res.count === 0) {
    return { ok: false, error: "Эта точка не привязана к украшению" };
  }

  revalidateForJewelry(jewelryId);
  return {
    ok: true,
    message: near0 ? "Поворот сброшен" : "Поворот сохранён",
  };
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
    const loaded = await loadGlbForMutation(targetUrl);
    if (!loaded.ok) return { ok: false, error: loaded.error };
    const { measureGlbSizeM, measureRingBandM } = await import(
      "@/lib/admin/glb-pipeline"
    );
    const sizeM = await measureGlbSizeM(loaded.buffer);
    if (!sizeM) {
      return { ok: false, error: "Не удалось измерить геометрию модели" };
    }

    // Rings scale by the BAND diameter (a pendant/charm would inflate the bbox max
    // axis and shrink the ring); fall back to the bounding box for everything else.
    let suggestion = suggestScaleFromSizeM(sizeM, jewelry.gauge, jewelry.size);
    if (jewelry.type === "RING") {
      const band = await measureRingBandM(loaded.buffer);
      if (band) {
        const ringScale = suggestScale(
          {
            sizeDimMm: band.outerDiameterM * 1000,
            gaugeDimMm: band.tubeDiameterM * 1000,
          },
          jewelry.gauge,
          jewelry.size,
        );
        if (ringScale) suggestion = ringScale;
      }
    }

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
