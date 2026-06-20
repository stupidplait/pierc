import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getProvider, pickNextAutoProvider } from "@/lib/three-gen";
import type { ProviderId } from "@/lib/three-gen";
import { asPhotos, firstPhotoUrl } from "@/lib/jewelry/format";
import { authorizeCron } from "@/lib/cron-auth";
import { safeAssetFetch } from "@/lib/security/safe-fetch";

// Vercel Cron — polls every in-flight GenerationJob, applies the same
// state transitions as the admin "Обновить статус" button:
//
//   PROCESSING + provider says SUCCEEDED →
//     download GLB, re-host on Vercel Blob,
//     job.status = SUCCEEDED, jewelry.status = PENDING_REVIEW
//
//   PROCESSING + provider says FAILED →
//     try the next provider in the auto-chain (Tripo3D → … → null);
//     if that succeeds, queue a new job and mark the old one FAILED;
//     if no fallback, terminal fail (jewelry → DRAFT).
//
// Auth: when CRON_SECRET is set in env, require it on every request as
// `Authorization: Bearer ${CRON_SECRET}`. Vercel Cron sends this header
// automatically. In dev (no CRON_SECRET set) we leave the route open so
// the developer can hit it manually with curl for testing.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // seconds — Tripo + blob upload can be slow

// Stop *starting* new jobs once we're this close to maxDuration. Each processJob
// commits its own DB updates inline, so partial progress is preserved and the
// un-started jobs simply retry on the next tick (oldest-first) instead of risking
// a mid-flight function kill. Re-host work (download + optimizeGlb + blob put) can
// take several seconds per job, so we leave ~10s of headroom.
const TIME_BUDGET_MS = 50_000;

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await prisma.generationJob.findMany({
    where: { status: "PROCESSING" },
    orderBy: { startedAt: "asc" },
    take: 50, // safety cap — never hammer providers in one tick
  });

  const results: Array<{
    id: string;
    status: string;
    note?: string;
  }> = [];

  const startedAt = Date.now();
  for (const job of jobs) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      results.push({ id: job.id, status: "deferred_time_budget" });
      break; // remaining PROCESSING jobs are picked up on the next tick
    }
    if (!job.providerJobId) {
      results.push({ id: job.id, status: "skipped_no_provider_id" });
      continue;
    }

    try {
      const result = await processJob(job);
      results.push(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      results.push({ id: job.id, status: "exception", note: msg });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: jobs.length,
    results,
  });
}

interface JobRow {
  id: string;
  jewelryId: string;
  provider: string;
  providerJobId: string | null;
  inputPhotos: unknown;
}

async function processJob(
  job: JobRow,
): Promise<{ id: string; status: string; note?: string }> {
  const providerId = job.provider as ProviderId;
  const provider = getProvider(providerId);
  const pollResult = await provider.poll(job.providerJobId!);

  if (pollResult.status === "PROCESSING") {
    return { id: job.id, status: "still_processing" };
  }

  if (pollResult.status === "FAILED") {
    return await handleFailedPoll(job, pollResult.errorMessage);
  }

  // For STUD pieces, auto-orient + place during re-host (phase 1); RING/others
  // are compressed only. Mirror the manual poll action in jewelry-generation-actions.
  const jewelry = await prisma.jewelry.findUnique({
    where: { id: job.jewelryId },
    select: { type: true, gauge: true, size: true, photos: true },
  });
  const normalize =
    jewelry?.type === "STUD"
      ? {
          type: "STUD",
          gauge: jewelry.gauge,
          size: jewelry.size,
          photoUrl: firstPhotoUrl(jewelry.photos),
        }
      : jewelry?.type === "RING"
        ? {
            type: "RING",
            gauge: jewelry.gauge,
            size: jewelry.size,
            // Enables the AI roll/mount tiebreaker for asymmetric hoops on the
            // CRON path too (was STUD-only here — the manual poll action always
            // passed it, so cron-finalized rings silently skipped the AI step).
            photoUrl: firstPhotoUrl(jewelry.photos),
          }
        : undefined;

  // SUCCEEDED — re-host (+optimize +place) the GLB on our blob storage.
  let hosted: Awaited<ReturnType<typeof rehostGlb>>;
  try {
    hosted = await rehostGlb(pollResult.resultGlbUrl, job.jewelryId, normalize);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "rehost failed";
    await markJobFailed(job, msg);
    return { id: job.id, status: "rehost_failed", note: msg };
  }

  const autoScale =
    hosted.placement?.applied && hosted.placement.suggestedScale
      ? hosted.placement.suggestedScale
      : undefined;

  await prisma.generationJob.update({
    where: { id: job.id },
    data: {
      status: "SUCCEEDED",
      resultGlbUrl: hosted.url,
      completedAt: new Date(),
    },
  });
  await prisma.jewelry.update({
    where: { id: job.jewelryId },
    data: {
      status: "PENDING_REVIEW",
      ...(autoScale ? { glbScale: autoScale } : {}),
    },
  });
  const placeNote = hosted.placement
    ? hosted.placement.applied
      ? ` placed(conf ${hosted.placement.confidence})`
      : " place-failed"
    : "";
  return {
    id: job.id,
    status: "succeeded",
    note:
      (hosted.optimized
        ? `optimized ${hosted.before}→${hosted.after} bytes`
        : "stored as-is") + placeNote,
  };
}

