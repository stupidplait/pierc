import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { firstPhotoUrl } from "@/lib/jewelry/format";

// Pull-worker result endpoint (see docs/22-local-fallback.md). The worker POSTs a
// multipart form with either a `glb` file (the generated model) or an `error`
// string. We re-host + optimize the model on Vercel Blob — running the SAME
// type-driven normalize (attach injection + Gemini tiebreaker + quality gate) as
// the managed providers — and finalize the job directly (SUCCEEDED + jewelry
// PENDING_REVIEW), so the admin reviews it exactly like a Replicate/Tripo result.
//
// Auth: Bearer LOCAL_WORKER_SECRET, fail-closed.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // optimize + blob upload can take several seconds

function authorize(req: Request): boolean {
  const expected = process.env.LOCAL_WORKER_SECRET;
  if (!expected) return false; // fail closed
  return (req.headers.get("authorization") ?? "") === `Bearer ${expected}`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const job = await prisma.generationJob.findUnique({
    where: { id },
    select: { id: true, jewelryId: true, provider: true, status: true },
  });
  if (!job || job.provider !== "local") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (job.status !== "PROCESSING") {
    return NextResponse.json({ error: "Job not in progress" }, { status: 409 });
  }

  const form = await req.formData();

  // Worker-reported failure → mark FAILED, jewelry back to DRAFT.
  const errorField = form.get("error");
  if (typeof errorField === "string" && errorField.trim()) {
    await prisma.generationJob.update({
      where: { id },
      data: {
        status: "FAILED",
        errorMessage: errorField.slice(0, 500),
        completedAt: new Date(),
      },
    });
    await prisma.jewelry.update({
      where: { id: job.jewelryId },
      data: { status: "DRAFT" },
    });
    return NextResponse.json({ ok: true });
  }

  const file = form.get("glb");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'glb' file" }, { status: 400 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Blob not configured" }, { status: 500 });
  }

  const buffer = await file.arrayBuffer();

  // Same optimize + (type-driven) normalize as the managed providers, so a local
  // STUD/RING/BARBELL gets attach injection + the AI tiebreaker/quality gate too.
  const jewelry = await prisma.jewelry.findUnique({
    where: { id: job.jewelryId },
    select: { type: true, gauge: true, size: true, photos: true },
  });
  const normalize =
    jewelry?.type === "STUD" ||
    jewelry?.type === "RING" ||
    jewelry?.type === "BARBELL"
      ? {
          type: jewelry.type,
          gauge: jewelry.gauge,
          size: jewelry.size,
          photoUrl: firstPhotoUrl(jewelry.photos),
        }
      : undefined;

  const { optimizeGlb } = await import("@/lib/admin/glb-pipeline");
  const opt = await optimizeGlb(buffer, normalize ? { normalize } : {});

  const key = `jewelry/${job.jewelryId}/models/${Date.now()}-local.glb`;
  const blob = await put(key, Buffer.from(opt.bytes), {
    access: "public",
    addRandomSuffix: false,
    contentType: "model/gltf-binary",
  });

  // Single-anchor scale suggestion only (multi-anchor scale is renderer-derived).
  const singleAnchor =
    normalize?.type === "STUD" || normalize?.type === "RING";
  const glbScale =
    singleAnchor && opt.placement?.applied && opt.placement.suggestedScale
      ? opt.placement.suggestedScale
      : undefined;

  await prisma.generationJob.update({
    where: { id },
    data: {
      status: "SUCCEEDED",
      resultGlbUrl: blob.url,
      completedAt: new Date(),
    },
  });
  await prisma.jewelry.update({
    where: { id: job.jewelryId },
    data: { status: "PENDING_REVIEW", ...(glbScale ? { glbScale } : {}) },
  });

  return NextResponse.json({ ok: true, url: blob.url });
}
