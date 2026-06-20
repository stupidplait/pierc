"use server";

import { put, del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/admin/auth-helpers";
import { firstPhotoUrl, asPhotos, genPhotoUrls } from "@/lib/jewelry/format";
import { isAiGeneratableType } from "@/lib/catalog/types";
import {
  getProvider,
  pickAutoProvider,
  pickNextAutoProvider,
} from "@/lib/three-gen";
import type { ProviderId } from "@/lib/three-gen";
import { safeAssetFetch } from "@/lib/security/safe-fetch";
import type { QualityVerdict } from "@/lib/admin/glb-quality-vision";

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
 *  doesn't surprise us later. Optimizes the model on the way in (meshopt +
 *  WebP textures) so the catalog never serves the raw multi-MB provider output;
 *  optimization is best-effort and falls back to the original bytes on failure.
 *  For STUD pieces, also auto-orients the model + injects attach:primary so it
 *  seats correctly on the piercing (see `normalize`). See lib/admin/glb-pipeline.ts. */
async function rehostGlb(
  externalUrl: string,
  jewelryId: string,
  normalize?: {
    type?: string | null;
    gauge?: number | null;
    size?: number | null;
    /** Product photo for the Gemini roll tiebreaker (STUD + asymmetric RING). */
    photoUrl?: string | null;
  },
): Promise<{
  url: string;
  before: number;
  after: number;
  optimized: boolean;
  placement?: {
    applied: boolean;
    confidence: number;
    suggestedScale: number | null;
    note: string;
  };
  quality?: QualityVerdict;
}> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "Vercel Blob не настроено. Установите BLOB_READ_WRITE_TOKEN в .env.",
    );
  }

  // Guarded fetch: refuse internal/loopback/link-local targets (SSRF defense in
  // depth — externalUrl comes from a provider poll response).
  const res = await safeAssetFetch(externalUrl);
  if (!res.ok) {
    throw new Error(
      `Не удалось скачать модель: HTTP ${res.status} ${res.statusText}`,
    );
  }
  const buffer = await res.arrayBuffer();

  const { optimizeGlb, measureGlbSizeM } = await import("@/lib/admin/glb-pipeline");
  const opt = await optimizeGlb(buffer, normalize ? { normalize } : {});

  // Unified scale: measure the FINAL (oriented, compressed) GLB's real bbox and
  // derive glbScale via the shared formula — the SAME measurement + rule the
  // manual upload + analyzer use, so a piece gets one scale regardless of path.
  // Only single-anchor types get a glbScale — multi-anchor (BARBELL) scale is
  // derived by the renderer from the two-anchor span, so leave it untouched.
  const singleAnchor = normalize?.type === "STUD" || normalize?.type === "RING";
  let placement = opt.placement;
  if (
    placement?.applied &&
    singleAnchor &&
    normalize &&
    (normalize.gauge || normalize.size)
  ) {
    const { suggestScaleFromSizeM } = await import("@/lib/admin/glb-scale");
    const sizeM = await measureGlbSizeM(opt.bytes);
    const s = sizeM
      ? suggestScaleFromSizeM(sizeM, normalize.gauge ?? null, normalize.size ?? null)
      : null;
    if (s) placement = { ...placement, suggestedScale: s.scale };
  }

  const key = `jewelry/${jewelryId}/models/${Date.now()}-auto.glb`;
  const blob = await put(key, Buffer.from(opt.bytes), {
    access: "public",
    addRandomSuffix: false,
    contentType: "model/gltf-binary",
  });
  return {
    url: blob.url,
    before: opt.before,
    after: opt.after,
    optimized: opt.optimized,
    placement,
    quality: opt.quality,
  };
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

  // AI is restricted to STUD/RING and straight/curved BARBELL — see
  // docs/20-multi-anchor-jewelry.md and docs/18-replicate-3d.md. A barbell's two
  // ball ends are recoverable as attach:primary/secondary (the renderer derives
  // scale from the two-anchor span); horseshoes, orbitals and ladders need
  // endpoint placement AI can't reliably produce, so they stay parametric-only.
  if (!isAiGeneratableType(jewelry.type)) {
    return {
      ok: false,
      error:
        "Авто-генерация доступна для одноточечных украшений (STUD, RING) и прямых штанг (BARBELL). Для подков, орбитальных колец и лесенок используйте параметрический пайплайн или загрузите .glb вручную.",
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

  // Photos the studio flagged for 3D (falls back to the cover when none are
  // flagged) — see lib/jewelry/format.ts → genPhotoUrls.
  const photoUrls = genPhotoUrls(jewelry.photos);
  if (photoUrls.length === 0) {
    return {
      ok: false,
      error: "Сначала загрузите хотя бы одну фотографию украшения.",
    };
  }
  const inputPhotos = asPhotos(jewelry.photos).filter((p) =>
    photoUrls.includes(p.url),
  );

  // Walk the auto chain. If the primary provider can't even start (down,
  // 401, rate-limited), automatically try the next one.
  let chosen = provider;
  let result = await chosen.start({ photoUrls });
  const errors: string[] = [];
  while (!result.ok) {
    errors.push(`${chosen.id}: ${result.error}`);
    const next = pickNextAutoProvider(chosen.id);
    if (!next) break;
    chosen = next;
    result = await chosen.start({ photoUrls });
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
      inputPhotos: inputPhotos as unknown as object,
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

  // STUD and RING both auto-orient + place during re-host: attach:primary on the post
  // neck (stud) or band top (hoop), with the Gemini tiebreaker resolving an asymmetric
  // piece's orientation against the photo. Other types are re-hosted/compressed only.
  const jewelry = await prisma.jewelry.findUnique({
    where: { id: jewelryId },
    select: { type: true, gauge: true, size: true, photos: true },
  });
  const normalize =
    jewelry?.type === "STUD"
      ? {
          type: "STUD",
          gauge: jewelry.gauge,
          size: jewelry.size,
          // Enables the AI roll tiebreaker for asymmetric studs (when GEMINI_API_KEY set).
          photoUrl: firstPhotoUrl(jewelry.photos),
        }
      : jewelry?.type === "RING"
        ? {
            type: "RING",
            gauge: jewelry.gauge,
            size: jewelry.size,
            // Enables the AI roll tiebreaker for asymmetric hoops (when GEMINI_API_KEY set).
            photoUrl: firstPhotoUrl(jewelry.photos),
          }
        : jewelry?.type === "BARBELL"
          ? {
              type: "BARBELL",
              gauge: jewelry.gauge,
              size: jewelry.size,
              // No glbScale/roll for a bar — the renderer derives scale from the two
              // anchors; photoUrl still drives the quality gate.
              photoUrl: firstPhotoUrl(jewelry.photos),
            }
          : undefined;

  // SUCCEEDED — re-host (+optimize +place) the GLB on our blob, then surface for review.
  let blobUrl: string;
  let sizeNote = "";
  let placementNote = "";
  let glbScaleUpdate: number | undefined;
  try {
    const hosted = await rehostGlb(result.resultGlbUrl, jewelryId, normalize);
    blobUrl = hosted.url;
    if (hosted.optimized) {
      const { formatOptimizeDelta } = await import("@/lib/admin/glb-pipeline");
      sizeNote = ` Размер оптимизирован: ${formatOptimizeDelta(hosted)}.`;
    }
    if (hosted.placement) {
      const p = hosted.placement;
      if (p.applied) {
        const pct = Math.round(p.confidence * 100);
        if (p.suggestedScale && p.suggestedScale > 0) {
          glbScaleUpdate = p.suggestedScale;
        }
        placementNote =
          p.confidence >= 0.6
            ? ` Ориентация и точка крепления определены автоматически (уверенность ${pct}%) — проверьте перед публикацией.`
            : ` Ориентация определена приблизительно (уверенность ${pct}%) — проверьте и при необходимости поправьте.`;
        // Surface whether the Gemini tiebreakers actually ran (head direction
        // for any stud, roll for asymmetric ones) so the admin sees the AI worked.
        if (p.note?.includes("AI flipped head")) {
          placementNote +=
            " Лицевая сторона определена по фото с помощью ИИ (Gemini).";
        }
        if (p.note?.includes("AI picked")) {
          placementNote += " Поворот подобран по фото с помощью ИИ (Gemini).";
        } else if (p.note?.includes("GEMINI_API_KEY not set")) {
          placementNote +=
            " (ИИ-подбор ориентации пропущен — не задан GEMINI_API_KEY.)";
        }
      } else {
        placementNote =
          " Автоматическое размещение не удалось — настройте ориентацию и масштаб вручную.";
      }
    }

    // AI quality gate. A confident reject auto-retries the next provider; the auto
    // chain caps retries (each provider is tried at most once), so this can't loop.
    // An exhausted chain KEEPS the model for manual review — a borderline mesh is
    // often salvageable via the point-picker, better than discarding it.
    const { qualityRejected } = await import("@/lib/admin/glb-quality-vision");
    if (qualityRejected(hosted.quality)) {
      const q = hosted.quality!;
      const issuesText = q.issues.length
        ? ` Проблемы: ${q.issues.join("; ")}.`
        : "";
      const next = pickNextAutoProvider(job.provider as ProviderId);
      if (next) {
        const photoUrls = asPhotos(job.inputPhotos).map((p) => p.url);
        const startResult = await next.start({ photoUrls });
        if (startResult.ok) {
          // Drop the rejected blob, fail this attempt, queue the next provider.
          if (process.env.BLOB_READ_WRITE_TOKEN) {
            try {
              await del(hosted.url);
            } catch {
              /* best-effort */
            }
          }
          await prisma.generationJob.update({
            where: { id: job.id },
            data: {
              status: "FAILED",
              errorMessage: `Низкое качество (оценка ${q.score}).${issuesText}`,
              completedAt: new Date(),
            },
          });
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
          revalidateForJewelry(jewelryId);
          return {
            ok: true,
            message: `Модель отклонена ИИ-проверкой качества (оценка ${q.score}).${issuesText} Перегенерируем через ${next.id}.`,
          };
        }
      }
      // No fallback (or it refused to start): keep the model, flag it for review.
      placementNote += ` ⚠ ИИ-проверка качества выявила возможные дефекты (оценка ${q.score}).${issuesText} Проверьте модель вручную или перегенерируйте.`;
    }
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Не удалось перенести модель";
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
    data: {
      status: "PENDING_REVIEW",
      ...(glbScaleUpdate ? { glbScale: glbScaleUpdate } : {}),
    },
  });

  revalidateForJewelry(jewelryId);
  return {
    ok: true,
    message: `Модель готова. Просмотрите и утвердите её ниже.${sizeNote}${placementNote}`,
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

  // Point the jewelry at the (already-hosted) result FIRST, then delete the old
  // model. Deleting before the pointer update risks a dangling glbUrl → 404 in
  // the catalog proxy if the delete or update is interrupted.
  const previousUrl = job.jewelry.glbUrl;
  await prisma.jewelry.update({
    where: { id: job.jewelryId },
    data: {
      glbUrl: job.resultGlbUrl,
      status: "PUBLISHED",
    },
  });

  if (
    previousUrl &&
    previousUrl !== job.resultGlbUrl &&
    process.env.BLOB_READ_WRITE_TOKEN
  ) {
    try {
      await del(previousUrl);
    } catch {
      /* best-effort cleanup — orphan is fine, dangling glbUrl is not */
    }
  }

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
