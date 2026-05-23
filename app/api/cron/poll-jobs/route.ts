import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getProvider, pickNextAutoProvider } from "@/lib/three-gen";
import type { ProviderId } from "@/lib/three-gen";
import { asPhotos } from "@/lib/jewelry/format";

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

export async function GET(request: Request) {
  if (!authorize(request)) {
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

  for (const job of jobs) {
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

function authorize(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // dev / unconfigured mode
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
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

  // SUCCEEDED — re-host the GLB on our blob storage.
  let blobUrl: string;
  try {
    blobUrl = await rehostGlb(pollResult.resultGlbUrl, job.jewelryId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "rehost failed";
    await markJobFailed(job, msg);
    return { id: job.id, status: "rehost_failed", note: msg };
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
    where: { id: job.jewelryId },
    data: { status: "PENDING_REVIEW" },
  });
  return { id: job.id, status: "succeeded" };
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
): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN not configured");
  }
  const res = await fetch(externalUrl);
  if (!res.ok) {
    throw new Error(`Failed to download GLB: HTTP ${res.status}`);
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
