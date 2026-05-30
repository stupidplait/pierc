import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/admin/auth-helpers";
import { streamBlob } from "@/app/api/jewelry-glb/_lib/stream-blob";

// Proxy an *unapproved* generation candidate's `.glb` (a GenerationJob's
// resultGlbUrl) through this app's origin, so the admin review viewer can load
// it without hitting Vercel Blob's cross-origin firewall challenge (see the
// sibling [id] route + lib/jewelry/glb-proxy for the why).
//
// Unlike the published [id] route this is ADMIN-ONLY: candidates aren't public,
// so the result blob is only ever streamed to a signed-in admin session.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Params {
  jobId: string;
}

async function resolveUrl(jobId: string): Promise<string | null> {
  try {
    await assertAdmin();
  } catch {
    return null; // not an admin → treat as missing (don't leak existence)
  }
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
    select: { resultGlbUrl: true },
  });
  return job?.resultGlbUrl ?? null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  const { jobId } = await params;
  const url = await resolveUrl(jobId);
  if (!url) return new NextResponse("Not found", { status: 404 });
  return streamBlob(url, "GET");
}

export async function HEAD(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  const { jobId } = await params;
  const url = await resolveUrl(jobId);
  if (!url) return new NextResponse(null, { status: 404 });
  return streamBlob(url, "HEAD");
}
