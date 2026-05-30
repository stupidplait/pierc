"use server";

import { put, del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/admin/auth-helpers";
import { firstPhotoUrl, asPhotos } from "@/lib/jewelry/format";
import {
  getProvider,
  pickAutoProvider,
  pickNextAutoProvider,
} from "@/lib/three-gen";
import type { ProviderId } from "@/lib/three-gen";

// ─────────────────────────────────────────────────────────────────────────────
// Shared types + helpers
// ─────────────────────────────────────────────────────────────────────────────

export type ActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string }
  | undefined;

function revalidateForJewelry(id: string) {
  revalidatePath("/admin/jewelry");
  revalidatePath(`/admin/jewelry/${id}/edit`);
  revalidatePath("/catalog");
  revalidatePath(`/catalog/${id}`);
  revalidatePath("/", "layout");
}

/** Re-host an external GLB on our Vercel Blob so Tripo URL expiration
 *  doesn't surprise us later. */
async function rehostGlb(
  externalUrl: string,
  jewelryId: string,
): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "Vercel Blob не настроено. Установите BLOB_READ_WRITE_TOKEN в .env.",
    );
  }

  const res = await fetch(externalUrl);
  if (!res.ok) {
    throw new Error(
      `Не удалось скачать модель: HTTP ${res.status} ${res.statusText}`,
    );
  }
  const buffer = await res.arrayBuffer();
  const key = `jewelry/${jewelryId}/models/${Date.now()}-auto.glb`;
  const blob = await put(key, buffer, {
    access: "public",
    addRandomSuffix: false,
    contentType: "model/gltf-binary",
  });
  return blob.url;
}

// ─────────────────────────────────────────────────────────────────────────────
// Start a new generation
// ─────────────────────────────────────────────────────────────────────────────