async function handleFailedPoll(
  job: JobRow,
  errorMessage: string,
): Promise<{ id: string; status: string; note?: string }> {
  const next = pickNextAutoProvider(job.provider as ProviderId);
  if (!next) {
    await markJobFailed(job, errorMessage);
    return { id: job.id, status: "failed_terminal", note: errorMessage };
  }

  const photoUrls = asPhotos(job.inputPhotos).map((p) => p.url);
  const startResult = await next.start({ photoUrls });
  if (!startResult.ok) {
    await markJobFailed(
      job,
      `${errorMessage} (${next.id}: ${startResult.error})`,
    );
    return {
      id: job.id,
      status: "failed_fallback_refused",
      note: startResult.error,
    };
  }

  // Old job → FAILED, new job → PROCESSING with the next provider.
  await prisma.generationJob.update({
    where: { id: job.id },
    data: {
      status: "FAILED",
      errorMessage,
      completedAt: new Date(),
    },
  });
  await prisma.generationJob.create({
    data: {
      jewelryId: job.jewelryId,
      provider: next.id,
      providerJobId: startResult.providerJobId,
      status: "PROCESSING",
      inputPhotos: job.inputPhotos as object,
      startedAt: new Date(),
    },
  });
  return {
    id: job.id,
    status: "fallback_to",
    note: next.id,
  };
}

async function markJobFailed(job: JobRow, errorMessage: string): Promise<void> {
  await prisma.generationJob.update({
    where: { id: job.id },
    data: {
      status: "FAILED",
      errorMessage,
      completedAt: new Date(),
    },
  });
  await prisma.jewelry.update({
    where: { id: job.jewelryId },
    data: { status: "DRAFT" },
  });
}

async function rehostGlb(
  externalUrl: string,
  jewelryId: string,
  normalize?: {
    type?: string | null;
    gauge?: number | null;
    size?: number | null;
    /** Product photo for the Gemini roll/mount tiebreaker (STUD + asymmetric RING). */
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
}> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN not configured");
  }
  // Guarded fetch: refuse internal/loopback/link-local targets (SSRF defense in
  // depth — externalUrl comes from a provider poll response).
  const res = await safeAssetFetch(externalUrl);
  if (!res.ok) {
    throw new Error(`Failed to download GLB: HTTP ${res.status}`);
  }
  const buffer = await res.arrayBuffer();

  // Optimize on the way in (meshopt + WebP textures) so the catalog never
  // serves the raw multi-MB provider output, and auto-place STUD pieces.
  // Best-effort — falls back to the original bytes on failure. See glb-pipeline.ts.
  const { optimizeGlb, measureGlbSizeM } = await import("@/lib/admin/glb-pipeline");
  const opt = await optimizeGlb(buffer, normalize ? { normalize } : {});

  // Unified scale: measure the FINAL (oriented, compressed) GLB's real bbox and
  // derive glbScale via the shared formula — the SAME measurement + rule the
  // manual upload + analyzer use, so a piece gets one scale regardless of path.
  let placement = opt.placement;
  if (placement?.applied && normalize && (normalize.gauge || normalize.size)) {
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
  };
}