export async function startJewelryGeneration(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Не указан id украшения" };

  const provider = pickAutoProvider();
  if (!provider) {
    return {
      ok: false,
      error:
        "Авто-генерация не настроена. Добавьте API-ключ провайдера в .env.",
    };
  }

  const jewelry = await prisma.jewelry.findUnique({
    where: { id },
    select: { id: true, photos: true, type: true },
  });
  if (!jewelry) return { ok: false, error: "Украшение не найдено" };

  // AI is restricted to single-anchor types — see docs/20-multi-anchor-jewelry.md
  // and docs/18-replicate-3d.md. Multi-anchor pieces (industrial bars,
  // horseshoes through 2 holes, …) need precise endpoint placement that AI
  // can't reliably produce; admin must use the parametric pipeline instead.
  if (jewelry.type !== "STUD" && jewelry.type !== "RING") {
    return {
      ok: false,
      error:
        "Авто-генерация доступна только для одноточечных украшений (STUD, RING). Для штанг и подков используйте параметрический пайплайн или загрузите .glb вручную.",
    };
  }

  // Refuse if a job is already in flight for this jewelry.
  const existing = await prisma.generationJob.findFirst({
    where: { jewelryId: id, status: "PROCESSING" },
  });
  if (existing) {
    return {
      ok: false,
      error:
        "Уже идёт генерация. Дождитесь её завершения или нажмите «Обновить статус».",
    };
  }

  const photoUrl = firstPhotoUrl(jewelry.photos);
  if (!photoUrl) {
    return {
      ok: false,
      error: "Сначала загрузите хотя бы одну фотографию украшения.",
    };
  }

  // Walk the auto chain. If the primary provider can't even start (down,
  // 401, rate-limited), automatically try the next one.
  let chosen = provider;
  let result = await chosen.start({ photoUrls: [photoUrl] });
  const errors: string[] = [];
  while (!result.ok) {
    errors.push(`${chosen.id}: ${result.error}`);
    const next = pickNextAutoProvider(chosen.id);
    if (!next) break;
    chosen = next;
    result = await chosen.start({ photoUrls: [photoUrl] });
  }
  if (!result.ok) {
    return {
      ok: false,
      error: `Все провайдеры отказали. ${errors.join(" | ")}`,
    };
  }
  const triedFallback = errors.length > 0;

  await prisma.generationJob.create({
    data: {
      jewelryId: id,
      provider: chosen.id,
      providerJobId: result.providerJobId,
      status: "PROCESSING",
      inputPhotos: jewelry.photos as object,
      startedAt: new Date(),
    },
  });

  // Reflect "in progress" on the jewelry too so the catalog doesn't surface
  // a draft mid-generation.
  await prisma.jewelry.update({
    where: { id },
    data: { status: "PROCESSING" },
  });

  revalidateForJewelry(id);
  return {
    ok: true,
    message: triedFallback
      ? `Основной провайдер не запустился (${errors.join(" | ")}). Задача отправлена в ${chosen.id}.`
      : `Задача отправлена в ${chosen.id}. Обычно занимает 1–3 минуты.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Poll the active job
// ─────────────────────────────────────────────────────────────────────────────

export async function pollJewelryJob(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();
  const jewelryId = String(formData.get("id") ?? "");
  if (!jewelryId) return { ok: false, error: "Не указан id украшения" };

  const job = await prisma.generationJob.findFirst({
    where: { jewelryId, status: "PROCESSING" },
    orderBy: { createdAt: "desc" },
  });
  if (!job) {
    return { ok: false, error: "Нет активной задачи генерации." };
  }
  if (!job.providerJobId) {
    return {
      ok: false,
      error: "У задачи нет provider_job_id — это локальная ошибка.",
    };
  }

  const provider = getProvider(job.provider as ProviderId);
  const result = await provider.poll(job.providerJobId);

  if (result.status === "PROCESSING") {
    return { ok: true, message: "Ещё идёт генерация…" };
  }

  if (result.status === "FAILED") {
    // Try the next provider in the auto chain before giving up.
    const next = pickNextAutoProvider(job.provider as ProviderId);
    if (next) {
      const photoUrls = asPhotos(job.inputPhotos).map((p) => p.url);
      const startResult = await next.start({ photoUrls });

      if (startResult.ok) {
        // Mark the current attempt as FAILED (preserves the audit trail)…
        await prisma.generationJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            errorMessage: result.errorMessage,
            completedAt: new Date(),
          },
        });
        // …and queue a fresh PROCESSING attempt against the next provider.
        await prisma.generationJob.create({
          data: {
            jewelryId,
            provider: next.id,
            providerJobId: startResult.providerJobId,
            status: "PROCESSING",
            inputPhotos: job.inputPhotos as object,
            startedAt: new Date(),
          },
        });
        // Jewelry status stays PROCESSING — admin sees a continuous flow.
        revalidateForJewelry(jewelryId);
        return {
          ok: true,
          message: `${job.provider} не справился: ${result.errorMessage}. Передаём задачу провайдеру ${next.id}.`,
        };
      }
      // Next provider also refused to start — fall through to terminal FAIL,
      // surfacing both errors so the admin sees the full picture.
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorMessage: `${result.errorMessage} (${next.id} тоже не запустился: ${startResult.error})`,
          completedAt: new Date(),
        },
      });
      await prisma.jewelry.update({
        where: { id: jewelryId },
        data: { status: "DRAFT" },
      });
      revalidateForJewelry(jewelryId);
      return {
        ok: false,
        error: `Все провайдеры отказали. ${result.errorMessage} | ${next.id}: ${startResult.error}`,
      };
    }

    // No fallback available — terminal failure.
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorMessage: result.errorMessage,
        completedAt: new Date(),
      },
    });
    await prisma.jewelry.update({
      where: { id: jewelryId },
      data: { status: "DRAFT" },
    });
    revalidateForJewelry(jewelryId);
    return {
      ok: false,
      error: `Генерация не удалась: ${result.errorMessage}`,
    };
  }

  // SUCCEEDED — re-host the GLB on our blob, then surface for admin review.
  let blobUrl: string;
  try {
    blobUrl = await rehostGlb(result.resultGlbUrl, jewelryId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Не удалось перенести модель";
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorMessage: msg,
        completedAt: new Date(),
      },
    });
    await prisma.jewelry.update({
      where: { id: jewelryId },
      data: { status: "DRAFT" },
    });
    revalidateForJewelry(jewelryId);
    return { ok: false, error: msg };
  }

  await prisma.generationJob.update({
    where: { id: job.id },
    data: {
      status: "SUCCEEDED",
      resultGlbUrl: blobUrl,
      completedAt: new Date(),
    },
  });
  await prisma.jewelry.update({
    where: { id: jewelryId },
    data: { status: "PENDING_REVIEW" },
  });

  revalidateForJewelry(jewelryId);
  return {
    ok: true,
    message: "Модель готова. Просмотрите и утвердите её ниже.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Approve a successful job — copy resultGlbUrl onto Jewelry.glbUrl
// ─────────────────────────────────────────────────────────────────────────────

export async function approveJewelryJob(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();
  const jobId = String(formData.get("jobId") ?? "");
  if (!jobId) return { ok: false, error: "Не указан id задачи" };

  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
    include: { jewelry: { select: { glbUrl: true } } },
  });
  if (!job || job.status !== "SUCCEEDED" || !job.resultGlbUrl) {
    return { ok: false, error: "Задача не готова к утверждению." };
  }

  // Replace any previous .glb (so we don't accumulate orphans).
  if (
    job.jewelry.glbUrl &&
    job.jewelry.glbUrl !== job.resultGlbUrl &&
    process.env.BLOB_READ_WRITE_TOKEN
  ) {
    try {
      await del(job.jewelry.glbUrl);
    } catch {
      /* best-effort cleanup */
    }
  }

  await prisma.jewelry.update({
    where: { id: job.jewelryId },
    data: {
      glbUrl: job.resultGlbUrl,
      status: "PUBLISHED",
    },
  });

  revalidateForJewelry(job.jewelryId);
  return { ok: true, message: "Модель опубликована в шоуруме." };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reject a successful job — discard the result (keep blob for now in case
// admin changes their mind; cleanup is an explicit later action).
// ─────────────────────────────────────────────────────────────────────────────

export async function rejectJewelryJob(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();
  const jobId = String(formData.get("jobId") ?? "");
  if (!jobId) return { ok: false, error: "Не указан id задачи" };

  const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
  if (!job) return { ok: false, error: "Задача не найдена" };

  // Drop the Tripo-generated blob since the admin doesn't want it.
  if (job.resultGlbUrl && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(job.resultGlbUrl);
    } catch {
      /* best-effort */
    }
  }

  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      errorMessage: "Отклонено администратором",
      resultGlbUrl: null,
    },
  });

  await prisma.jewelry.update({
    where: { id: job.jewelryId },
    data: { status: "REJECTED" },
  });

  revalidateForJewelry(job.jewelryId);
  return { ok: true, message: "Модель отклонена." };
}
